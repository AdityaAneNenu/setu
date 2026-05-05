import json
import logging
import mimetypes
import os
import re
import threading
import time
from io import BytesIO
from urllib.parse import urlsplit

from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .firebase_auth import FirebaseAuthentication
from .models import Complaint, Gap, SurveyAgent, Village
from .permissions import (
    CanCreateGaps,
    CanResolveGaps,
    CanVerifyGaps,
    CanViewAnalytics,
)
from .utils.verification import (
    hamming_distance_64 as _hamming_distance_64,
    hash_image_file as _hash_image_file,
    haversine_m as _haversine_m,
)

logger = logging.getLogger(__name__)


def _sync_gap_to_firestore_async(gap_id):
    """Best-effort Firestore sync that must never block request responses."""
    try:
        from .firebase_utils import sync_gap_to_firestore

        gap = Gap.objects.filter(id=gap_id).first()
        if gap is None:
            return
        sync_gap_to_firestore(gap)
    except Exception as fb_err:
        logger.warning("Firebase async sync warning for gap %s: %s", gap_id, fb_err)


def _fetch_image_from_url(url):
    import requests
    from PIL import Image
    from io import BytesIO

    max_image_bytes = 5 * 1024 * 1024
    resp = requests.get(url, timeout=10, stream=True)
    resp.raise_for_status()

    content_length = resp.headers.get("Content-Length")
    if content_length and int(content_length) > max_image_bytes:
        raise ValueError("Image too large. Maximum supported size is 5 MB.")

    chunks = []
    total_bytes = 0
    for chunk in resp.iter_content(chunk_size=64 * 1024):
        if not chunk:
            continue
        total_bytes += len(chunk)
        if total_bytes > max_image_bytes:
            raise ValueError("Image too large. Maximum supported size is 5 MB.")
        chunks.append(chunk)

    return Image.open(BytesIO(b"".join(chunks)))


def _is_truthy(value):
    """Normalize common truthy string/boolean values."""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _complaint_resolution_banner(complaint):
    if complaint.uses_resolution_letter and not complaint.resolution_letter_image:
        return "Resolution letter upload is still pending."
    if (
        complaint.requires_selfie_gps_verification
        and not complaint.is_submission_verification_ready
    ):
        return complaint.verification_block_reason
    if complaint.requires_selfie_gps_verification and not complaint.closure_selfie:
        return "Waiting for closure selfie and on-site GPS verification."
    return ""


MOBILE_OPEN_STATUSES = {
    "open",
    "pending",
    "received_post",
    "sent_to_office",
    "under_analysis",
    "escalated",
    "villager_unsatisfied",
}
MOBILE_IN_PROGRESS_STATUSES = {
    "in_progress",
    "needs_review",
    "assigned_worker",
    "work_in_progress",
    "work_completed",
    "sent_to_villager",
}
MOBILE_RESOLVED_STATUSES = {
    "resolved",
    "closed",
    "villager_satisfied",
    "case_closed",
}


def _mobile_ui_status(raw_status):
    status_value = (raw_status or "").strip().lower()
    if status_value in MOBILE_IN_PROGRESS_STATUSES:
        return "IN_PROGRESS"
    if status_value in MOBILE_RESOLVED_STATUSES:
        return "RESOLVED"
    return "OPEN"


def _mobile_gap_status(raw_status):
    normalized = str(raw_status or "").strip().lower().replace(" ", "_")
    if normalized in {
        "in_progress",
        "in-progress",
        "work_in_progress",
        "needs_review",
        "needs_retry",
    }:
        return "IN_PROGRESS"
    if normalized in {"resolved", "closed", "case_closed"}:
        return "RESOLVED"
    return "OPEN"


def _load_gap_image_for_ai(gap, closure_photo_url=""):
    from PIL import Image

    initial_img = None
    closure_img = None

    if gap.initial_photo_url:
        try:
            initial_img = _fetch_image_from_url(gap.initial_photo_url).convert("RGB")
        except Exception as initial_err:
            logger.warning(
                "Could not load initial photo for gap %s: %s", gap.id, initial_err
            )

    if closure_photo_url:
        try:
            closure_img = _fetch_image_from_url(closure_photo_url).convert("RGB")
        except Exception as closure_err:
            logger.warning(
                "Could not load closure photo URL for gap %s: %s", gap.id, closure_err
            )

    if closure_img is None and gap.resolution_proof:
        try:
            with gap.resolution_proof.open("rb") as proof_file:
                closure_img = Image.open(BytesIO(proof_file.read())).convert("RGB")
        except Exception as proof_err:
            logger.warning(
                "Could not load proof file for gap %s: %s", gap.id, proof_err
            )

    return initial_img, closure_img


def _compute_resolution_ai_score(gap, closure_photo_url=""):
    """Return (score, method, note) where score is normalized in [0, 1]."""
    initial_img, closure_img = _load_gap_image_for_ai(
        gap, closure_photo_url=closure_photo_url
    )
    if initial_img is None or closure_img is None:
        return (
            None,
            "unavailable",
            "Initial or closure image not available for AI comparison",
        )

    try:
        import cv2
        import numpy as np

        before = cv2.cvtColor(
            np.array(initial_img.resize((256, 256))), cv2.COLOR_RGB2BGR
        )
        after = cv2.cvtColor(
            np.array(closure_img.resize((256, 256))), cv2.COLOR_RGB2BGR
        )

        gray_before = cv2.cvtColor(before, cv2.COLOR_BGR2GRAY)
        gray_after = cv2.cvtColor(after, cv2.COLOR_BGR2GRAY)

        pixel_diff_score = float(cv2.absdiff(gray_before, gray_after).mean() / 255.0)

        hist_before = cv2.calcHist([gray_before], [0], None, [64], [0, 256])
        hist_after = cv2.calcHist([gray_after], [0], None, [64], [0, 256])
        cv2.normalize(hist_before, hist_before)
        cv2.normalize(hist_after, hist_after)
        correlation = float(
            cv2.compareHist(hist_before, hist_after, cv2.HISTCMP_CORREL)
        )
        hist_change_score = max(0.0, min(1.0, (1.0 - correlation) / 2.0))

        edge_before = cv2.Canny(gray_before, 80, 160)
        edge_after = cv2.Canny(gray_after, 80, 160)
        edge_change_score = float(cv2.absdiff(edge_before, edge_after).mean() / 255.0)

        score = (
            0.55 * pixel_diff_score
            + 0.30 * hist_change_score
            + 0.15 * edge_change_score
        )
        return max(0.0, min(1.0, score)), "opencv", ""
    except Exception as cv_err:
        logger.warning("OpenCV AI scoring failed for gap %s: %s", gap.id, cv_err)

    try:
        from PIL import ImageChops, ImageStat

        before_small = initial_img.resize((256, 256)).convert("RGB")
        after_small = closure_img.resize((256, 256)).convert("RGB")
        diff = ImageChops.difference(before_small, after_small)
        stat = ImageStat.Stat(diff)
        channel_mean = sum(stat.mean) / max(1.0, len(stat.mean))
        score = float(channel_mean / 255.0)
        return max(0.0, min(1.0, score)), "pillow_fallback", ""
    except Exception as pil_err:
        logger.warning(
            "Pillow fallback AI scoring failed for gap %s: %s", gap.id, pil_err
        )

    return None, "unavailable", "AI image scoring unavailable"


