from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from .permissions import (
    CanCreateGaps,
    CanVerifyGaps,
    CanResolveGaps,
    CanViewAnalytics,
    CanManageBudget,
)
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from datetime import datetime
import os
import json
import uuid

from .models import Complaint, Village, PostOffice, QRSubmission, Gap, SurveyAgent
from .serializers import (
    ComplaintSerializer,
    VillageSerializer,
    PostOfficeSerializer,
    PhotoUploadSerializer,
    OfflineDataSyncSerializer,
    QRSubmissionSerializer,
)
from django.db.models import Count


class ComplaintViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing complaints
    GET /api/complaints/ - List all complaints
    GET /api/complaints/{id}/ - Get specific complaint
    GET /api/complaints/by_complaint_id/{complaint_id}/ - Get by complaint ID
    """

    queryset = Complaint.objects.all().order_by("-created_at")
    serializer_class = ComplaintSerializer
    permission_classes = [AllowAny]  # Change to appropriate permissions in production

    @action(
        detail=False,
        methods=["get"],
        url_path="by_complaint_id/(?P<complaint_id>[^/.]+)",
    )
    def by_complaint_id(self, request, complaint_id=None):
        """Get complaint by complaint_id (e.g., PMC2024001)"""
        complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
        serializer = self.get_serializer(complaint)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Search complaints by various parameters"""
        query = request.query_params.get("q", "")
        status_filter = request.query_params.get("status", "")

        queryset = self.queryset

        if query:
            queryset = queryset.filter(complaint_id__icontains=query) | queryset.filter(
                villager_name__icontains=query
            )

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class VillageViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for viewing villages"""

    queryset = Village.objects.all().order_by("name")
    serializer_class = VillageSerializer
    permission_classes = [AllowAny]


class PostOfficeViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for viewing post offices"""

    queryset = PostOffice.objects.all().order_by("name")
    serializer_class = PostOfficeSerializer
    permission_classes = [AllowAny]


@method_decorator(csrf_exempt, name="dispatch")
class QRSubmissionAPIView(APIView):
    """
    API endpoint for QR code submissions
    GET /api/qr-submissions/ - List all submissions
    POST /api/qr-submissions/ - Create new submission
    """

    permission_classes = [AllowAny]

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


