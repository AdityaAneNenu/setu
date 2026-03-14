from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from .permissions import (
    CanCreateGaps,
    CanVerifyGaps,
    CanResolveGaps,
    CanViewAnalytics,
)
from django.shortcuts import get_object_or_404
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import os
import json
import logging
import re
import time

from .models import Complaint, Village, QRSubmission, Gap, SurveyAgent
from .serializers import QRSubmissionSerializer
from django.db.models import Count, Q
from django.db import transaction


@method_decorator(csrf_exempt, name="dispatch")
class QRSubmissionAPIView(APIView):
    """
    API endpoint for QR code submissions
    GET /api/qr-submissions/ - List all submissions
    POST /api/qr-submissions/ - Create new submission
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        submissions = QRSubmission.objects.all().order_by("-created_at")[:50]
        serializer = QRSubmissionSerializer(submissions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = QRSubmissionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(csrf_exempt, name="dispatch")
class LoginAPIView(APIView):
    """
    API endpoint for user authentication
    POST /api/auth/login/
    Body: { "username": "admin", "password": "Admin@123" }
    """

    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"error": "Username and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(username=username, password=password)

        if user is not None:
            # Get or create token for user
            token, created = Token.objects.get_or_create(user=user)

            # Get user role from profile if exists
            from .permissions import get_user_role

            role = get_user_role(user) or "ground"

            return Response(
                {
                    "success": True,
                    "token": token.key,
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email or "",
                        "role": role,
                        "is_superuser": user.is_superuser,
                        "is_staff": user.is_staff,
                    },
                }
            )
        else:
            return Response(
                {"error": "Invalid username or password"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


@method_decorator(csrf_exempt, name="dispatch")
class LogoutAPIView(APIView):
    """
    API endpoint for user logout
    POST /api/auth/logout/
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Delete the user's auth token to invalidate the session
        try:
            Token.objects.filter(user=request.user).delete()
        except Exception as e:
            # Log the exception but don't fail the logout
            import logging

            logging.getLogger(__name__).error(
                f"Error deleting token during logout: {e}"
            )
        return Response({"success": True, "message": "Logged out successfully"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    """Get current user profile"""
    from .permissions import get_user_role

    role = get_user_role(request.user) or "ground"

    return Response(
        {
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email or "",
            "role": role,
            "is_superuser": request.user.is_superuser,
            "is_staff": request.user.is_staff,
        }
    )


# =============================================================================
# JSON API ENDPOINTS FOR NEXT.JS FRONTEND
# =============================================================================


@api_view(["GET"])
@permission_classes([CanViewAnalytics])
def api_villages_list(request):
    """JSON API endpoint to list all villages with gap statistics (Manager+ only)"""
    villages = Village.objects.annotate(
        total_gaps=Count("gap"),
        open_gaps=Count("gap", filter=Q(gap__status="open")),
        in_progress_gaps=Count("gap", filter=Q(gap__status="in_progress")),
        resolved_gaps=Count("gap", filter=Q(gap__status="resolved")),
        high_severity=Count("gap", filter=Q(gap__severity="high")),
        medium_severity=Count("gap", filter=Q(gap__severity="medium")),
        low_severity=Count("gap", filter=Q(gap__severity="low")),
    )

    villages_data = [
        {
            "id": v.id,
            "name": v.name,
            "total_gaps": v.total_gaps,
            "open_gaps": v.open_gaps,
            "in_progress_gaps": v.in_progress_gaps,
            "resolved_gaps": v.resolved_gaps,
            "high_severity": v.high_severity,
            "medium_severity": v.medium_severity,
            "low_severity": v.low_severity,
        }
        for v in villages
    ]

    return Response({"villages": villages_data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_gaps_list(request):
    """JSON API endpoint to list all gaps with filters and pagination"""
    gaps = Gap.objects.select_related("village").all().order_by("-id")

    # Valid filter values
    VALID_STATUSES = ["open", "in_progress", "resolved"]
    VALID_SEVERITIES = ["low", "medium", "high"]
    VALID_GAP_TYPES = [
        "water",
        "road",
        "sanitation",
        "electricity",
        "education",
        "health",
        "housing",
        "agriculture",
        "connectivity",
        "employment",
        "community_center",
        "drainage",
        "other",
    ]

    # Apply filters with validation
    status_filter = request.GET.get("status")
    if status_filter and status_filter in VALID_STATUSES:
        gaps = gaps.filter(status=status_filter)

    severity_filter = request.GET.get("severity")
    if severity_filter and severity_filter in VALID_SEVERITIES:
        gaps = gaps.filter(severity=severity_filter)

    village_filter = request.GET.get("village")
    if village_filter:
        try:
            village_id = int(village_filter)
            gaps = gaps.filter(village_id=village_id)
        except (ValueError, TypeError):
            pass  # Ignore invalid village IDs

    gap_type_filter = request.GET.get("gap_type")
    if gap_type_filter and gap_type_filter in VALID_GAP_TYPES:
        gaps = gaps.filter(gap_type=gap_type_filter)

    # Pagination
    try:
        page = max(1, int(request.GET.get("page", 1)))
        limit = min(100, max(1, int(request.GET.get("limit", 50))))
    except (ValueError, TypeError):
        page = 1
        limit = 50

    total_count = gaps.count()
    start = (page - 1) * limit
    end = start + limit
    gaps = gaps[start:end]

    gaps_data = []
    for gap in gaps:
        gaps_data.append(
            {
                "id": gap.id,
                "village_id": gap.village_id if gap.village_id else None,
                "village_name": gap.village.name if gap.village else "N/A",
                "description": gap.description,
                "gap_type": gap.gap_type,
                "severity": gap.severity,
                "status": gap.status,
                "input_method": gap.input_method,
                "recommendations": gap.recommendations,
                "created_at": gap.created_at.isoformat() if gap.created_at else None,
                "latitude": float(gap.latitude) if gap.latitude else None,
                "longitude": float(gap.longitude) if gap.longitude else None,
                "audio_file": gap.audio_file.url if gap.audio_file else None,
            }
        )

    return Response(
        {
            "gaps": gaps_data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "total_pages": (total_count + limit - 1) // limit,
            },
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_gap_detail(request, gap_id):
    """JSON API endpoint to get single gap details"""
    try:
        gap = Gap.objects.select_related("village").get(id=gap_id)
        data = {
            "id": gap.id,
            "village_id": gap.village_id if gap.village_id else None,
            "village_name": gap.village.name if gap.village else "N/A",
            "description": gap.description,
            "gap_type": gap.gap_type,
            "severity": gap.severity,
            "status": gap.status,
            "input_method": gap.input_method,
            "recommendations": gap.recommendations,
            "voice_code": gap.voice_code if hasattr(gap, "voice_code") else None,
            "created_at": gap.created_at.isoformat() if gap.created_at else None,
            "start_date": gap.start_date.isoformat() if gap.start_date else None,
            "expected_completion": (
                gap.expected_completion.isoformat() if gap.expected_completion else None
            ),
            "actual_completion": (
                gap.actual_completion.isoformat() if gap.actual_completion else None
            ),
            "latitude": float(gap.latitude) if gap.latitude else None,
            "longitude": float(gap.longitude) if gap.longitude else None,
            "audio_file": gap.audio_file.url if gap.audio_file else None,
            "resolution_proof": (
                gap.resolution_proof.url if gap.resolution_proof else None
            ),
        }
        return Response(data)
    except Gap.DoesNotExist:
        return Response({"error": "Gap not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes([CanVerifyGaps])
def api_update_gap_status(request, gap_id):
    """JSON API endpoint to update gap status (Manager+ can update, Admin can resolve)"""
    from .permissions import can_resolve_gaps
    from .models import GapStatusAuditLog

    try:
        gap = Gap.objects.get(id=gap_id)
        old_status = gap.status
        new_status = request.data.get("status")
        notes = request.data.get("notes", "")

        # Check if trying to resolve - requires admin
        if new_status == "resolved" and not can_resolve_gaps(request.user):
            return Response(
                {
                    "success": False,
                    "error": "Only Admin can mark gaps as resolved",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if new_status and new_status in ["open", "in_progress", "resolved"]:
            gap.status = new_status
            gap.save()

            # Create audit log entry
            GapStatusAuditLog.objects.create(
                gap=gap,
                old_status=old_status,
                new_status=new_status,
                changed_by=request.user if request.user.is_authenticated else None,
                notes=notes,
                source="web_api",
            )

            # Sync to Firebase Firestore with retry logic
            try:
                from .firebase_utils import sync_gap_to_firestore

                sync_gap_to_firestore(gap)
            except Exception as fb_err:
                # ✅ IMPROVED: Enhanced Firebase sync with retry mechanism
                import logging
                from django.core.cache import cache

                logger = logging.getLogger(__name__)
                logger.error(f"Firebase sync failed for gap {gap.id}: {fb_err}")

                # Add to retry queue in cache (expires in 24 hours)
                retry_key = f"firebase_retry_gap_{gap.id}_{int(time.time())}"
                cache.set(
                    retry_key,
                    {
                        "gap_id": gap.id,
                        "action": "update_status",
                        "attempts": 1,
                        "error": str(fb_err),
                        "timestamp": time.time(),
                    },
                    86400,
                )  # 24 hours

                # Maintain retry index for easier cleanup
                retry_index = cache.get("firebase_retry_index", set())
                retry_index.add(retry_key)
                cache.set("firebase_retry_index", retry_index, 86400)

                logger.info(f"Added gap {gap.id} to Firebase retry queue: {retry_key}")

            return Response(
                {
                    "success": True,
                    "message": f"Gap status updated to {new_status}",
                    "id": gap.id,
                    "status": gap.status,
                }
            )
        else:
            return Response(
                {
                    "error": "Invalid status. Must be 'open', 'in_progress', or 'resolved'"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
    except Gap.DoesNotExist:
        return Response({"error": "Gap not found"}, status=status.HTTP_404_NOT_FOUND)


@method_decorator(csrf_exempt, name="dispatch")
class GapUploadAPIView(APIView):
    """API endpoint for uploading/creating new gaps"""

    permission_classes = [CanCreateGaps]

    # 13 gap type categories
    GAP_CATEGORIES = [
        "water",
        "road",
        "sanitation",
        "electricity",
        "education",
        "health",
        "housing",
        "agriculture",
        "connectivity",
        "employment",
        "community_center",
        "drainage",
        "other",
    ]

    def post(self, request):
        try:
            import google.generativeai as genai
            import os

            village_id = request.data.get("village")
            description = request.data.get("description", "")
            gap_type = request.data.get("gap_type", "")
            severity = request.data.get("severity", "low")
            submission_type = request.data.get("submission_type", "text")
            language_code = request.data.get("language_code", "hi")
            latitude = request.data.get("latitude")
            longitude = request.data.get("longitude")

            if not village_id:
                return Response(
                    {"error": "Village is required"}, status=status.HTTP_400_BAD_REQUEST
                )

            try:
                village = Village.objects.get(id=village_id)
            except Village.DoesNotExist:
                return Response(
                    {"error": "Village not found"}, status=status.HTTP_404_NOT_FOUND
                )

            input_method = "text"
            processed_description = description
            processed_gap_type = gap_type
            processed_severity = severity
            recommendations = ""

            # Handle text input with translation and categorization (for Hindi text)
            if (
                "audio_file" not in request.FILES
                and "image" not in request.FILES
                and description
            ):
                # Text-based submission - translate and categorize if in Hindi
                if language_code and language_code != "en" and description.strip():
                    try:
                        gemini_key = os.getenv("GEMINI_API_KEY")
                        if gemini_key:
                            genai.configure(api_key=gemini_key)
                            model = genai.GenerativeModel("gemini-2.5-flash")

                            categories_list = ", ".join(self.GAP_CATEGORIES)

                            translation_prompt = f"""
                            Translate the following text to English and categorize it. Respond ONLY with valid JSON:
                            Text: "{description}"
                            
                            {{
                              "translated_text": "English translation of the text",
                              "gap_type": "Choose ONLY ONE from [{categories_list}]",
                              "severity": "low/medium/high based on urgency",
                              "recommendations": "Specific actionable recommendations to solve this issue"
                            }}
                            """

                            ai_response = model.generate_content(translation_prompt)
                            clean_response = (
                                ai_response.text.replace("```json", "")
                                .replace("```", "")
                                .strip()
                            )
                            ai_data = json.loads(clean_response)

                            processed_description = ai_data.get(
                                "translated_text", description
                            )
                            processed_gap_type = ai_data.get("gap_type", "other")
                            processed_severity = ai_data.get(
                                "severity", severity or "medium"
                            )
                            recommendations = ai_data.get("recommendations", "")

                            # Ensure gap_type is in allowed categories
                            if processed_gap_type not in self.GAP_CATEGORIES:
                                processed_gap_type = "other"
                        else:
                            print("GEMINI_API_KEY not found - skipping translation")
                            processed_description = description
                            processed_gap_type = gap_type or "other"
                            processed_severity = severity or "medium"
                    except Exception as text_err:
                        print(f"Text translation error: {text_err}")
                        processed_description = description
                        processed_gap_type = gap_type or "other"
                        processed_severity = severity or "medium"
                        recommendations = "Translation failed - manual review needed"
                else:
                    # English text or no translation needed
                    processed_description = description
                    processed_gap_type = gap_type or "other"
                    processed_severity = severity or "medium"

            # Handle audio file processing
            if "audio_file" in request.FILES:
                input_method = "voice"
                audio_file = request.FILES["audio_file"]

                # ✅ SECURITY: Validate audio file size (max 50MB)
                MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50MB
                if audio_file.size > MAX_AUDIO_SIZE:
                    return Response(
                        {
                            "success": False,
                            "error": "Audio file too large. Maximum size is 50MB.",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    from .services import ComplaintProcessor

                    processor = ComplaintProcessor()

                    # Validate language code
                    if not language_code or language_code == "":
                        language_code = "hi"

                    # Process the audio file
                    result = processor.process_audio_complaint(
                        audio_file, language_code
                    )

                    if result["success"]:
                        transcribed_text = result["processed_text"]

                        # Use AI to translate and categorize
                        try:
                            gemini_key = os.getenv("GEMINI_API_KEY")
                            if gemini_key:
                                genai.configure(api_key=gemini_key)
                                model = genai.GenerativeModel("gemini-2.5-flash")

                                categories_list = ", ".join(self.GAP_CATEGORIES)

                                translation_prompt = f"""
                                Translate the following text to English and analyze it for gap categorization. Respond only with valid JSON:
                                Text: "{transcribed_text}"
                                
                                {{
                                  "translated_text": "English translation of the text",
                                  "gap_type": "Choose ONLY ONE from [{categories_list}]",
                                  "reason": "Clear description of the problem in English",
                                  "severity": "low/medium/high",
                                  "recommendations": "Specific recommendations to solve this issue"
                                }}
                                """

                                print(
                                    f"Translating audio transcription: {transcribed_text[:100]}..."
                                )
                                ai_response = model.generate_content(translation_prompt)
                                clean_response = (
                                    ai_response.text.replace("```json", "")
                                    .replace("```", "")
                                    .strip()
                                )
                                ai_data = json.loads(clean_response)

                                processed_description = ai_data.get(
                                    "translated_text", transcribed_text
                                )
                                processed_gap_type = ai_data.get(
                                    "gap_type", result["detected_type"]
                                )
                                processed_severity = ai_data.get(
                                    "severity", result["priority_level"]
                                )
                                recommendations = ai_data.get("recommendations", "")

                                print(
                                    f"Translation successful: {processed_description[:100]}..."
                                )

                                # Ensure gap_type is in allowed categories
                                if processed_gap_type not in self.GAP_CATEGORIES:
                                    processed_gap_type = "other"
                            else:
                                # Fallback without Gemini
                                print("GEMINI_API_KEY not found - skipping translation")
                                processed_description = transcribed_text
                                processed_gap_type = result["detected_type"]
                                processed_severity = result["priority_level"]
                                recommendations = (
                                    f"Auto-analyzed from audio in {language_code}"
                                )
                        except Exception as ai_err:
                            print(f"AI processing error: {ai_err}")
                            import traceback

                            traceback.print_exc()
                            processed_description = transcribed_text
                            processed_gap_type = result.get("detected_type", "other")
                            processed_severity = result.get("priority_level", "medium")
                            recommendations = "Audio transcribed but AI analysis failed"
                    else:
                        processed_description = f"Audio processing failed: {result.get('error', 'Unknown error')}"
                        processed_gap_type = "other"
                        processed_severity = "medium"

                except Exception as audio_err:
                    print(f"Audio processing exception: {audio_err}")
                    processed_description = "Audio file uploaded - processing pending"
                    processed_gap_type = "other"
                    processed_severity = "medium"

            # Handle image file processing
            elif "image" in request.FILES:
                input_method = "image"
                image_file = request.FILES["image"]

                # ✅ SECURITY: Validate image file size (max 10MB)
                MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
                if image_file.size > MAX_IMAGE_SIZE:
                    return Response(
                        {
                            "success": False,
                            "error": "Image file too large. Maximum size is 10MB.",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    from PIL import Image

                    gemini_key = os.getenv("GEMINI_API_KEY")

                    if gemini_key:
                        genai.configure(api_key=gemini_key)
                        model = genai.GenerativeModel("gemini-2.5-flash")

                        # Save image temporarily
                        img = Image.open(image_file)

                        categories_list = ", ".join(self.GAP_CATEGORIES)

                        prompt = f"""
                        Analyze this image and identify infrastructure gaps. Respond only with valid JSON:
                        {{
                          "extracted_text": "Any text visible in the image",
                          "gap_type": "Choose ONLY ONE from [{categories_list}]",
                          "reason": "Detailed description of the infrastructure gap visible in this image",
                          "severity": "low/medium/high based on the urgency of the issue",
                          "recommendations": ""
                        }}
                        """

                        response = model.generate_content([prompt, img])
                        clean_text = (
                            response.text.replace("```json", "")
                            .replace("```", "")
                            .strip()
                        )
                        data = json.loads(clean_text)

                        processed_description = data.get(
                            "reason", data.get("extracted_text", "")
                        )
                        processed_gap_type = data.get("gap_type", "other")
                        processed_severity = data.get("severity", "medium")
                        recommendations = data.get("recommendations", "")

                        # Ensure gap_type is in allowed categories
                        if processed_gap_type not in self.GAP_CATEGORIES:
                            processed_gap_type = "other"
                    else:
                        processed_description = (
                            "Image uploaded - AI processing not available"
                        )
                        processed_gap_type = gap_type or "other"
                        processed_severity = severity or "medium"

                except Exception as img_err:
                    print(f"Image processing exception: {img_err}")
                    processed_description = "Image file uploaded - processing pending"
                    processed_gap_type = gap_type or "other"
                    processed_severity = severity or "medium"

            # Validate severity
            if processed_severity not in ["low", "medium", "high"]:
                processed_severity = "medium"

            # Create the gap with transaction handling
            with transaction.atomic():
                gap = Gap.objects.create(
                    village=village,
                    description=processed_description,
                    gap_type=processed_gap_type,
                    severity=processed_severity,
                    input_method=input_method,
                    recommendations=recommendations,
                    status="open",
                    latitude=latitude if latitude else None,
                    longitude=longitude if longitude else None,
                )

                # Save audio file to gap (size already validated above)
                if "audio_file" in request.FILES:
                    audio_file = request.FILES["audio_file"]
                    audio_file.seek(0)  # Reset file pointer after earlier processing
                    gap.audio_file = audio_file
                    gap.save()

            # Sync to Firebase Firestore (outside transaction - non-critical)
            try:
                from .firebase_utils import sync_gap_to_firestore

                sync_gap_to_firestore(gap)
            except Exception as fb_err:
                print(f"Firebase sync warning (non-blocking): {fb_err}")

            return Response(
                {
                    "success": True,
                    "message": "Gap created successfully",
                    "id": gap.id,
                    "gap_type": processed_gap_type,
                    "severity": processed_severity,
                    "description": processed_description,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(["GET"])
@permission_classes([CanViewAnalytics])
def api_dashboard_stats(request):
    """JSON API endpoint for dashboard statistics (Manager+ only)"""
    gaps = Gap.objects.all()
    villages_qs = Village.objects.all()

    open_count = gaps.filter(status="open").count()
    in_progress_count = gaps.filter(status="in_progress").count()
    resolved_count = gaps.filter(status="resolved").count()
    total_gaps = gaps.count()

    high_count = gaps.filter(severity="high").count()
    medium_count = gaps.filter(severity="medium").count()
    low_count = gaps.filter(severity="low").count()

    # Gap types distribution
    gaps_by_type = list(gaps.values("gap_type").annotate(count=Count("id")))

    # Recent gaps (select_related to avoid N+1 on village FK)
    recent_gaps = [
        {
            "id": gap.id,
            "village_name": gap.village.name if gap.village else "N/A",
            "gap_type": gap.gap_type,
            "severity": gap.severity,
            "status": gap.status,
            "description": gap.description or "",
            "created_at": gap.created_at.isoformat() if gap.created_at else None,
        }
        for gap in Gap.objects.select_related("village").order_by("-created_at")[:5]
    ]

    # Villages data (single annotated query instead of N+1)
    villages_data = [
        {
            "id": v.id,
            "name": v.name,
            "total_gaps": v.total_gaps,
            "open_gaps": v.open_gaps,
            "in_progress_gaps": v.in_progress_gaps,
            "resolved_gaps": v.resolved_gaps,
        }
        for v in Village.objects.annotate(
            total_gaps=Count("gap"),
            open_gaps=Count("gap", filter=Q(gap__status="open")),
            in_progress_gaps=Count("gap", filter=Q(gap__status="in_progress")),
            resolved_gaps=Count("gap", filter=Q(gap__status="resolved")),
        )
    ]

    return Response(
        {
            "total_gaps": total_gaps,
            "open_gaps": open_count,
            "in_progress_gaps": in_progress_count,
            "resolved_gaps": resolved_count,
            "high_severity": high_count,
            "medium_severity": medium_count,
            "low_severity": low_count,
            "total_villages": villages_qs.count(),
            "gaps_by_type": gaps_by_type,
            "recent_gaps": recent_gaps,
            "villages": villages_data,
        }
    )


@api_view(["GET"])
@permission_classes([CanViewAnalytics])
def api_analytics(request):
    """JSON API endpoint for analytics data"""
    gaps = Gap.objects.all()

    open_count = gaps.filter(status="open").count()
    in_progress_count = gaps.filter(status="in_progress").count()
    resolved_count = gaps.filter(status="resolved").count()
    total_gaps = gaps.count()

    # Gap types distribution
    gaps_by_type = list(gaps.values("gap_type").annotate(count=Count("id")))

    # Severity distribution
    severity_data = {
        "high": gaps.filter(severity="high").count(),
        "medium": gaps.filter(severity="medium").count(),
        "low": gaps.filter(severity="low").count(),
    }

    # Village-wise gaps (single annotated query instead of N+1)
    village_gaps = [
        {
            "id": v.id,
            "name": v.name,
            "total": v.total,
            "open": v.open,
            "in_progress": v.in_progress,
            "resolved": v.resolved,
        }
        for v in Village.objects.annotate(
            total=Count("gap"),
            open=Count("gap", filter=Q(gap__status="open")),
            in_progress=Count("gap", filter=Q(gap__status="in_progress")),
            resolved=Count("gap", filter=Q(gap__status="resolved")),
        )
    ]

    return Response(
        {
            "total_gaps": total_gaps,
            "status_distribution": {
                "open": open_count,
                "in_progress": in_progress_count,
                "resolved": resolved_count,
            },
            "severity_distribution": severity_data,
            "gaps_by_type": gaps_by_type,
            "village_gaps": village_gaps,
        }
    )


# =============================================================================
# PUBLIC DASHBOARD API ENDPOINTS
# =============================================================================


@api_view(["GET"])
@permission_classes([AllowAny])
def api_public_dashboard(request):
    """Public dashboard data - no authentication required"""
    from django.db.models import Count

    # Get filters
    village_id = request.GET.get("village", "")
    gap_type = request.GET.get("type", "")

    gaps = Gap.objects.select_related("village").all()

    if village_id:
        gaps = gaps.filter(village_id=village_id)
    if gap_type:
        gaps = gaps.filter(gap_type=gap_type)

    # Statistics
    total_gaps = gaps.count()
    resolved_gaps = gaps.filter(status="resolved").count()
    in_progress_gaps = gaps.filter(status="in_progress").count()
    pending_gaps = gaps.filter(status="open").count()

    # Resolution rate
    resolution_rate = (resolved_gaps / total_gaps * 100) if total_gaps > 0 else 0

    # Gap type distribution
    gap_types_list = gaps.values("gap_type").annotate(count=Count("id"))
    gap_types = {item["gap_type"]: item["count"] for item in gap_types_list}

    # Severity distribution
    severity_data = {
        "high": gaps.filter(severity="high").count(),
        "medium": gaps.filter(severity="medium").count(),
        "low": gaps.filter(severity="low").count(),
    }

    # Village-wise data (single annotated query instead of N+1)
    village_annotations = Village.objects.annotate(
        total_gaps=Count("gap", filter=Q(gap__in=gaps)),
        resolved=Count("gap", filter=Q(gap__status="resolved", gap__in=gaps)),
        pending=Count("gap", filter=Q(gap__status="open", gap__in=gaps)),
        in_progress=Count("gap", filter=Q(gap__status="in_progress", gap__in=gaps)),
    ).filter(total_gaps__gt=0)

    village_data = [
        {
            "id": v.id,
            "name": v.name,
            "total_gaps": v.total_gaps,
            "resolved": v.resolved,
            "pending": v.pending,
            "in_progress": v.in_progress,
            "lat": getattr(v, "latitude", None) or 26.0 + v.id * 0.1,
            "lng": getattr(v, "longitude", None) or 80.0 + v.id * 0.1,
        }
        for v in village_annotations
    ]

    # Recent activity
    recent_gaps = []
    for gap in gaps.order_by("-created_at")[:10]:
        recent_gaps.append(
            {
                "id": gap.id,
                "village": gap.village.name if gap.village else "N/A",
                "type": gap.gap_type,
                "status": gap.status,
                "severity": gap.severity,
                "created_at": gap.created_at.isoformat() if gap.created_at else None,
            }
        )

    return Response(
        {
            "total_gaps": total_gaps,
            "resolved_gaps": resolved_gaps,
            "in_progress_gaps": in_progress_gaps,
            "pending_gaps": pending_gaps,
            "resolution_rate": round(resolution_rate, 1),
            "gap_types": gap_types,
            "severity_distribution": severity_data,
            "villages": village_data,
            "recent_gaps": recent_gaps,
        }
    )


# =============================================================================
# VOICE VERIFICATION API ENDPOINTS
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_voice_verification_logs(request, gap_id):
    """Get voice verification logs for a gap"""
    from .models import VoiceVerificationLog

    try:
        gap = Gap.objects.get(id=gap_id)
        logs = VoiceVerificationLog.objects.filter(gap=gap).order_by(
            "-verification_date"
        )

        logs_data = []
        for log in logs:
            logs_data.append(
                {
                    "id": log.id,
                    "verified_by": log.verified_by or "Unknown",
                    "verified_at": (
                        log.verification_date.isoformat()
                        if log.verification_date
                        else None
                    ),
                    "is_match": log.is_match,
                    "similarity_score": log.similarity_score,
                    "similarity_percentage": (
                        round(log.similarity_score * 100, 1)
                        if log.similarity_score
                        else 0
                    ),
                    "confidence": log.confidence or "unknown",
                    "notes": log.notes or "",
                    "used_for_closure": log.used_for_closure,
                    "audio_url": (
                        log.verification_audio_path
                        if log.verification_audio_path
                        else None
                    ),
                }
            )

        return Response(
            {
                "gap_id": gap_id,
                "total_attempts": len(logs_data),
                "logs": logs_data,
                "has_original_audio": bool(gap.audio_file),
                "original_audio_url": gap.audio_file.url if gap.audio_file else None,
            }
        )
    except Gap.DoesNotExist:
        return Response({"error": "Gap not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_gap_for_verification(request, gap_id):
    """Get gap details needed for voice verification"""
    try:
        gap = Gap.objects.select_related("village").get(id=gap_id)

        return Response(
            {
                "id": gap.id,
                "village_name": gap.village.name if gap.village else "N/A",
                "description": gap.description,
                "gap_type": gap.gap_type,
                "severity": gap.severity,
                "status": gap.status,
                "input_method": gap.input_method,
                "has_audio": bool(gap.audio_file),
                "audio_url": gap.audio_file.url if gap.audio_file else None,
                "voice_code": gap.voice_code or None,
                "created_at": gap.created_at.isoformat() if gap.created_at else None,
                "can_verify": gap.status != "resolved" and bool(gap.audio_file),
            }
        )
    except Gap.DoesNotExist:
        return Response({"error": "Gap not found"}, status=status.HTTP_404_NOT_FOUND)


@method_decorator(csrf_exempt, name="dispatch")
class VoiceVerificationSubmitAPIView(APIView):
    """API endpoint for submitting voice verification using actual voice biometric verification"""

    permission_classes = [IsAuthenticated]

    def post(self, request, gap_id):
        from .models import VoiceVerificationLog
        from .voice_verification import VoiceVerificationManager
        import os

        try:
            gap = Gap.objects.get(id=gap_id)

            # Check if gap has original audio
            if not gap.audio_file:
                return Response(
                    {
                        "success": False,
                        "error": "This gap has no original audio to verify against",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Check if audio file provided
            if "audio_file" not in request.FILES:
                return Response(
                    {
                        "success": False,
                        "error": "Verification audio file is required",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            verification_audio = request.FILES["audio_file"]

            # ✅ SECURITY: Validate verification audio file size
            MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50MB
            if verification_audio.size > MAX_AUDIO_SIZE:
                return Response(
                    {
                        "success": False,
                        "error": "Verification audio file too large. Maximum size is 50MB.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            verified_by = request.data.get("verified_by", "Unknown")
            notes = request.data.get("notes", "")

            # Perform actual voice biometric verification
            try:
                result = VoiceVerificationManager.verify_gap_resolution(
                    gap_obj=gap, verification_audio_file=verification_audio
                )

                # Create verification log
                log = VoiceVerificationLog.objects.create(
                    gap=gap,
                    verification_audio_path=result.get("verification_audio_path", ""),
                    similarity_score=result.get("similarity_score", 0.0),
                    is_match=result.get("is_match", False),
                    confidence=result.get("confidence", "very_low"),
                    verified_by=verified_by,
                    notes=notes,
                    used_for_closure=False,
                    verification_voice_code=result.get("verification_voice_code", ""),
                )

                # Update gap voice_code if not set
                if not gap.voice_code and result.get("original_voice_code"):
                    gap.voice_code = result.get("original_voice_code")
                    gap.save(update_fields=["voice_code"])

                return Response(
                    {
                        "success": True,
                        "verification": {
                            "is_match": result.get("is_match", False),
                            "similarity_score": result.get("similarity_score", 0.0),
                            "similarity_percentage": round(
                                result.get("similarity_score", 0.0) * 100, 1
                            ),
                            "confidence": result.get("confidence", "very_low"),
                            "threshold": result.get("threshold_used", 0.75),
                            "message": result.get("message", ""),
                        },
                        "can_resolve": result.get("can_proceed", False),
                        "log_id": log.id,
                    }
                )

            except Exception as verify_error:
                import traceback

                traceback.print_exc()
                return Response(
                    {
                        "success": False,
                        "error": f"Voice verification failed: {str(verify_error)}",
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        except Gap.DoesNotExist:
            return Response(
                {"error": "Gap not found"}, status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(["POST"])
@permission_classes([CanResolveGaps])  # Admin only can resolve gaps
def api_resolve_gap_with_voice(request, gap_id):
    """Resolve a gap after successful voice verification (Admin only)"""
    from .models import VoiceVerificationLog
    from .permissions import can_resolve_gaps

    try:
        gap = Gap.objects.get(id=gap_id)

        # Check if user can resolve gaps (ADMIN only)
        if request.user.is_authenticated and not can_resolve_gaps(request.user):
            return Response(
                {
                    "success": False,
                    "error": "Only Admin can resolve gaps",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if already resolved
        if gap.status == "resolved":
            return Response(
                {
                    "success": False,
                    "error": "Gap is already resolved",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # For voice gaps, check if there's a successful verification
        if gap.input_method == "voice" and gap.audio_file:
            latest_verification = (
                VoiceVerificationLog.objects.filter(gap=gap, is_match=True)
                .order_by("-verification_date")
                .first()
            )

            if not latest_verification:
                return Response(
                    {
                        "success": False,
                        "error": "Voice verification required before resolving. Please verify your voice first.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Mark verification as used for closure
            latest_verification.used_for_closure = True
            latest_verification.save()

        # Resolve the gap
        from django.utils import timezone

        gap.status = "resolved"
        gap.resolved_at = timezone.now()
        if request.user.is_authenticated:
            gap.resolved_by = request.user
        gap.save()

        # Sync to Firebase Firestore
        try:
            from .firebase_utils import sync_gap_to_firestore

            sync_gap_to_firestore(gap)
        except Exception as fb_err:
            print(f"Firebase sync warning (non-blocking): {fb_err}")

        return Response(
            {
                "success": True,
                "message": "Gap resolved successfully",
                "gap_id": gap.id,
                "status": gap.status,
            }
        )

    except Gap.DoesNotExist:
        return Response({"error": "Gap not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Workflow/Complaint API endpoints
@api_view(["GET"])
@permission_classes([CanViewAnalytics])
def api_workflow_complaints(request):
    """Get list of complaints with optional filtering (Manager+ only)"""
    try:
        complaints = Complaint.objects.select_related("village", "post_office").all()

        # Filter by status if provided
        status_filter = request.GET.get("status")
        if status_filter and status_filter != "":
            complaints = complaints.filter(status=status_filter)

        # Filter by category if provided
        category_filter = request.GET.get("category")
        if category_filter:
            complaints = complaints.filter(complaint_type=category_filter)

        complaints = complaints.order_by("-created_at")

        complaints_data = []
        for complaint in complaints:
            complaints_data.append(
                {
                    "id": complaint.id,
                    "complaint_id": complaint.complaint_id,
                    "complaint_text": complaint.complaint_text,
                    "village_name": (
                        complaint.village.name if complaint.village else "N/A"
                    ),
                    "category": complaint.complaint_type,
                    "status": complaint.status,
                    "priority_level": complaint.priority_level,
                    "created_at": complaint.created_at.isoformat(),
                    "agent_name": complaint.agent_name or None,
                }
            )

        return Response(complaints_data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"error": f"Failed to fetch complaints: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([CanViewAnalytics])
def api_workflow_stats(request):
    """Get workflow statistics (Manager+ only)"""
    try:
        from django.db.models import Count, Q

        total_complaints = Complaint.objects.count()

        # Status-based counts
        pending_statuses = ["received_post", "sent_to_office", "under_analysis"]
        assigned_statuses = ["assigned_worker", "work_in_progress"]
        resolved_statuses = ["work_completed", "villager_satisfied", "case_closed"]

        pending_complaints = Complaint.objects.filter(
            status__in=pending_statuses
        ).count()
        assigned_complaints = Complaint.objects.filter(
            status__in=assigned_statuses
        ).count()
        resolved_complaints = Complaint.objects.filter(
            status__in=resolved_statuses
        ).count()

        stats = {
            "total_complaints": total_complaints,
            "pending_complaints": pending_complaints,
            "assigned_complaints": assigned_complaints,
            "resolved_complaints": resolved_complaints,
        }

        return Response(stats, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"error": f"Failed to fetch stats: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([CanViewAnalytics])
def api_workflow_agents(request):
    """Get list of survey agents (Manager+ only)"""
    try:
        agents = SurveyAgent.objects.prefetch_related(
            "assigned_villages"
        ).all().order_by("name")

        agents_data = []
        for agent in agents:
            # Count active/resolved complaints from survey visits
            active_complaints = Complaint.objects.filter(
                surveyvisit__agent=agent
            ).exclude(
                status__in=["villager_satisfied", "case_closed"]
            ).distinct().count()
            resolved_complaints = Complaint.objects.filter(
                surveyvisit__agent=agent,
                status__in=["villager_satisfied", "case_closed"],
            ).distinct().count()

            agents_data.append(
                {
                    "id": agent.id,
                    "username": agent.employee_id,
                    "full_name": agent.name,
                    "email": "",
                    "phone": agent.phone_number,
                    "assigned_villages": [
                        v.name for v in agent.assigned_villages.all()
                    ],
                    "active_complaints": active_complaints,
                    "resolved_complaints": resolved_complaints,
                    "is_active": True,
                }
            )

        return Response(agents_data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"error": f"Failed to fetch agents: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# =============================================================================
# MOBILE APP SYNC ENDPOINTS
# =============================================================================


@method_decorator(csrf_exempt, name="dispatch")
class MobileGapSyncAPIView(APIView):
    """
    Sync gap from mobile app to Django database.
    Mobile app creates in Firestore first, then syncs to Django.
    POST /api/mobile/gaps/sync/
    """

    permission_classes = [IsAuthenticated]  # Requires authentication
    authentication_classes = [TokenAuthentication, SessionAuthentication]

    VALID_GAP_TYPES = [
        "water",
        "road",
        "sanitation",
        "electricity",
        "education",
        "health",
        "housing",
        "agriculture",
        "connectivity",
        "employment",
        "community_center",
        "drainage",
        "other",
    ]

    VALID_SEVERITIES = ["low", "medium", "high"]
    VALID_INPUT_METHODS = ["image", "voice", "text"]

    def post(self, request):
        try:
            # Input validation
            firestore_id = request.data.get("firestore_id")
            village_id = request.data.get("village_id")
            village_name = request.data.get("village_name", "").strip()
            description = request.data.get("description", "").strip()
            gap_type = request.data.get("gap_type", "other")
            severity = request.data.get("severity", "medium")
            input_method = request.data.get("input_method", "text")
            recommendations = request.data.get("recommendations", "").strip()
            latitude = request.data.get("latitude")
            longitude = request.data.get("longitude")
            audio_url = request.data.get("audio_url", "").strip()
            image_url = request.data.get("image_url", "").strip()
            submitted_by = request.data.get("submitted_by")
            submitted_by_email = request.data.get("submitted_by_email")

            # Validate required fields
            if not description:
                return Response(
                    {"success": False, "error": "Description is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ✅ IMPROVED: Validate description length (increased limit)
            if len(description) > 5000:
                return Response(
                    {
                        "success": False,
                        "error": "Description too long (max 5000 characters)",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ✅ NEW: Validate email format if provided
            email = request.data.get("email", "").strip() if request.data.get("email") else ""
            if email and not re.match(
                r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email
            ):
                return Response(
                    {"success": False, "error": "Invalid email format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ✅ NEW: Validate phone number format (Indian format) if provided
            phone = request.data.get("phone", "").strip() if request.data.get("phone") else ""
            if phone and not re.match(r"^[6-9]\d{9}$", phone):
                return Response(
                    {
                        "success": False,
                        "error": "Invalid phone number. Please enter 10-digit Indian mobile number starting with 6, 7, 8, or 9",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate gap_type
            if gap_type not in self.VALID_GAP_TYPES:
                gap_type = "other"

            # Validate severity
            if severity not in self.VALID_SEVERITIES:
                severity = "medium"

            # Validate input_method
            if input_method not in self.VALID_INPUT_METHODS:
                input_method = "text"

            # Validate coordinates
            if latitude is not None:
                try:
                    lat = float(latitude)
                    if not (-90 <= lat <= 90):
                        return Response(
                            {"success": False, "error": "Invalid latitude (-90 to 90)"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    latitude = lat
                except (ValueError, TypeError):
                    return Response(
                        {"success": False, "error": "Invalid latitude format"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if longitude is not None:
                try:
                    lng = float(longitude)
                    if not (-180 <= lng <= 180):
                        return Response(
                            {
                                "success": False,
                                "error": "Invalid longitude (-180 to 180)",
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    longitude = lng
                except (ValueError, TypeError):
                    return Response(
                        {"success": False, "error": "Invalid longitude format"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Validate URLs (prevent XSS)
            if audio_url and not audio_url.startswith(("http://", "https://")):
                return Response(
                    {"success": False, "error": "Invalid audio URL format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if image_url and not image_url.startswith(("http://", "https://")):
                return Response(
                    {"success": False, "error": "Invalid image URL format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find or create village (with atomic operation to prevent race condition)
            village = None
            if village_id:
                try:
                    village = Village.objects.get(id=village_id)
                except (Village.DoesNotExist, ValueError):
                    # Try to find by name
                    if village_name:
                        with transaction.atomic():
                            village, created = Village.objects.get_or_create(
                                name__iexact=village_name.strip(),
                                defaults={"name": village_name.strip()},
                            )
            elif village_name:
                with transaction.atomic():
                    village, created = Village.objects.get_or_create(
                        name__iexact=village_name.strip(),
                        defaults={"name": village_name.strip()},
                    )

            if not village:
                return Response(
                    {"success": False, "error": "Village is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Create the gap in Django database
            with transaction.atomic():
                gap = Gap.objects.create(
                    village=village,
                    description=description,
                    gap_type=gap_type,
                    severity=severity,
                    status="open",
                    input_method=input_method,
                    recommendations=recommendations,
                    latitude=latitude if latitude else None,
                    longitude=longitude if longitude else None,
                )

                # Create audit log for new gap creation
                from .models import GapStatusAuditLog

                GapStatusAuditLog.objects.create(
                    gap=gap,
                    old_status=None,
                    new_status="open",
                    changed_by=None,  # Mobile user - can be enhanced with Firebase UID lookup
                    notes=f"Created via mobile app. Firestore ID: {firestore_id or 'N/A'}",
                    source="mobile_app",
                )

            # Store Firestore reference in notes/metadata if needed
            # The firestore_id can be used for lookups later

            return Response(
                {
                    "success": True,
                    "message": "Gap synced to database successfully",
                    "django_id": gap.id,
                    "firestore_id": firestore_id,
                    "gap_type": gap.gap_type,
                    "severity": gap.severity,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            import traceback

            traceback.print_exc()
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def api_mobile_gap_status_sync(request, firestore_id):
    """
    Sync gap status update from mobile app.
    Mobile app updates Firestore first, then syncs status to Django.
    POST /api/mobile/gaps/<firestore_id>/status/
    """
    try:
        new_status = request.data.get("status")
        django_id = request.data.get("django_id")
        resolved_by = request.data.get("resolved_by")
        resolved_at = request.data.get("resolved_at")

        if not new_status or new_status not in ["open", "in_progress", "resolved"]:
            return Response(
                {"success": False, "error": "Invalid status"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find gap by django_id if provided
        gap = None
        if django_id:
            try:
                gap = Gap.objects.get(id=django_id)
            except Gap.DoesNotExist:
                pass

        if not gap:
            # Try to find most recent gap - could add firestore_id field later for exact match
            return Response(
                {"success": False, "error": "Gap not found in database"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Update status
        gap.status = new_status
        if new_status == "resolved" and resolved_at:
            from django.utils import timezone

            gap.actual_completion = timezone.now()
        gap.save()

        # Sync back to Firestore for consistency
        try:
            from .firebase_utils import sync_gap_to_firestore

            sync_gap_to_firestore(gap)
        except Exception as fb_err:
            print(f"Firebase sync warning: {fb_err}")

        return Response(
            {
                "success": True,
                "message": f"Gap status updated to {new_status}",
                "django_id": gap.id,
                "status": gap.status,
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes(
    [AllowAny]
)  # Mobile app sends Firebase token; Django AI endpoint is public for now
def api_analyze_media(request):
    """
    Analyze uploaded image or audio using AI to auto-generate description and categorization
    POST /api/analyze-media/

    Request body:
    {
        "media_url": "https://firebasestorage.googleapis.com/...",
        "media_type": "image" or "audio",
        "language": "hi" (optional, for audio transcription)
    }

    Response:
    {
        "success": true,
        "description": "Pothole on main road causing traffic issues",
        "gap_type": "road",
        "severity": "high",
        "confidence": 0.85
    }
    """
    import google.generativeai as genai
    import requests
    import tempfile

    try:
        # Accept either a direct file upload or a media URL
        uploaded_file = request.FILES.get("file")
        media_url = request.data.get("media_url")
        media_type = request.data.get("media_type", "image")
        language = request.data.get("language", "hi")

        if not uploaded_file and not media_url:
            return Response(
                {"error": "Either 'file' (upload) or 'media_url' is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if GEMINI_API_KEY is configured
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return Response(
                {"error": "GEMINI_API_KEY not configured on server"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Save file to temp path (from upload or URL download)
        suffix = ".jpg" if media_type == "image" else ".m4a"
        tmp_path = None

        if uploaded_file:
            # Direct file upload from mobile app
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                for chunk in uploaded_file.chunks():
                    tmp_file.write(chunk)
                tmp_path = tmp_file.name
        else:
            # Download from URL (Cloudinary/Firebase)
            dl_response = requests.get(media_url, timeout=30)
            if dl_response.status_code != 200:
                return Response(
                    {"error": "Failed to download media from URL"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                tmp_file.write(dl_response.content)
                tmp_path = tmp_file.name

        # Configure Gemini AI
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        gap_types_list = """
- water: Water supply issues, pipeline problems, water quality
- road: Road damage, potholes, road construction needs
- sanitation: Drainage, sewage, waste management
- electricity: Power supply, street lights, electrical issues
- education: School infrastructure, teacher needs
- health: Medical facilities, healthcare access
- housing: Housing infrastructure, building issues  
- agriculture: Irrigation, farming equipment, crop issues
- connectivity: Internet, mobile network issues
- employment: Job opportunities, skill training
- community_center: Community halls, public gathering spaces
- drainage: Water logging, drainage system issues
- other: Any other community issues
"""

        severity_levels = """
- low: Minor inconvenience, can wait
- medium: Notable issue, needs attention soon
- high: Serious problem, urgent action needed
"""

        if media_type == "image":
            try:
                # Upload image to Gemini
                uploaded_gemini_file = genai.upload_file(tmp_path)

                # Generate analysis prompt
                prompt = f"""Analyze this image of a community infrastructure problem or gap.

Gap types to choose from:
{gap_types_list}

Severity levels:
{severity_levels}

Provide a response in JSON format with:
1. "description": A clear 1-2 sentence description of the problem in English
2. "gap_type": The most appropriate category from the list above
3. "severity": The severity level (low/medium/high)
4. "confidence": Your confidence in this categorization (0.0 to 1.0)

Response must be valid JSON only, no additional text."""

                # Get AI response
                ai_response = model.generate_content([prompt, uploaded_gemini_file])

                # Parse JSON from response
                response_text = ai_response.text.strip()
                # Remove markdown code blocks if present
                if response_text.startswith("```json"):
                    response_text = (
                        response_text.replace("```json", "").replace("```", "").strip()
                    )
                elif response_text.startswith("```"):
                    response_text = response_text.replace("```", "").strip()

                analysis = json.loads(response_text)

                # Clean up
                os.unlink(tmp_path)

                return Response(
                    {
                        "success": True,
                        "description": analysis.get("description", ""),
                        "gap_type": analysis.get("gap_type", "other"),
                        "severity": analysis.get("severity", "medium"),
                        "confidence": analysis.get("confidence", 0.7),
                    },
                    status=status.HTTP_200_OK,
                )

            except Exception as e:
                # Clean up on error
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                raise e

        elif media_type == "audio":
            # For audio, use AssemblyAI for transcription + Gemini for analysis
            from .services import ComplaintProcessor

            try:
                # Process audio using existing service
                processor = ComplaintProcessor()

                # Transcribe audio
                transcription = processor.speech_service.transcribe_audio(
                    tmp_path, language
                )

                if not transcription["success"]:
                    os.unlink(tmp_path)
                    return Response(
                        {
                            "error": f"Transcription failed: {transcription.get('error', 'Unknown error')}"
                        },
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                # Analyze transcribed text with Gemini
                prompt = f"""Analyze this transcribed complaint from a villager:

"{transcription['text']}"

Gap types to choose from:
{gap_types_list}

Severity levels:
{severity_levels}

Provide a response in JSON format with:
1. "description": A clear 1-2 sentence English description of the problem
2. "gap_type": The most appropriate category from the list above
3. "severity": The severity level (low/medium/high)
4. "confidence": Your confidence in this categorization (0.0 to 1.0)

Response must be valid JSON only, no additional text."""

                ai_response = model.generate_content(prompt)

                # Parse JSON from response
                response_text = ai_response.text.strip()
                if response_text.startswith("```json"):
                    response_text = (
                        response_text.replace("```json", "").replace("```", "").strip()
                    )
                elif response_text.startswith("```"):
                    response_text = response_text.replace("```", "").strip()

                analysis = json.loads(response_text)

                # Clean up
                os.unlink(tmp_path)

                return Response(
                    {
                        "success": True,
                        "transcription": transcription["text"],
                        "description": analysis.get("description", ""),
                        "gap_type": analysis.get("gap_type", "other"),
                        "severity": analysis.get("severity", "medium"),
                        "confidence": analysis.get("confidence", 0.7),
                    },
                    status=status.HTTP_200_OK,
                )

            except Exception as e:
                # Clean up on error
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                raise e
        else:
            return Response(
                {"error": "media_type must be 'image' or 'audio'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    except json.JSONDecodeError as e:
        return Response(
            {"error": f"Failed to parse AI response as JSON: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        return Response(
            {"error": f"AI analysis failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