def _serialize_mobile_gap(gap):
    resolved_audio = gap.audio_url or (gap.audio_file.url if gap.audio_file else None)
    resolved_photo = gap.closure_photo_url or (
        gap.resolution_proof.url if gap.resolution_proof else None
    )
    resolution_type = gap.resolution_type or (
        "auto" if str(gap.status).strip().lower() == "resolved" else "retry"
    )
    return {
        "id": gap.id,
        "client_local_id": gap.client_local_id,
        "village": gap.village.name if gap.village else "",
        "description": gap.description,
        "severity": gap.severity,
        "raw_status": gap.status,
        "status": _mobile_gap_status(gap.status),
        "created_date": gap.created_at.isoformat() if gap.created_at else None,
        "distance_m": gap.closure_distance_m,
        "resolution_time_minutes": gap.resolution_time_minutes,
        "ai_score": gap.resolution_ai_score,
        "ai_method": gap.resolution_ai_method,
        "resolution_type": resolution_type,
        "review_reason": gap.resolution_review_reason,
        "media": {
            "audio": resolved_audio,
            "photo": resolved_photo,
            "initial_photo": gap.initial_photo_url,
        },
    }


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
        resolved_audio_url = gap.audio_url or (
            gap.audio_file.url if gap.audio_file else None
        )
        after_proof_image = gap.closure_photo_url or (
            gap.resolution_proof.url if gap.resolution_proof else None
        )
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
                "audio_file": resolved_audio_url,
                "audio_url": resolved_audio_url,
                "before_proof_image": gap.initial_photo_url,
                "after_proof_image": after_proof_image,
                "resolution_proof": (
                    gap.resolution_proof.url if gap.resolution_proof else None
                ),
                "closure_photo_url": gap.closure_photo_url,
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


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def api_gap_detail(request, gap_id):
    """JSON API endpoint to get single gap details"""
    try:
        gap = Gap.objects.select_related("village").get(id=gap_id)

        if request.method == "DELETE":
            from .permissions import can_resolve_gaps

            if not can_resolve_gaps(request.user):
                return Response(
                    {
                        "success": False,
                        "error": "Only Admin can delete gaps",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            gap_description = gap.description or ""
            gap.delete()

            # Best effort cleanup for any mirrored Firestore records.
            try:
                from .firebase_utils import get_firestore_client

                firestore_db = get_firestore_client()
                if firestore_db:
                    firestore_db.collection("gaps").document(str(gap_id)).delete()
                    for gap_doc in (
                        firestore_db.collection("gaps")
                        .where("django_id", "==", gap_id)
                        .stream()
                    ):
                        gap_doc.reference.delete()
            except Exception as fs_err:
                logger.warning(
                    "Gap deleted in Django but Firestore cleanup failed for %s: %s",
                    gap_id,
                    fs_err,
                )

            return Response(
                {
                    "success": True,
                    "message": "Gap deleted successfully",
                    "id": gap_id,
                    "description": gap_description,
                }
            )

        resolved_audio_url = gap.audio_url or (
            gap.audio_file.url if gap.audio_file else None
        )
        after_proof_image = gap.closure_photo_url or (
            gap.resolution_proof.url if gap.resolution_proof else None
        )
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
            "audio_file": resolved_audio_url,
            "audio_url": resolved_audio_url,
            "resolution_proof": (
                gap.resolution_proof.url if gap.resolution_proof else None
            ),
            "closure_photo_url": gap.closure_photo_url,
            "before_proof_image": gap.initial_photo_url,
            "after_proof_image": after_proof_image,
            "before_proof_captured_at": (
                gap.created_at.isoformat() if gap.created_at else None
            ),
            "after_proof_captured_at": (
                gap.closure_photo_timestamp.isoformat()
                if gap.closure_photo_timestamp
                else gap.resolved_at.isoformat() if gap.resolved_at else None
            ),
        }
        return Response(data)
    except Gap.DoesNotExist:
        return Response({"error": "Gap not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes([CanVerifyGaps])
def api_update_gap_status(request, gap_id):
    """JSON API endpoint to update gap status (Manager+ can update, Admin can resolve)"""
    from .models import GapStatusAuditLog
    from .permissions import can_resolve_gaps

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
            if new_status == "resolved":
                from django.utils import timezone

                gap.resolved_at = timezone.now()
                gap.actual_completion = timezone.now().date()
                if request.user.is_authenticated:
                    gap.resolved_by = request.user
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
                # âœ… IMPROVED: Enhanced Firebase sync with retry mechanism
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
            import os

            import google.generativeai as genai

            village_id = request.data.get("village")
            description = request.data.get("description", "")
            gap_type = request.data.get("gap_type", "")
            severity = request.data.get("severity", "low")
            submission_type = request.data.get("submission_type", "text")
            language_code = request.data.get("language_code", "hi")
            latitude = request.data.get("latitude")
            longitude = request.data.get("longitude")
            audio_url = (request.data.get("audio_url") or "").strip()

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

            if audio_url and not audio_url.startswith(("http://", "https://")):
                return Response(
                    {"error": "Invalid audio URL format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (
                submission_type == "audio"
                and "audio_file" not in request.FILES
                and not audio_url
            ):
                return Response(
                    {
                        "error": "audio_file or audio_url is required for audio submission"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
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
                            try:
                                ai_data = json.loads(clean_response)
                            except json.JSONDecodeError as json_err:
                                print(f"JSON parsing error: {json_err}")
                                print(f"Response text: {clean_response[:200]}")
                                # Fallback to defaults
                                ai_data = {
                                    "translated_text": description,
                                    "gap_type": "other",
                                    "severity": severity or "medium",
                                    "recommendations": "",
                                }

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

                # âœ… SECURITY: Validate audio file size (max 50MB)
                MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50MB
                if audio_file.size > MAX_AUDIO_SIZE:
                    return Response(
                        {
                            "success": False,
                            "error": "Audio file too large. Maximum size is 50MB.",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Validate audio file type
                allowed_audio_types = [
                    "audio/mpeg",
                    "audio/wav",
                    "audio/ogg",
                    "audio/mp4",
                    "audio/webm",
                ]
                if audio_file.content_type not in allowed_audio_types:
                    return Response(
                        {
                            "success": False,
                            "error": f"Invalid audio file type. Allowed types: {', '.join(allowed_audio_types)}",
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
                                try:
                                    ai_data = json.loads(clean_response)
                                except json.JSONDecodeError as json_err:
                                    print(
                                        f"JSON parsing error in audio translation: {json_err}"
                                    )
                                    print(f"Response text: {clean_response[:200]}")
                                    ai_data = {
                                        "translated_text": transcribed_text,
                                        "gap_type": result.get(
                                            "detected_type", "other"
                                        ),
                                        "severity": result.get(
                                            "priority_level", "medium"
                                        ),
                                        "recommendations": "",
                                    }

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

            elif audio_url:
                input_method = "voice"

            # Handle image file processing
            elif "image" in request.FILES:
                input_method = "image"
                image_file = request.FILES["image"]

                # âœ… SECURITY: Validate image file size (max 10MB)
                MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
                if image_file.size > MAX_IMAGE_SIZE:
                    return Response(
                        {
                            "success": False,
                            "error": "Image file too large. Maximum size is 10MB.",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Validate image file type
                allowed_image_types = [
                    "image/jpeg",
                    "image/png",
                    "image/jpg",
                    "image/webp",
                ]
                if image_file.content_type not in allowed_image_types:
                    return Response(
                        {
                            "success": False,
                            "error": f"Invalid image file type. Allowed types: {', '.join(allowed_image_types)}",
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
                    audio_url=audio_url if audio_url else None,
                )

                # Persist audio for voice submissions (multipart upload only).
                if "audio_file" in request.FILES:
                    audio_file = request.FILES["audio_file"]
                    if audio_file.size > 50 * 1024 * 1024:
                        return Response(
                            {"error": "Audio file too large. Maximum size is 50MB."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    audio_file.seek(0)
                    gap.audio_file = audio_file
                    gap.save(update_fields=["audio_file"])

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
                    "has_audio": bool(gap.audio_file or gap.audio_url),
                    "audio_url": gap.audio_url
                    or (gap.audio_file.url if gap.audio_file else None),
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
        agents = (
            SurveyAgent.objects.prefetch_related("assigned_villages")
            .all()
            .order_by("name")
        )

        agents_data = []
        for agent in agents:
            # Count active/resolved complaints from survey visits
            active_complaints = (
                Complaint.objects.filter(surveyvisit__agent=agent)
                .exclude(status__in=["villager_satisfied", "case_closed"])
                .distinct()
                .count()
            )
            resolved_complaints = (
                Complaint.objects.filter(
                    surveyvisit__agent=agent,
                    status__in=["villager_satisfied", "case_closed"],
                )
                .distinct()
                .count()
            )

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

    Accepts: Firebase ID token only
    Mobile app should send: Authorization: Bearer <id_token>
    """

    permission_classes = [IsAuthenticated]
    authentication_classes = [FirebaseAuthentication]

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
            # Input validation - handle None values safely
            firestore_id = request.data.get("firestore_id")
            local_id = (
                request.data.get("client_submission_id")
                or request.data.get("local_id")
                or request.data.get("idempotency_key")
                or ""
            ).strip()
            village_id = request.data.get("village_id")
            village_name = (request.data.get("village_name") or "").strip()
            description = (request.data.get("description") or "").strip()
            gap_type = request.data.get("gap_type") or "other"
            severity = request.data.get("severity") or "medium"
            input_method = request.data.get("input_method") or "text"
            recommendations = (request.data.get("recommendations") or "").strip()
            latitude = request.data.get("latitude")
            longitude = request.data.get("longitude")
            gps_accuracy_raw = request.data.get("gps_accuracy")
            audio_url = (request.data.get("audio_url") or "").strip()
            image_url = (request.data.get("image_url") or "").strip()
            submitted_by = request.data.get("submitted_by")
            submitted_by_email = request.data.get("submitted_by_email")
            uploaded_audio_file = request.FILES.get("audio_file")
            uploaded_image_file = request.FILES.get("image_file")

            if local_id:
                existing_gap = Gap.objects.filter(client_local_id=local_id).first()
                if existing_gap:
                    return Response(
                        {
                            "success": True,
                            "message": "Gap already synced",
                            "django_id": existing_gap.id,
                            "firestore_id": firestore_id,
                            "gap_type": existing_gap.gap_type,
                            "severity": existing_gap.severity,
                            "has_audio": bool(
                                existing_gap.audio_file or existing_gap.audio_url
                            ),
                            "audio_url": existing_gap.audio_url
                            or (
                                existing_gap.audio_file.url
                                if existing_gap.audio_file
                                else None
                            ),
                        },
                        status=status.HTTP_200_OK,
                    )

            # Validate required fields
            if not description:
                return Response(
                    {"success": False, "error": "Description is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # âœ… IMPROVED: Validate description length (increased limit)
            if len(description) > 5000:
                return Response(
                    {
                        "success": False,
                        "error": "Description too long (max 5000 characters)",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # âœ… NEW: Validate email format if provided
            email = (
                request.data.get("email", "").strip()
                if request.data.get("email")
                else ""
            )
            if email and not re.match(
                r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email
            ):
                return Response(
                    {"success": False, "error": "Invalid email format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # âœ… NEW: Validate phone number format (Indian format) if provided
            phone = (
                request.data.get("phone", "").strip()
                if request.data.get("phone")
                else ""
            )
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

            if input_method == "voice" and not audio_url and not uploaded_audio_file:
                return Response(
                    {
                        "success": False,
                        "error": "Voice submissions require audio_file or audio_url",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not image_url and not uploaded_image_file:
                return Response(
                    {
                        "success": False,
                        "error": "Evidence photo is required before submitting a gap",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if latitude in (None, "", "null") or longitude in (None, "", "null"):
                return Response(
                    {
                        "success": False,
                        "error": "latitude and longitude are required before submitting a gap",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if uploaded_image_file and uploaded_image_file.size > 25 * 1024 * 1024:
                return Response(
                    {
                        "success": False,
                        "error": "Image file too large. Maximum size is 25MB.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if uploaded_audio_file and uploaded_audio_file.size > 50 * 1024 * 1024:
                return Response(
                    {
                        "success": False,
                        "error": "Audio file too large. Maximum size is 50MB.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate coordinates
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

            gps_accuracy = None
            if gps_accuracy_raw not in (None, "", "null"):
                try:
                    gps_accuracy = float(gps_accuracy_raw)
                    if gps_accuracy < 0:
                        raise ValueError("gps_accuracy cannot be negative")
                except (TypeError, ValueError):
                    return Response(
                        {"success": False, "error": "Invalid gps_accuracy format"},
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
                    client_local_id=local_id or None,
                    description=description,
                    gap_type=gap_type,
                    severity=severity,
                    status="open",
                    input_method=input_method,
                    recommendations=recommendations,
                    latitude=latitude,
                    longitude=longitude,
                    initial_gps_accuracy_m=gps_accuracy,
                    audio_url=audio_url if audio_url else None,
                    initial_photo_url=image_url if image_url else None,
                )

                if uploaded_image_file and not gap.initial_photo_url:
                    try:
                        from django.core.files.storage import default_storage

                        uploaded_image_file.seek(0)
                        saved_path = default_storage.save(
                            f"initial_photos/{gap.id}_{uploaded_image_file.name}",
                            uploaded_image_file,
                        )
                        gap.initial_photo_url = request.build_absolute_uri(
                            default_storage.url(saved_path)
                        )
                        gap.save(update_fields=["initial_photo_url"])
                    except Exception as upload_url_err:
                        logger.warning(
                            "Could not build initial photo URL for gap %s: %s",
                            gap.id,
                            upload_url_err,
                        )

                # Persist audio (multipart file or remote URL)
                if uploaded_audio_file:
                    uploaded_audio_file.seek(0)
                    gap.audio_file = uploaded_audio_file
                    gap.save(update_fields=["audio_file"])

                # Create audit log for new gap creation
                from .models import GapStatusAuditLog

                GapStatusAuditLog.objects.create(
                    gap=gap,
                    old_status=None,
                    new_status="open",
                    changed_by=request.user,
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
                    "has_audio": bool(gap.audio_file or gap.audio_url),
                    "audio_url": gap.audio_url
                    or (gap.audio_file.url if gap.audio_file else None),
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.exception("Mobile gap sync failed")
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


@api_view(["POST"])
@authentication_classes([FirebaseAuthentication])
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

        if not django_id:
            return Response(
                {"success": False, "error": "django_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not new_status or new_status not in ["open", "in_progress", "needs_review"]:
            return Response(
                {"success": False, "error": "Invalid status"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            gap = Gap.objects.get(id=django_id)
        except (Gap.DoesNotExist, ValueError, TypeError):
            return Response(
                {"success": False, "error": "Gap not found in database"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if (
            gap.resolved_by_id
            and gap.resolved_by_id != request.user.id
            and not request.user.is_staff
        ):
            return Response(
                {"success": False, "error": "You are not allowed to update this gap"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if new_status == "needs_review" and gap.status not in (
            "in_progress",
            "needs_review",
        ):
            return Response(
                {
                    "success": False,
                    "error": "Only in-progress gaps can move to needs review",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update status. Resolved status must use a proof-based resolve endpoint.
        gap.status = new_status
        update_fields = ["status"]
        gap.save(update_fields=update_fields)

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
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def close_gap_with_photo_proof(request, gap_id):
    """
    Close a gap with geo-tagged photo proof.
    Any authenticated field worker can submit on-site photo + GPS coordinates.
    POST /api/gaps/<gap_id>/close-with-proof/
    """
    from django.utils import timezone
    from .models import GapStatusAuditLog

    gap = get_object_or_404(Gap, id=gap_id)
    if str(gap.status).strip().lower() not in {"in_progress", "needs_review"}:
        return Response(
            {
                "success": False,
                "error": "Gap must be in progress before proof-based closure.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    closure_photo_url = (request.data.get("closure_photo_url") or "").strip()
    closure_selfie_url = (request.data.get("closure_selfie_url") or "").strip()
    closure_latitude = request.data.get("closure_latitude")
    closure_longitude = request.data.get("closure_longitude")

    if not closure_photo_url:
        return Response(
            {"success": False, "error": "Closure photo URL is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not closure_photo_url.startswith(("http://", "https://")):
        return Response(
            {"success": False, "error": "Invalid closure photo URL format"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if closure_selfie_url and not closure_selfie_url.startswith(
        ("http://", "https://")
    ):
        return Response(
            {"success": False, "error": "Invalid closure selfie URL format"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if closure_latitude is None or closure_longitude is None:
        return Response(
            {
                "success": False,
                "error": "GPS coordinates are required (closure_latitude and closure_longitude)",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        lat = float(closure_latitude)
        lng = float(closure_longitude)
        if not (-90 <= lat <= 90):
            raise ValueError("Latitude out of range (-90 to 90)")
        if not (-180 <= lng <= 180):
            raise ValueError("Longitude out of range (-180 to 180)")
    except (ValueError, TypeError) as coord_err:
        return Response(
            {"success": False, "error": f"Invalid GPS coordinates: {coord_err}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    old_status = gap.status
    now = timezone.now()

    # GPS sanity: if the gap has a known location, ensure closure is nearby.
    max_distance_m = 500.0
    distance_m = None
    if gap.latitude is None or gap.longitude is None:
        return Response(
            {
                "success": False,
                "error": "Original gap location is missing, so on-site closure cannot be verified.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        distance_m = _haversine_m(float(gap.latitude), float(gap.longitude), lat, lng)
    except Exception as distance_err:
        logger.warning(
            "Failed to validate closure distance for gap %s: %s",
            gap.id,
            distance_err,
        )
        return Response(
            {
                "success": False,
                "error": "Unable to validate closure location. Please retry.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if distance_m > max_distance_m:
        return Response(
            {
                "success": False,
                "error": f"Closure location too far from gap location ({distance_m:.0f}m). Please capture on-site.",
                "distance_m": round(distance_m, 2),
                "max_distance_m": max_distance_m,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    gap.status = "resolved"
    gap.closure_photo_url = closure_photo_url
    gap.closure_latitude = lat
    gap.closure_longitude = lng
    gap.closure_photo_timestamp = now
    gap.closure_selfie_url = closure_selfie_url or None
    gap.closure_selfie_match_score = None
    gap.resolved_at = now
    gap.actual_completion = now.date()
    if request.user and request.user.is_authenticated:
        gap.resolved_by = request.user

    # Optional selfie similarity score (currently no baseline photo in gap flow).
    selfie_match = None
    if closure_selfie_url:
        selfie_match = {
            "score": None,
            "note": "No baseline photo configured for this gap",
        }

    gap.save(
        update_fields=[
            "status",
            "closure_photo_url",
            "closure_latitude",
            "closure_longitude",
            "closure_photo_timestamp",
            "closure_selfie_url",
            "closure_selfie_match_score",
            "resolved_at",
            "actual_completion",
            "resolved_by",
        ]
    )

    GapStatusAuditLog.objects.create(
        gap=gap,
        old_status=old_status,
        new_status="resolved",
        changed_by=(
            request.user if (request.user and request.user.is_authenticated) else None
        ),
        notes=f"Closed with on-site geo-tagged photo proof. GPS: {lat:.6f}, {lng:.6f}",
        source="photo_closure",
    )

    try:
        from .firebase_utils import sync_gap_to_firestore

        sync_gap_to_firestore(gap)
    except Exception as fb_err:
        logger.warning(
            "Firebase sync warning for gap %s after photo closure: %s", gap.id, fb_err
        )

    return Response(
        {
            "success": True,
            "message": "Gap successfully closed with geo-tagged photo proof",
            "gap_id": gap.id,
            "status": "resolved",
            "closure_photo_url": closure_photo_url,
            "closure_latitude": lat,
            "closure_longitude": lng,
            "distance_m": round(distance_m, 2) if distance_m is not None else None,
            "selfie_match": selfie_match,
            "resolved_at": gap.resolved_at.isoformat() if gap.resolved_at else None,
        }
    )


@csrf_exempt
@api_view(["GET"])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def api_mobile_gaps(request):
    """List gaps for mobile dashboard grouped by canonical mobile states."""
    gaps = (
        Gap.objects.select_related("village")
        .only(
            "id",
            "village__name",
            "description",
            "severity",
            "status",
            "client_local_id",
            "created_at",
            "audio_url",
            "audio_file",
            "closure_photo_url",
            "resolution_proof",
            "closure_distance_m",
            "resolution_time_minutes",
            "resolution_ai_score",
            "resolution_ai_method",
            "resolution_type",
            "resolution_review_reason",
            "initial_photo_url",
        )
        .order_by("-created_at")
    )

    open_items = []
    in_progress_items = []
    resolved_items = []

    for gap in gaps:
        item = _serialize_mobile_gap(gap)
        if item["status"] == "IN_PROGRESS":
            in_progress_items.append(item)
        elif item["status"] == "RESOLVED":
            resolved_items.append(item)
        else:
            open_items.append(item)

    return Response(
        {
            "success": True,
            "open": open_items,
            "in_progress": in_progress_items,
            "resolved": resolved_items,
        },
        status=status.HTTP_200_OK,
    )


@csrf_exempt
@api_view(["POST"])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def api_mobile_resolve_gap(request, gap_id):
    """Resolve a gap only after rule checks and free AI image validation."""
    from django.utils import timezone
    from .models import GapStatusAuditLog

    max_distance_m = 150.0
    max_gps_accuracy_m = 60.0
    ai_change_threshold = 0.22

    gap = get_object_or_404(Gap, id=gap_id)
    old_status = gap.status
    resolution_local_id = (
        request.data.get("client_submission_id")
        or request.data.get("local_id")
        or request.data.get("idempotency_key")
        or ""
    ).strip()

    if resolution_local_id:
        existing_resolution = Gap.objects.filter(
            resolution_client_id=resolution_local_id
        ).first()
        if existing_resolution:
            return Response(
                {
                    "success": True,
                    "gap_id": existing_resolution.id,
                    "status": (
                        "RESOLVED"
                        if existing_resolution.status == "resolved"
                        else "NEEDS_RETRY"
                    ),
                    "message": "Resolution already captured for this idempotency key",
                    "resolution_type": existing_resolution.resolution_type or "retry",
                    "ai_score": existing_resolution.resolution_ai_score,
                    "ai_method": existing_resolution.resolution_ai_method,
                    "review_reason": existing_resolution.resolution_review_reason,
                    "distance_m": existing_resolution.closure_distance_m,
                    "resolution_time_minutes": existing_resolution.resolution_time_minutes,
                },
                status=status.HTTP_200_OK,
            )

    if str(old_status).strip().lower() == "resolved":
        return Response(
            {
                "success": True,
                "gap_id": gap.id,
                "status": "RESOLVED",
                "message": "Gap is already resolved",
                "resolution_type": gap.resolution_type or "auto",
                "ai_score": gap.resolution_ai_score,
            },
            status=status.HTTP_200_OK,
        )

    if str(old_status).strip().lower() not in {"in_progress", "needs_review"}:
        return Response(
            {
                "success": False,
                "error": "Only in-progress gaps can be resolved with proof.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    proof_photo = (
        request.FILES.get("photo")
        or request.FILES.get("closure_photo")
        or request.FILES.get("resolution_proof")
    )
    closure_photo_url = (request.data.get("closure_photo_url") or "").strip()
    person_photo_url = (request.data.get("person_photo_url") or "").strip() or (
        request.data.get("closure_selfie_url") or ""
    ).strip()

    lat_raw = request.data.get("latitude")
    lng_raw = request.data.get("longitude")
    if lat_raw in (None, "", "null"):
        lat_raw = request.data.get("closure_latitude")
    if lng_raw in (None, "", "null"):
        lng_raw = request.data.get("closure_longitude")
    gps_accuracy_raw = request.data.get("gps_accuracy")

    if not proof_photo and not closure_photo_url:
        return Response(
            {
                "success": False,
                "error": "Proof photo is required before resolving a gap",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if closure_photo_url and not closure_photo_url.startswith(("http://", "https://")):
        return Response(
            {
                "success": False,
                "error": "Invalid closure_photo_url format",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if lat_raw in (None, "", "null") or lng_raw in (None, "", "null"):
        return Response(
            {
                "success": False,
                "error": "latitude and longitude are required before resolving a gap",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        lat = float(lat_raw)
        lng = float(lng_raw)
        if not (-90 <= lat <= 90):
            raise ValueError("Latitude out of range (-90 to 90)")
        if not (-180 <= lng <= 180):
            raise ValueError("Longitude out of range (-180 to 180)")
    except (TypeError, ValueError) as coord_err:
        return Response(
            {
                "success": False,
                "error": f"Invalid GPS coordinates: {coord_err}",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    closure_gps_accuracy = None
    if gps_accuracy_raw not in (None, "", "null"):
        try:
            closure_gps_accuracy = float(gps_accuracy_raw)
            if closure_gps_accuracy < 0:
                raise ValueError("gps_accuracy cannot be negative")
        except (TypeError, ValueError) as gps_err:
            return Response(
                {
                    "success": False,
                    "error": f"Invalid gps_accuracy: {gps_err}",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    if gap.latitude is None or gap.longitude is None:
        return Response(
            {
                "success": False,
                "error": "Initial complaint location is missing; resolution cannot be validated",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        distance_m = _haversine_m(float(gap.latitude), float(gap.longitude), lat, lng)
    except Exception as distance_err:
        return Response(
            {
                "success": False,
                "error": f"Failed to validate closure location: {distance_err}",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    now = timezone.now()
    elapsed_minutes = max(0.0, (now - gap.created_at).total_seconds() / 60.0)

    if proof_photo is not None:
        gap.resolution_proof = proof_photo
    if closure_photo_url:
        gap.closure_photo_url = closure_photo_url
    if person_photo_url:
        gap.closure_selfie_url = person_photo_url
    gap.closure_latitude = lat
    gap.closure_longitude = lng
    gap.closure_photo_timestamp = now
    gap.closure_distance_m = float(distance_m)
    gap.resolution_time_minutes = float(elapsed_minutes)
    gap.closure_gps_accuracy_m = closure_gps_accuracy
    gap.resolution_client_id = resolution_local_id or None

    base_update_fields = [
        "closure_photo_url",
        "closure_selfie_url",
        "closure_latitude",
        "closure_longitude",
        "closure_photo_timestamp",
        "closure_distance_m",
        "resolution_time_minutes",
        "closure_gps_accuracy_m",
        "resolution_client_id",
    ]
    if proof_photo is not None:
        base_update_fields.append("resolution_proof")
    gap.save(update_fields=base_update_fields)

    if proof_photo is not None and not gap.closure_photo_url:
        try:
            gap.closure_photo_url = request.build_absolute_uri(gap.resolution_proof.url)
            gap.save(update_fields=["closure_photo_url"])
        except Exception as url_err:
            logger.warning(
                "Could not build closure photo URL for gap %s: %s", gap.id, url_err
            )

    ai_score, ai_method, ai_note = _compute_resolution_ai_score(
        gap,
        closure_photo_url=gap.closure_photo_url or closure_photo_url,
    )
    gap.resolution_ai_score = ai_score
    gap.resolution_ai_method = ai_method

    failure_reasons = []
    if distance_m > max_distance_m:
        failure_reasons.append("Too far from original location")
    if closure_gps_accuracy is not None and closure_gps_accuracy > max_gps_accuracy_m:
        failure_reasons.append("Poor GPS accuracy")

    # AI scoring is best-effort. Keep hard validation on GPS/time/accuracy,
    # but do not block closure when visual scoring is unavailable.
    if ai_score is not None and ai_score < ai_change_threshold:
        failure_reasons.append("Low visual change detected")

    if not failure_reasons:
        decision_status = "resolved"
        resolution_type = "auto"
        review_reason = ""
    else:
        decision_status = "needs_review"
        resolution_type = "retry"
        review_reason = ", ".join(failure_reasons)

    gap.status = decision_status
    gap.resolution_type = resolution_type
    gap.resolution_review_reason = review_reason
    gap.resolved_at = now if decision_status == "resolved" else None
    gap.actual_completion = now.date() if decision_status == "resolved" else None
    if request.user and request.user.is_authenticated:
        gap.resolved_by = request.user

    gap.save(
        update_fields=[
            "status",
            "resolution_type",
            "resolution_review_reason",
            "resolution_ai_score",
            "resolution_ai_method",
            "resolved_at",
            "actual_completion",
            "resolved_by",
        ]
    )

    GapStatusAuditLog.objects.create(
        gap=gap,
        old_status=old_status,
        new_status=decision_status,
        changed_by=(
            request.user if (request.user and request.user.is_authenticated) else None
        ),
        notes=(
            f"Rule-based resolution check. distance_m={distance_m:.2f}, "
            f"time_minutes={elapsed_minutes:.2f}, ai_score={ai_score}, "
            f"gps_accuracy={closure_gps_accuracy}, ai_method={ai_method}, "
            f"decision={decision_status}. {review_reason}".strip()
        ),
        source="mobile_app",
    )

    try:
        sync_thread = threading.Thread(
            target=_sync_gap_to_firestore_async,
            args=(gap.id,),
            daemon=True,
            name=f"sync-gap-{gap.id}",
        )
        sync_thread.start()
    except Exception as sync_err:
        logger.warning(
            "Could not start Firebase sync thread for resolved gap %s: %s",
            gap.id,
            sync_err,
        )

    return Response(
        {
            "success": True,
            "gap_id": gap.id,
            "status": "RESOLVED" if gap.status == "resolved" else "NEEDS_RETRY",
            "message": (
                "AI verified. Gap marked as resolved"
                if gap.status == "resolved"
                else "Resolution proof captured. Retry capture required"
            ),
            "closure_latitude": (
                float(gap.closure_latitude)
                if gap.closure_latitude is not None
                else None
            ),
            "closure_longitude": (
                float(gap.closure_longitude)
                if gap.closure_longitude is not None
                else None
            ),
            "gps_accuracy": closure_gps_accuracy,
            "max_gps_accuracy_m": max_gps_accuracy_m,
            "closure_photo_url": gap.closure_photo_url,
            "distance_m": round(distance_m, 2),
            "resolution_time_minutes": round(elapsed_minutes, 2),
            "ai_score": ai_score,
            "ai_threshold": ai_change_threshold,
            "ai_method": ai_method,
            "resolution_type": resolution_type,
            "review_reason": review_reason,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def api_mobile_submit_complaint(request):
    """Mobile complaint submission with complaintee photo + GPS capture."""
    from .models import PostOffice, WorkflowLog

    villager_name = (request.data.get("villager_name") or "").strip()
    village_id = request.data.get("village_id")
    post_office_id = request.data.get("post_office_id")
    complaint_text = (request.data.get("complaint_text") or "").strip()
    submission_latitude = request.data.get("submission_latitude")
    submission_longitude = request.data.get("submission_longitude")
    client_submission_id = (
        request.data.get("client_submission_id")
        or request.data.get("idempotency_key")
        or request.data.get("local_id")
        or ""
    ).strip()

    if client_submission_id:
        existing_complaint = Complaint.objects.filter(
            client_submission_id=client_submission_id
        ).first()
        if existing_complaint:
            return Response(
                {
                    "success": True,
                    "complaint_id": existing_complaint.complaint_id,
                    "status": _mobile_ui_status(existing_complaint.status),
                    "message": "Complaint already submitted",
                },
                status=status.HTTP_200_OK,
            )

    if not villager_name or not village_id:
        return Response(
            {
                "success": False,
                "error": "villager_name and village_id are required",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        village = Village.objects.get(id=village_id)
    except Exception:
        return Response(
            {"success": False, "error": "Invalid village_id"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    post_office = None
    if post_office_id:
        try:
            post_office = PostOffice.objects.get(id=post_office_id)
        except Exception:
            post_office = None

    try:
        lat = (
            float(submission_latitude)
            if submission_latitude not in (None, "", "null")
            else None
        )
        lng = (
            float(submission_longitude)
            if submission_longitude not in (None, "", "null")
            else None
        )
    except (ValueError, TypeError):
        return Response(
            {"success": False, "error": "Invalid submission latitude/longitude"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    audio_file = request.FILES.get("audio_file")
    if not complaint_text and not audio_file:
        return Response(
            {
                "success": False,
                "error": "Provide either complaint_text or audio_file",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    complaintee_photo = request.FILES.get("complaintee_photo")
    complaint_document_image = request.FILES.get(
        "complaint_document_image"
    ) or request.FILES.get("supporting_image")
    recorded_by_agent = _is_truthy(request.data.get("recorded_by_agent", True))
    agent_name = (request.data.get("agent_name") or "").strip()

    if not complaintee_photo:
        return Response(
            {
                "success": False,
                "error": "complaintee_photo is required so identity can be verified later",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not complaint_text and audio_file:
        complaint_text = "Audio complaint submitted"

    if lat is None or lng is None:
        return Response(
            {
                "success": False,
                "error": "submission_latitude and submission_longitude are required for geotag verification",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    complaint = Complaint.objects.create(
        villager_name=villager_name,
        village=village,
        post_office=post_office,
        pmajay_office=post_office.pmajayoffice_set.first() if post_office else None,
        complaint_text=complaint_text,
        complaint_type="other",
        priority_level="medium",
        audio_transcription=(complaint_text if audio_file else ""),
        recorded_by_agent=recorded_by_agent,
        agent_name=agent_name,
        status="received_post",
        latitude=lat,
        longitude=lng,
        submission_latitude=lat,
        submission_longitude=lng,
        client_submission_id=client_submission_id or None,
    )

    if audio_file:
        complaint.audio_file = audio_file
    complaint.complaintee_photo = complaintee_photo
    if complaint_document_image:
        complaint.complaint_document_image = complaint_document_image
    complaint.save()

    WorkflowLog.objects.create(
        complaint=complaint,
        from_status="",
        to_status="received_post",
        action_by=agent_name or "Mobile App",
        action_type="received",
        notes="Submitted via mobile app.",
    )

    return Response(
        {
            "success": True,
            "complaint_id": complaint.complaint_id,
            "status": _mobile_ui_status(complaint.status),
            "message": "Complaint submitted successfully",
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def api_mobile_in_progress_complaints(request):
    """List complaints for mobile dashboard using canonical statuses."""
    complaints = (
        Complaint.objects.all()
        .select_related("village")
        .only(
            "id",
            "complaint_id",
            "villager_name",
            "complaint_text",
            "status",
            "village__name",
            "complaint_document_image",
            "resolution_letter_image",
            "complaintee_photo",
            "submission_latitude",
            "submission_longitude",
            "closure_selfie",
            "updated_at",
        )
        .order_by("-updated_at")
    )
    open_items = []
    in_progress = []
    resolved = []
    for complaint in complaints:
        ui_status = _mobile_ui_status(complaint.status)
        item = {
            "id": complaint.id,
            "complaint_id": complaint.complaint_id,
            "villager_name": complaint.villager_name,
            "complaint_text": complaint.complaint_text,
            "status": ui_status,
            "village_name": complaint.village.name if complaint.village else "",
            "resolution_mode": (
                "resolution_letter"
                if complaint.uses_resolution_letter
                else "selfie_gps"
            ),
            "has_submission_photo": complaint.has_submission_identity_photo,
            "has_submission_geo": complaint.has_submission_geo,
            "resolution_ready": (
                ui_status == "IN_PROGRESS"
                and (
                    complaint.uses_resolution_letter
                    or complaint.is_submission_verification_ready
                )
            ),
            "banner": _complaint_resolution_banner(complaint),
        }
        if ui_status == "OPEN":
            open_items.append(item)
        elif ui_status == "RESOLVED":
            resolved.append(item)
        else:
            in_progress.append(item)
    return Response(
        {
            "success": True,
            "open": open_items,
            "in_progress": in_progress,
            "resolved": resolved,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def api_mobile_verify_close_complaint(request, complaint_id):
    """Mobile verification + close for complaint (selfie + GPS)."""
    from django.utils import timezone
    from .models import WorkflowLog

    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
    closure_client_id = (
        request.data.get("client_submission_id")
        or request.data.get("idempotency_key")
        or request.data.get("local_id")
        or ""
    ).strip()
    if closure_client_id:
        existing_closure = Complaint.objects.filter(
            closure_client_id=closure_client_id
        ).first()
        if existing_closure:
            return Response(
                {
                    "success": True,
                    "complaint_id": existing_closure.complaint_id,
                    "status": _mobile_ui_status(existing_closure.status),
                    "distance_m": (
                        round(existing_closure.closure_distance_m, 2)
                        if existing_closure.closure_distance_m is not None
                        else None
                    ),
                    "match_score": (
                        round(existing_closure.closure_selfie_match_score, 4)
                        if existing_closure.closure_selfie_match_score is not None
                        else None
                    ),
                    "message": "Complaint closure already captured",
                },
                status=status.HTTP_200_OK,
            )
    if complaint.status not in Complaint.CLOSURE_ALLOWED_STATUSES:
        return Response(
            {
                "success": False,
                "error": "Complaint must be assigned for work before it can be resolved.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if complaint.uses_resolution_letter:
        return Response(
            {
                "success": False,
                "error": "Photo/document complaints must be resolved with resolution letter image.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not complaint.is_submission_verification_ready:
        return Response(
            {
                "success": False,
                "error": complaint.verification_block_reason
                or "Submission proof is incomplete for selfie and GPS verification.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    closure_selfie = request.FILES.get("closure_selfie")
    closure_latitude = request.data.get("closure_latitude")
    closure_longitude = request.data.get("closure_longitude")

    if not closure_selfie:
        return Response(
            {"success": False, "error": "closure_selfie is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if getattr(closure_selfie, "size", 0) > 8 * 1024 * 1024:
        return Response(
            {"success": False, "error": "closure_selfie exceeds 8 MB size limit"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        lat = float(closure_latitude)
        lng = float(closure_longitude)
    except (TypeError, ValueError):
        return Response(
            {"success": False, "error": "Valid closure GPS coordinates are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    min_match_score = 0.75
    max_distance_m = 500.0
    match_score = None

    distance_m = _haversine_m(
        float(complaint.submission_latitude),
        float(complaint.submission_longitude),
        lat,
        lng,
    )
    if distance_m > max_distance_m:
        return Response(
            {
                "success": False,
                "error": f"Verification failed: location too far ({distance_m:.0f}m)",
                "distance_m": round(distance_m, 2),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        if getattr(complaint.complaintee_photo, "size", 0) > 8 * 1024 * 1024:
            return Response(
                {
                    "success": False,
                    "error": "Stored complaintee photo is too large for verification",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        with complaint.complaintee_photo.open("rb") as base_file:
            h1 = _hash_image_file(base_file)
        h2 = _hash_image_file(closure_selfie)
        dist = _hamming_distance_64(h1, h2)
        match_score = max(0.0, min(1.0, 1.0 - (dist / 64.0)))
        if match_score < min_match_score:
            return Response(
                {
                    "success": False,
                    "error": f"Verification failed: photo mismatch (score {match_score:.2f})",
                    "match_score": round(match_score, 4),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
    except Exception as img_err:
        logger.exception("Mobile complaint photo verification failed: %s", img_err)
        return Response(
            {"success": False, "error": f"Photo verification error: {img_err}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    old_status = complaint.status
    complaint.closure_selfie = closure_selfie
    complaint.closure_latitude = lat
    complaint.closure_longitude = lng
    complaint.closure_timestamp = timezone.now()
    complaint.closure_distance_m = distance_m
    complaint.closure_selfie_match_score = match_score
    complaint.closure_client_id = closure_client_id or None
    complaint.status = "case_closed"
    complaint.save(
        update_fields=[
            "closure_selfie",
            "closure_latitude",
            "closure_longitude",
            "closure_timestamp",
            "closure_distance_m",
            "closure_selfie_match_score",
            "closure_client_id",
            "status",
            "updated_at",
        ]
    )

    WorkflowLog.objects.create(
        complaint=complaint,
        from_status=old_status,
        to_status="case_closed",
        action_by="Mobile App",
        action_type="case_closed",
        notes="Closed via mobile verification (photo + GPS).",
    )

    return Response(
        {
            "success": True,
            "complaint_id": complaint.complaint_id,
            "status": _mobile_ui_status(complaint.status),
            "distance_m": round(distance_m, 2) if distance_m is not None else None,
            "match_score": round(match_score, 4) if match_score is not None else None,
            "message": "Complaint verified and closed successfully",
        }
    )


@api_view(["POST"])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def api_mobile_resolve_photo_complaint(request, complaint_id):
    """Resolve photo/document complaint with resolution letter image."""
    from .models import WorkflowLog

    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
    closure_client_id = (
        request.data.get("client_submission_id")
        or request.data.get("idempotency_key")
        or request.data.get("local_id")
        or ""
    ).strip()
    if closure_client_id:
        existing_closure = Complaint.objects.filter(
            closure_client_id=closure_client_id
        ).first()
        if existing_closure:
            return Response(
                {
                    "success": True,
                    "complaint_id": existing_closure.complaint_id,
                    "status": _mobile_ui_status(existing_closure.status),
                    "message": "Photo complaint closure already captured",
                },
                status=status.HTTP_200_OK,
            )
    if complaint.status not in Complaint.CLOSURE_ALLOWED_STATUSES:
        return Response(
            {
                "success": False,
                "error": "Complaint must be assigned for work before it can be resolved.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not complaint.uses_resolution_letter:
        return Response(
            {
                "success": False,
                "error": "This complaint requires selfie + GPS verification, not resolution letter.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    resolution_letter = request.FILES.get("resolution_letter_image")
    if not resolution_letter:
        return Response(
            {"success": False, "error": "resolution_letter_image is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    old_status = complaint.status
    complaint.resolution_letter_image = resolution_letter
    complaint.closure_client_id = closure_client_id or None
    complaint.status = "case_closed"
    complaint.save(
        update_fields=[
            "resolution_letter_image",
            "closure_client_id",
            "status",
            "updated_at",
        ]
    )

    WorkflowLog.objects.create(
        complaint=complaint,
        from_status=old_status,
        to_status="case_closed",
        action_by="Mobile App",
        action_type="case_closed",
        notes="Closed via mobile resolution letter upload.",
    )

    return Response(
        {
            "success": True,
            "complaint_id": complaint.complaint_id,
            "status": _mobile_ui_status(complaint.status),
            "message": "Photo complaint closed with resolution letter",
        },
        status=status.HTTP_200_OK,
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
    import tempfile

    import google.generativeai as genai
    import requests

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

        allowed_audio_exts = {".m4a", ".mp3", ".wav", ".ogg", ".webm", ".aac", ".mp4"}
        allowed_image_exts = {".jpg", ".jpeg", ".png", ".webp"}

        if uploaded_file:
            uploaded_ext = os.path.splitext((uploaded_file.name or "").lower())[1]
            if media_type == "audio" and uploaded_ext in allowed_audio_exts:
                suffix = uploaded_ext
            elif media_type == "image" and uploaded_ext in allowed_image_exts:
                suffix = uploaded_ext

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

                def _score_transcription(transcription_payload):
                    text = (transcription_payload.get("text") or "").strip()
                    confidence = float(transcription_payload.get("confidence") or 0)
                    word_count = len([w for w in re.split(r"\s+", text) if w])
                    alpha_count = len(
                        re.findall(
                            r"[A-Za-z\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]",
                            text,
                        )
                    )

                    is_too_short = len(text) <= 2 or alpha_count <= 1
                    is_low_signal = (
                        word_count <= 1 and len(text) < 8 and confidence < 0.45
                    )
                    usable = bool(text) and not is_too_short and not is_low_signal

                    score = len(text) + (word_count * 8) + (confidence * 25)
                    if not usable:
                        score -= 20

                    return {
                        "text": text,
                        "confidence": confidence,
                        "word_count": word_count,
                        "usable": usable,
                        "score": score,
                    }

                requested_language = (language or "hi").strip().lower()
                candidate_languages = []
                for lang_code in [requested_language, "hi", "en"]:
                    if lang_code and lang_code not in candidate_languages:
                        candidate_languages.append(lang_code)

                best_transcription = None
                attempt_errors = []

                for lang_code in candidate_languages:
                    attempt = processor.speech_service.transcribe_audio(
                        tmp_path, lang_code
                    )
                    if not attempt.get("success"):
                        attempt_errors.append(
                            f"{lang_code}: {attempt.get('error', 'unknown')}"
                        )
                        continue

                    quality = _score_transcription(attempt)
                    candidate = {
                        "language": lang_code,
                        "payload": attempt,
                        "quality": quality,
                    }

                    if (
                        best_transcription is None
                        or quality["score"] > best_transcription["quality"]["score"]
                    ):
                        best_transcription = candidate

                    # Stop early once a usable transcript is found.
                    if quality["usable"]:
                        break

                if not best_transcription:
                    error_message = (
                        "; ".join(attempt_errors) if attempt_errors else "Unknown error"
                    )
                    return Response(
                        {"error": f"Transcription failed: {error_message}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                transcription_text = best_transcription["quality"]["text"]
                transcription_confidence = best_transcription["quality"]["confidence"]
                transcription_language = best_transcription["language"]

                if not best_transcription["quality"]["usable"]:
                    return Response(
                        {
                            "error": "Transcription quality is too low. Please record again in a quieter place and speak clearly.",
                            "transcription": transcription_text,
                            "transcription_confidence": transcription_confidence,
                            "transcription_language": transcription_language,
                        },
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )

                # Build deterministic fallback so transcription still succeeds
                # even when Gemini is rate-limited/unavailable.
                heuristic = processor.analyze_complaint(transcription_text)
                priority_to_severity = {
                    "urgent": "high",
                    "high": "high",
                    "medium": "medium",
                    "low": "low",
                }
                fallback_payload = {
                    "success": True,
                    "transcription": transcription_text,
                    "description": transcription_text,
                    "transcription_confidence": transcription_confidence,
                    "transcription_language": transcription_language,
                    "gap_type": heuristic.get("gap_type", "other"),
                    "severity": priority_to_severity.get(
                        heuristic.get("priority", "medium"), "medium"
                    ),
                    "confidence": heuristic.get("analysis_confidence", 0.5),
                }

                # Analyze transcribed text with Gemini
                try:
                    prompt = f"""Analyze this transcribed complaint from a villager.
The transcript may be in Hindi, English, or another Indian language (including transliterated text).
Understand the original meaning first, then respond in English JSON.

Transcript:
"{transcription_text}"

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
                            response_text.replace("```json", "")
                            .replace("```", "")
                            .strip()
                        )
                    elif response_text.startswith("```"):
                        response_text = response_text.replace("```", "").strip()

                    analysis = json.loads(response_text)

                    return Response(
                        {
                            "success": True,
                            "analysis_source": "gemini",
                            "transcription": transcription_text,
                            "transcription_confidence": transcription_confidence,
                            "transcription_language": transcription_language,
                            "description": analysis.get("description", ""),
                            "gap_type": analysis.get("gap_type", "other"),
                            "severity": analysis.get("severity", "medium"),
                            "confidence": analysis.get("confidence", 0.7),
                        },
                        status=status.HTTP_200_OK,
                    )
                except Exception as gemini_err:
                    logger.warning(
                        "Gemini analysis unavailable for audio; using heuristic fallback: %s",
                        gemini_err,
                    )
                    fallback_payload["analysis_source"] = "heuristic"
                    fallback_payload["warning"] = (
                        "Gemini analysis unavailable; used rule-based fallback."
                    )
                    return Response(fallback_payload, status=status.HTTP_200_OK)

            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
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