@api_view(["POST"])
def upload_photo(request):
    """
    Upload a photo for a specific complaint
    POST /api/upload-photo/
    Body: {
        "complaint_id": "PMC2024001",
        "photo": <file>,
        "latitude": 28.4595,
        "longitude": 77.0266,
        "timestamp": "2024-01-15T10:30:00Z"
    }
    """
    # Log request data for debugging
    print(f"Upload photo request - Data: {request.data.keys()}")
    print(f"Files: {request.FILES.keys()}")
    print(f"Complaint ID: {request.data.get('complaint_id')}")

    serializer = PhotoUploadSerializer(data=request.data)

    if serializer.is_valid():
        complaint_id = serializer.validated_data["complaint_id"]
        photo = serializer.validated_data["photo"]
        latitude = serializer.validated_data.get("latitude")
        longitude = serializer.validated_data.get("longitude")

        try:
            complaint = Complaint.objects.get(complaint_id=complaint_id)
        except Complaint.DoesNotExist:
            return Response(
                {"error": f"Complaint {complaint_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Save photo to media directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"complaint_photos/{complaint_id}_{timestamp}_{photo.name}"
        path = default_storage.save(filename, ContentFile(photo.read()))

        # Update complaint's geotagged_photos list
        if complaint.geotagged_photos is None:
            complaint.geotagged_photos = []

        photo_data = {
            "path": path,
            "url": default_storage.url(path),
            "uploaded_at": datetime.now().isoformat(),
        }

        if latitude and longitude:
            photo_data["latitude"] = str(latitude)
            photo_data["longitude"] = str(longitude)

        complaint.geotagged_photos.append(photo_data)
        complaint.save()

        print(f"Photo uploaded successfully: {path}")

        return Response(
            {
                "success": True,
                "message": "Photo uploaded successfully",
                "complaint_id": complaint_id,
                "photo_url": default_storage.url(path),
            },
            status=status.HTTP_201_CREATED,
        )

    print(f"Validation errors: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def sync_offline_data(request):
    """
    Sync offline collected data (multiple photos and notes)
    POST /api/sync-offline/
    Body: {
        "complaint_id": "PMC2024001",
        "photos": [<file1>, <file2>, ...],
        "notes": "Additional notes",
        "latitude": 28.4595,
        "longitude": 77.0266,
        "collected_at": "2024-01-15T10:30:00Z"
    }
    """
    complaint_id = request.data.get("complaint_id")

    if not complaint_id:
        return Response(
            {"error": "complaint_id is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        complaint = Complaint.objects.get(complaint_id=complaint_id)
    except Complaint.DoesNotExist:
        return Response(
            {"error": f"Complaint {complaint_id} not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Process multiple photos
    uploaded_photos = []
    photos = request.FILES.getlist("photos")

    for photo in photos:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"complaint_photos/{complaint_id}_{timestamp}_{photo.name}"
        path = default_storage.save(filename, ContentFile(photo.read()))
        uploaded_photos.append(default_storage.url(path))

    return Response(
        {
            "success": True,
            "message": f"Synced {len(uploaded_photos)} photos for complaint {complaint_id}",
            "complaint_id": complaint_id,
            "photos_uploaded": len(uploaded_photos),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
def test_upload(request):
    """
    Test endpoint to debug photo uploads
    """
    print("=" * 50)
    print("TEST UPLOAD ENDPOINT")
    print("=" * 50)
    print(f"Request method: {request.method}")
    print(f"Content-Type: {request.content_type}")
    print(f"POST data keys: {list(request.POST.keys())}")
    print(f"FILES keys: {list(request.FILES.keys())}")
    print(f"Data keys: {list(request.data.keys())}")

    for key in request.POST.keys():
        print(f"POST[{key}] = {request.POST[key]}")

    for key in request.FILES.keys():
        file = request.FILES[key]
        print(
            f"FILE[{key}] = {file.name}, size={file.size}, content_type={file.content_type}"
        )

    return Response(
        {
            "success": True,
            "message": "Test successful",
            "received_post": list(request.POST.keys()),
            "received_files": list(request.FILES.keys()),
        }
    )


@api_view(["POST"])
def upload_gap_photo(request):
    """
    Upload a photo for a gap and optionally update its status
    POST /api/upload-gap-photo/
    Body: {
        "gap_id": 12,
        "photo": <file>,
        "status": "resolved" (optional)
    }
    """
    from .models import Gap

    gap_id = request.data.get("gap_id")
    new_status = request.data.get("status")

    if not gap_id:
        return Response(
            {"error": "gap_id is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        gap = Gap.objects.get(id=gap_id)
    except Gap.DoesNotExist:
        return Response(
            {"error": f"Gap {gap_id} not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # Process photo if provided
    photo_url = None
    if "photo" in request.FILES:
        photo = request.FILES["photo"]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"gap_photos/gap_{gap_id}_{timestamp}_{photo.name}"
        path = default_storage.save(filename, ContentFile(photo.read()))
        photo_url = default_storage.url(path)

    # Update status if provided
    if new_status and new_status in ["open", "in_progress", "resolved"]:
        gap.status = new_status
        gap.save()

    return Response(
        {
            "success": True,
            "message": "Gap updated successfully",
            "gap_id": gap_id,
            "photo_url": photo_url,
            "status": gap.status,
        },
        status=status.HTTP_200_OK,
    )


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
            role = "user"
            try:
                if hasattr(user, "userprofile"):
                    role = user.userprofile.role
                elif user.is_superuser:
                    role = "admin"
                elif user.is_staff:
                    role = "manager"
            except:
                pass

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

    permission_classes = [AllowAny]

    def post(self, request):
        return Response({"success": True, "message": "Logged out successfully"})


@api_view(["GET"])
@permission_classes([AllowAny])
def get_user_profile(request):
    """Get current user profile"""
    if request.user.is_authenticated:
        role = "user"
        try:
            if hasattr(request.user, "userprofile"):
                role = request.user.userprofile.role
            elif request.user.is_superuser:
                role = "admin"
            elif request.user.is_staff:
                role = "manager"
        except:
            pass

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
    return Response({"error": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)


# =============================================================================
# JSON API ENDPOINTS FOR NEXT.JS FRONTEND
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_villages_list(request):
    """JSON API endpoint to list all villages with gap statistics"""
    villages = Village.objects.all()
    villages_data = []

    for village in villages:
        gaps = Gap.objects.filter(village=village)
        open_gaps = gaps.filter(status="open").count()
        in_progress_gaps = gaps.filter(status="in_progress").count()
        resolved_gaps = gaps.filter(status="resolved").count()
        total_gaps = gaps.count()
        high_severity = gaps.filter(severity="high").count()
        medium_severity = gaps.filter(severity="medium").count()
        low_severity = gaps.filter(severity="low").count()

        villages_data.append(
            {
                "id": village.id,
                "name": village.name,
                "total_gaps": total_gaps,
                "open_gaps": open_gaps,
                "in_progress_gaps": in_progress_gaps,
                "resolved_gaps": resolved_gaps,
                "high_severity": high_severity,
                "medium_severity": medium_severity,
                "low_severity": low_severity,
            }
        )

    return Response({"villages": villages_data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_gaps_list(request):
    """JSON API endpoint to list all gaps with filters"""
    gaps = Gap.objects.select_related("village").all().order_by("-id")

    # Apply filters
    status_filter = request.GET.get("status")
    if status_filter:
        gaps = gaps.filter(status=status_filter)

    severity_filter = request.GET.get("severity")
    if severity_filter:
        gaps = gaps.filter(severity=severity_filter)

    village_filter = request.GET.get("village")
    if village_filter:
        gaps = gaps.filter(village_id=village_filter)

    gap_type_filter = request.GET.get("gap_type")
    if gap_type_filter:
        gaps = gaps.filter(gap_type=gap_type_filter)

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
                "budget_allocated": (
                    float(gap.budget_allocated) if gap.budget_allocated else None
                ),
                "budget_spent": float(gap.budget_spent) if gap.budget_spent else 0,
                "latitude": float(gap.latitude) if gap.latitude else None,
                "longitude": float(gap.longitude) if gap.longitude else None,
                "audio_file": gap.audio_file.url if gap.audio_file else None,
            }
        )

    return Response({"gaps": gaps_data})


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
            "budget_allocated": (
                float(gap.budget_allocated) if gap.budget_allocated else None
            ),
            "budget_spent": float(gap.budget_spent) if gap.budget_spent else 0,
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
@permission_classes([IsAuthenticated])
def api_update_gap_status(request, gap_id):
    """JSON API endpoint to update gap status"""
    from .permissions import can_resolve_gaps

    try:
        gap = Gap.objects.get(id=gap_id)
        new_status = request.data.get("status")

        # Check if trying to resolve - requires authority+
        if new_status == "resolved" and not can_resolve_gaps(request.user):
            return Response(
                {
                    "success": False,
                    "error": "Only Authority or Admin can mark gaps as resolved",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if new_status and new_status in ["open", "in_progress", "resolved"]:
            gap.status = new_status
            gap.save()
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
                            model = genai.GenerativeModel("gemini-pro")

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

                try:
                    from PIL import Image

                    gemini_key = os.getenv("GEMINI_API_KEY")

                    if gemini_key:
                        genai.configure(api_key=gemini_key)
                        model = genai.GenerativeModel("gemini-1.5-flash")

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

            # Create the gap
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

            # Save audio file to gap
            if "audio_file" in request.FILES:
                gap.audio_file = request.FILES["audio_file"]
                gap.save()

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
@permission_classes([IsAuthenticated])
def api_dashboard_stats(request):
    """JSON API endpoint for dashboard statistics"""
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

    # Recent gaps
    recent_gaps = []
    for gap in gaps.order_by("-created_at")[:5]:
        recent_gaps.append(
            {
                "id": gap.id,
                "village_name": gap.village.name,
                "gap_type": gap.gap_type,
                "severity": gap.severity,
                "status": gap.status,
                "created_at": gap.created_at.isoformat() if gap.created_at else None,
            }
        )

    # Villages data
    villages_data = []
    for village in villages_qs:
        v_gaps = Gap.objects.filter(village=village)
        villages_data.append(
            {
                "id": village.id,
                "name": village.name,
                "total_gaps": v_gaps.count(),
                "open_gaps": v_gaps.filter(status="open").count(),
                "in_progress_gaps": v_gaps.filter(status="in_progress").count(),
                "resolved_gaps": v_gaps.filter(status="resolved").count(),
            }
        )

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

    # Village-wise gaps
    village_gaps = []
    for village in Village.objects.all():
        v_gaps = Gap.objects.filter(village=village)
        village_gaps.append(
            {
                "id": village.id,
                "name": village.name,
                "total": v_gaps.count(),
                "open": v_gaps.filter(status="open").count(),
                "in_progress": v_gaps.filter(status="in_progress").count(),
                "resolved": v_gaps.filter(status="resolved").count(),
            }
        )

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
# BUDGET API ENDPOINTS
# =============================================================================


@api_view(["GET"])
@permission_classes([CanManageBudget])
def api_budget_list(request):
    """Get budget data for all gaps"""
    from django.db.models import Sum

    # Get filters
    village_id = request.GET.get("village", "")
    gap_type = request.GET.get("category", "")

    gaps = Gap.objects.select_related("village").all()

    if village_id:
        gaps = gaps.filter(village_id=village_id)
    if gap_type:
        gaps = gaps.filter(gap_type=gap_type)

    budget_items = []
    for gap in gaps:
        if gap.budget_allocated or gap.budget_spent:
            budget_items.append(
                {
                    "id": gap.id,
                    "village_name": gap.village.name if gap.village else "N/A",
                    "category": gap.gap_type,
                    "allocated_amount": float(gap.budget_allocated or 0),
                    "spent_amount": float(gap.budget_spent or 0),
                    "remaining_amount": float(
                        (gap.budget_allocated or 0) - (gap.budget_spent or 0)
                    ),
                    "fiscal_year": "2024",
                    "status": gap.status,
                    "description": gap.description[:100] if gap.description else "",
                }
            )

    return Response(
        {
            "items": budget_items,
            "total_items": len(budget_items),
        }
    )


@api_view(["GET"])
@permission_classes([CanManageBudget])
def api_budget_summary(request):
    """Get budget summary statistics"""
    from django.db.models import Sum

    gaps = Gap.objects.all()

    total_allocated = gaps.aggregate(total=Sum("budget_allocated"))["total"] or 0
    total_spent = gaps.aggregate(total=Sum("budget_spent"))["total"] or 0
    total_remaining = total_allocated - total_spent

    utilization = (total_spent / total_allocated * 100) if total_allocated > 0 else 0

    return Response(
        {
            "total_allocated": float(total_allocated),
            "total_spent": float(total_spent),
            "total_remaining": float(total_remaining),
            "utilization_percentage": round(utilization, 1),
        }
    )


@api_view(["POST"])
@permission_classes([CanManageBudget])
def api_budget_update(request, gap_id):
    """Update budget for a gap"""
    try:
        gap = Gap.objects.get(id=gap_id)

        budget_allocated = request.data.get("budget_allocated")
        budget_spent = request.data.get("budget_spent")

        if budget_allocated is not None:
            gap.budget_allocated = budget_allocated
        if budget_spent is not None:
            gap.budget_spent = budget_spent

        gap.save()

        return Response(
            {
                "success": True,
                "message": "Budget updated successfully",
                "gap_id": gap.id,
                "budget_allocated": float(gap.budget_allocated or 0),
                "budget_spent": float(gap.budget_spent or 0),
            }
        )

    except Gap.DoesNotExist:
        return Response({"error": "Gap not found"}, status=status.HTTP_404_NOT_FOUND)


# =============================================================================
# PUBLIC DASHBOARD API ENDPOINTS
# =============================================================================


@api_view(["GET"])
@permission_classes([AllowAny])
def api_public_dashboard(request):
    """Public dashboard data - no authentication required"""
    from django.db.models import Sum, Count

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

    # Budget data
    total_budget = gaps.aggregate(total=Sum("budget_allocated"))["total"] or 0
    spent_budget = gaps.aggregate(total=Sum("budget_spent"))["total"] or 0

    # Gap type distribution
    gap_types_list = gaps.values("gap_type").annotate(count=Count("id"))
    gap_types = {item["gap_type"]: item["count"] for item in gap_types_list}

    # Severity distribution
    severity_data = {
        "high": gaps.filter(severity="high").count(),
        "medium": gaps.filter(severity="medium").count(),
        "low": gaps.filter(severity="low").count(),
    }

    # Village-wise data
    village_data = []
    for village in Village.objects.all():
        v_gaps = gaps.filter(village=village)
        if v_gaps.exists():
            village_data.append(
                {
                    "id": village.id,
                    "name": village.name,
                    "total_gaps": v_gaps.count(),
                    "resolved": v_gaps.filter(status="resolved").count(),
                    "pending": v_gaps.filter(status="open").count(),
                    "in_progress": v_gaps.filter(status="in_progress").count(),
                    "lat": getattr(village, "latitude", None)
                    or 26.0 + village.id * 0.1,
                    "lng": getattr(village, "longitude", None)
                    or 80.0 + village.id * 0.1,
                }
            )

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
            "total_budget": float(total_budget),
            "spent_budget": float(spent_budget),
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
@permission_classes([AllowAny])
def api_resolve_gap_with_voice(request, gap_id):
    """Resolve a gap after successful voice verification"""
    from .models import VoiceVerificationLog
    from .permissions import can_resolve_gaps

    try:
        gap = Gap.objects.get(id=gap_id)

        # Check if user can resolve gaps (AUTHORITY or ADMIN only)
        if request.user.is_authenticated and not can_resolve_gaps(request.user):
            return Response(
                {
                    "success": False,
                    "error": "Only Authority or Admin can resolve gaps",
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
@permission_classes([IsAuthenticated])
def api_workflow_complaints(request):
    """Get list of complaints with optional filtering"""
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
                    "gap_description": complaint.gap_description,
                    "village_name": (
                        complaint.village.name if complaint.village else "N/A"
                    ),
                    "category": complaint.complaint_type,
                    "status": complaint.status,
                    "priority_level": complaint.priority_level,
                    "created_at": complaint.created_at.isoformat(),
                    "assigned_agent": (
                        complaint.assigned_worker.name
                        if complaint.assigned_worker
                        else None
                    ),
                }
            )

        return Response(complaints_data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"error": f"Failed to fetch complaints: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_workflow_stats(request):
    """Get workflow statistics"""
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
@permission_classes([IsAuthenticated])
def api_workflow_agents(request):
    """Get list of survey agents"""
    try:
        agents = SurveyAgent.objects.filter(is_active=True).order_by("name")

        agents_data = []
        for agent in agents:
            agents_data.append(
                {
                    "id": agent.id,
                    "username": agent.username,
                    "name": agent.name,
                    "email": agent.email,
                    "phone": agent.phone_number,
                    "is_active": agent.is_active,
                }
            )

        return Response(agents_data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {"error": f"Failed to fetch agents: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
