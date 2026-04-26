"""
Views for the PM-AJAY Post Office Workflow System.
"""

<<<<<<< HEAD
import json
import logging
import math
import hmac
import os

from django.conf import settings
=======
import logging

>>>>>>> 6a0a424 (Many changes in verification modules.)
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
<<<<<<< HEAD
from django.views.decorators.csrf import csrf_exempt
=======
>>>>>>> 6a0a424 (Many changes in verification modules.)
from django.views.decorators.http import require_POST

from .models import (
    Complaint,
    PostOffice,
    SurveyAgent,
    SurveyVisit,
    Worker,
    WorkflowLog,
)
from .permissions import Role, get_user_role
from .services import ComplaintProcessor
from .utils.verification import (
    hamming_distance_64 as _hamming_distance_64,
    hash_image_file as _hash_image_file,
    haversine_m as _haversine_m,
)

logger = logging.getLogger(__name__)


def _submit_complaint_context():
    from .models import Village

    return {
        "villages": Village.objects.all().order_by("name"),
        "post_offices": PostOffice.objects.all().order_by("name"),
        "language_choices": [
            ("hi", "Hindi"),
            ("en", "English"),
            ("bn", "Bengali"),
            ("te", "Telugu"),
            ("mr", "Marathi"),
            ("ta", "Tamil"),
        ],
    }


def _render_submit_complaint(request):
    return render(request, "core/submit_complaint.html", _submit_complaint_context())

logger = logging.getLogger(__name__)


def _require_sms_webhook_secret(request):
    """Validate webhook secret for SMS integration endpoints."""
    configured_secret = (
        os.getenv("SMS_WEBHOOK_SECRET")
        or getattr(settings, "SMS_WEBHOOK_SECRET", "")
    ).strip()

    if not configured_secret:
        logger.error("SMS webhook secret is not configured")
        return JsonResponse({"error": "SMS integration not configured"}, status=503)

    provided_secret = (request.headers.get("X-SMS-Secret") or "").strip()
    if not provided_secret:
        return JsonResponse({"error": "Missing X-SMS-Secret header"}, status=401)

    if not hmac.compare_digest(provided_secret, configured_secret):
        return JsonResponse({"error": "Invalid SMS webhook secret"}, status=403)

    return None


def _haversine_m(lat1, lng1, lat2, lng2):
    """Distance in meters between two lat/lng points."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _average_hash_64(image):
    img = image.convert("L").resize((8, 8))
    pixels = list(img.getdata())
    avg = sum(pixels) / 64.0
    bits = 0
    for idx, px in enumerate(pixels):
        if px >= avg:
            bits |= 1 << idx
    return bits


def _hamming_distance_64(a, b):
    return (a ^ b).bit_count()


def _hash_image_file(file_obj):
    """Safely open and hash images to avoid memory spikes/crashes."""
    from PIL import Image, ImageFile

    ImageFile.LOAD_TRUNCATED_IMAGES = True
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    with Image.open(file_obj) as img:
        img = img.convert("RGB")
        img.thumbnail((1024, 1024))
        hashed = _average_hash_64(img)
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    return hashed


def _submit_complaint_context():
    from .models import Village

    return {
        "villages": Village.objects.all().order_by("name"),
        "post_offices": PostOffice.objects.all().order_by("name"),
        "language_choices": [
            ("hi", "Hindi"),
            ("en", "English"),
            ("bn", "Bengali"),
            ("te", "Telugu"),
            ("mr", "Marathi"),
            ("ta", "Tamil"),
        ],
    }


def _render_submit_complaint(request):
    return render(request, "core/submit_complaint.html", _submit_complaint_context())


@login_required
def workflow_dashboard(request):
    """Main workflow dashboard showing all complaints and their status."""
    complaints = (
        Complaint.objects.select_related("village", "post_office", "pmajay_office")
        .prefetch_related("workflow_logs")
        .order_by("-created_at")
    )

    status_filter = request.GET.get("status")
    if status_filter:
        complaints = complaints.filter(status=status_filter)

    priority_filter = request.GET.get("priority")
    if priority_filter:
        complaints = complaints.filter(priority_level=priority_filter)

    stats = {
        "total_complaints": Complaint.objects.count(),
        "pending_complaints": Complaint.objects.filter(
            status__in=[
                "received_post",
                "sent_to_office",
                "under_analysis",
                "assigned_worker",
                "work_in_progress",
            ]
        ).count(),
        "completed_complaints": Complaint.objects.filter(
            status__in=["villager_satisfied", "case_closed"]
        ).count(),
        "urgent_complaints": Complaint.objects.filter(priority_level="urgent").count(),
    }

    context = {
        "complaints": complaints[:50],
        "stats": stats,
        "status_data": list(
            Complaint.objects.values("status").annotate(count=Count("id"))
        ),
        "type_data": list(
            Complaint.objects.values("complaint_type").annotate(count=Count("id"))
        ),
        "recent_activities": WorkflowLog.objects.select_related("complaint").order_by(
            "-timestamp"
        )[:10],
        "status_choices": Complaint.COMPLAINT_STATUS,
        "priority_choices": [
            ("low", "Low"),
            ("medium", "Medium"),
            ("high", "High"),
            ("urgent", "Urgent"),
        ],
        "current_status_filter": status_filter,
        "current_priority_filter": priority_filter,
    }
    return render(request, "core/workflow_dashboard.html", context)


@login_required
def complaint_detail(request, complaint_id):
    """Detailed view of a specific complaint."""
    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
    context = {
        "complaint": complaint,
        "workflow_logs": complaint.workflow_logs.order_by("timestamp"),
        "available_workers": Worker.objects.filter(
            is_available=True, pmajay_office=complaint.pmajay_office
        ),
        "status_choices": Complaint.COMPLAINT_STATUS,
        "is_admin": get_user_role(request.user) == Role.ADMIN,
    }
    return render(request, "core/complaint_detail.html", context)


@login_required
@require_POST
def update_complaint_status(request, complaint_id):
    """Update complaint status and log the change."""
    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)

    new_status = request.POST.get("status")
    notes = request.POST.get("notes", "")
    is_admin = get_user_role(request.user) == Role.ADMIN
    force_resolve = str(request.POST.get("force_resolve", "")).lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    if new_status == "case_closed":
        if force_resolve and not is_admin:
            messages.error(request, "Only admin can use force resolve.")
            return redirect("complaint_detail", complaint_id=complaint_id)
        if force_resolve and is_admin:
            notes = (notes + " | Force resolved by admin").strip(" |")
        else:
            if complaint.status not in Complaint.CLOSURE_ALLOWED_STATUSES:
                messages.error(
                    request,
                    "Complaint can be closed only after it has been assigned for work.",
                )
                return redirect("complaint_detail", complaint_id=complaint_id)

        if not (force_resolve and is_admin):
            if complaint.uses_resolution_letter:
                if not complaint.resolution_letter_image:
                    messages.error(
                        request,
                        "Cannot close photo complaint. Upload the resolution letter first.",
                    )
                    return redirect("complaint_detail", complaint_id=complaint_id)
            else:
                if not complaint.is_submission_verification_ready:
                    messages.error(
                        request,
                        complaint.verification_block_reason
                        or "Submission proof is incomplete for selfie and GPS verification.",
                    )
                    return redirect("complaint_detail", complaint_id=complaint_id)
                if not (
                    complaint.closure_selfie
                    and complaint.closure_latitude is not None
                    and complaint.closure_longitude is not None
                ):
                    messages.error(
                        request,
                        "Cannot close this complaint. Complete complaintee selfie and GPS verification first.",
                    )
                    return redirect("complaint_detail", complaint_id=complaint_id)

    if new_status and new_status != complaint.status:
        WorkflowLog.objects.create(
            complaint=complaint,
            from_status=complaint.status,
            to_status=new_status,
            action_by=(
                request.user.username if request.user.is_authenticated else "System"
            ),
            action_type="status_update",
            notes=notes,
        )

        old_status = complaint.get_status_display()
        complaint.status = new_status
        complaint.save()

        messages.success(
            request,
            f'Status updated from "{old_status}" to "{complaint.get_status_display()}"',
        )

    return redirect("complaint_detail", complaint_id=complaint_id)


@login_required
def submit_complaint(request):
    """Interface for submitting new complaints (for agents/post office staff)."""
    if request.method == "POST":
        processor = ComplaintProcessor()

        villager_name = (request.POST.get("villager_name") or "").strip()
        village_id = request.POST.get("village")
        complaint_text = (request.POST.get("complaint_text") or "").strip()
        post_office_id = request.POST.get("post_office")

        audio_file = request.FILES.get("audio_file") or request.FILES.get(
            "audio_file_upload"
        )
        supporting_image = request.FILES.get(
            "complaint_document_image"
        ) or request.FILES.get("supporting_image")
        complaintee_photo = request.FILES.get("complaintee_photo")
        language_code = request.POST.get("language_code", "hi")
        recorded_by_agent = request.POST.get("recorded_by_agent") == "on"
        agent_name = (request.POST.get("agent_name") or "").strip()

        submission_latitude = request.POST.get("submission_latitude")
        submission_longitude = request.POST.get("submission_longitude")
        try:
            submission_latitude = (
                float(submission_latitude)
                if submission_latitude not in (None, "", "null", "undefined")
                else None
            )
            submission_longitude = (
                float(submission_longitude)
                if submission_longitude not in (None, "", "null", "undefined")
                else None
            )
        except (TypeError, ValueError, OverflowError):
            submission_latitude = None
            submission_longitude = None

        if not villager_name or not village_id or not post_office_id:
            messages.error(request, "Villager name, village, and post office are required.")
            return _render_submit_complaint(request)

        if not complaint_text and not audio_file:
            messages.error(
                request,
                "Provide either written complaint text or an audio recording.",
            )
            return _render_submit_complaint(request)

        if not complaintee_photo:
            messages.error(
                request,
                "Capture the complaintee photo so identity can be verified at closure time.",
            )
            return _render_submit_complaint(request)

        if submission_latitude is None or submission_longitude is None:
            messages.error(
                request,
                "Allow location access and capture GPS before submitting the complaint.",
            )
            return _render_submit_complaint(request)

        if complaint_text and not audio_file and not supporting_image:
            messages.error(
                request,
                "Written complaints require the written complaint document photo.",
            )
            return _render_submit_complaint(request)

        audio_transcription = ""
        detected_type = "other"
        priority_level = "medium"

        if audio_file:
            result = processor.process_audio_complaint(audio_file, language_code)
            if result["success"]:
                audio_transcription = result["processed_text"]
                detected_type = result["detected_type"]
                priority_level = result["priority_level"]
                if not complaint_text:
                    complaint_text = audio_transcription
            else:
                messages.error(request, f"Audio processing failed: {result['error']}")
                return _render_submit_complaint(request)
        else:
            analysis = processor.analyze_complaint(complaint_text)
            detected_type = analysis["gap_type"]
            priority_level = analysis["priority"]

        try:
            from .models import Village

            village = Village.objects.get(id=village_id)
            post_office = PostOffice.objects.get(id=post_office_id)
            pmajay_office = post_office.pmajayoffice_set.first()

            complaint = Complaint.objects.create(
                villager_name=villager_name,
                village=village,
                post_office=post_office,
                pmajay_office=pmajay_office,
                complaint_text=complaint_text,
                complaint_type=detected_type,
                priority_level=priority_level,
                audio_transcription=audio_transcription,
                recorded_by_agent=recorded_by_agent,
                agent_name=agent_name,
                status="received_post",
                latitude=submission_latitude,
                longitude=submission_longitude,
                submission_latitude=submission_latitude,
                submission_longitude=submission_longitude,
            )

            complaint.complaintee_photo = complaintee_photo
            if supporting_image:
                complaint.complaint_document_image = supporting_image
            if audio_file:
                complaint.audio_file = audio_file
            complaint.save()

            WorkflowLog.objects.create(
                complaint=complaint,
                from_status="",
                to_status="received_post",
                action_by=agent_name if recorded_by_agent else "Post Office",
                action_type="received",
                notes=f"Complaint submitted by {villager_name}",
            )

            messages.success(
                request, f"Complaint {complaint.complaint_id} submitted successfully."
            )
            return redirect("complaint_detail", complaint_id=complaint.complaint_id)
        except Exception as exc:
            messages.error(request, f"Error creating complaint: {exc}")

    return _render_submit_complaint(request)


@login_required
@require_POST
def verify_and_close_complaint(request, complaint_id):
    """
    Capture closure-time selfie + GPS, verify against submission photo + GPS,
    then mark complaint as case_closed.
    """
    from django.utils import timezone

    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)

    if complaint.uses_resolution_letter:
        messages.error(
            request,
            "Photo/document complaints must be closed using the resolution letter upload.",
        )
        return redirect("complaint_detail", complaint_id=complaint_id)
    if not complaint.closure_status_is_actionable:
        messages.error(
            request,
            "Complaint must be assigned for work before it can be closed.",
        )
        return redirect("complaint_detail", complaint_id=complaint_id)
    if not complaint.is_submission_verification_ready:
        messages.error(
            request,
            complaint.verification_block_reason
            or "Submission proof is incomplete for selfie and GPS verification.",
        )
        return redirect("complaint_detail", complaint_id=complaint_id)

    selfie = request.FILES.get("closure_selfie")
    lat_raw = request.POST.get("closure_latitude")
    lng_raw = request.POST.get("closure_longitude")

    if not selfie:
        messages.error(request, "Closure selfie is required for verification.")
        return redirect("complaint_detail", complaint_id=complaint_id)
    if getattr(selfie, "size", 0) > 8 * 1024 * 1024:
        messages.error(request, "Selfie image is too large. Keep it under 8 MB.")
        return redirect("complaint_detail", complaint_id=complaint_id)

    try:
        lat = float(lat_raw)
        lng = float(lng_raw)
    except (TypeError, ValueError):
        messages.error(request, "Valid GPS coordinates are required for verification.")
        return redirect("complaint_detail", complaint_id=complaint_id)

    max_distance_m = 500.0
    distance_m = _haversine_m(
        float(complaint.submission_latitude),
        float(complaint.submission_longitude),
        lat,
        lng,
    )
    complaint.closure_distance_m = float(distance_m)
    if distance_m > max_distance_m:
        messages.error(
            request,
            f"Verification failed: closure location is too far away ({distance_m:.0f}m). Capture it on-site.",
        )
        complaint.save(update_fields=["closure_distance_m"])
        return redirect("complaint_detail", complaint_id=complaint_id)

    min_score = 0.75
    try:
        if getattr(complaint.complaintee_photo, "size", 0) > 8 * 1024 * 1024:
            messages.error(
                request,
                "Stored complaintee photo is too large for verification. Please contact admin.",
            )
            return redirect("complaint_detail", complaint_id=complaint_id)
        with complaint.complaintee_photo.open("rb") as base_file:
            h1 = _hash_image_file(base_file)
        h2 = _hash_image_file(selfie)
        dist = _hamming_distance_64(h1, h2)
        score = max(0.0, min(1.0, 1.0 - (dist / 64.0)))
        complaint.closure_selfie_match_score = float(score)
        if score < min_score:
            messages.error(
                request,
                f"Verification failed: complaintee photo does not match (score {score:.2f}).",
            )
            complaint.save(
                update_fields=["closure_selfie_match_score", "closure_distance_m"]
            )
            return redirect("complaint_detail", complaint_id=complaint_id)
    except Exception as img_err:
        logger.exception("Complaint verification image processing failed: %s", img_err)
        messages.error(
            request,
            f"Verification failed: could not process the images ({img_err}).",
        )
        return redirect("complaint_detail", complaint_id=complaint_id)

    complaint.closure_selfie = selfie
    complaint.closure_latitude = lat
    complaint.closure_longitude = lng
    complaint.closure_timestamp = timezone.now()
    old_status = complaint.status
    complaint.status = "case_closed"
    complaint.save(
        update_fields=[
            "closure_selfie",
            "closure_latitude",
            "closure_longitude",
            "closure_timestamp",
            "closure_distance_m",
            "closure_selfie_match_score",
            "status",
            "updated_at",
        ]
    )

    WorkflowLog.objects.create(
        complaint=complaint,
        from_status=old_status,
        to_status="case_closed",
        action_by=request.user.username,
        action_type="case_closed",
        notes="Closed after photo and GPS verification.",
    )

    messages.success(request, "Complaint closed successfully after verification.")
    return redirect("complaint_detail", complaint_id=complaint_id)


@login_required
@require_POST
def resolve_photo_complaint_with_letter(request, complaint_id):
    """Resolve photo/document complaint using a resolution letter image."""
    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)

    if not complaint.uses_resolution_letter:
        messages.error(request, "This complaint is not a photo/document complaint.")
        return redirect("complaint_detail", complaint_id=complaint_id)
    if not complaint.closure_status_is_actionable:
        messages.error(
            request,
            "Complaint must be assigned for work before it can be closed.",
        )
        return redirect("complaint_detail", complaint_id=complaint_id)

    letter = request.FILES.get("resolution_letter_image")
    if not letter:
        messages.error(request, "Resolution letter image is required.")
        return redirect("complaint_detail", complaint_id=complaint_id)

    old_status = complaint.status
    complaint.resolution_letter_image = letter
    complaint.status = "case_closed"
    complaint.save(update_fields=["resolution_letter_image", "status", "updated_at"])

    WorkflowLog.objects.create(
        complaint=complaint,
        from_status=old_status,
        to_status="case_closed",
        action_by=request.user.username,
        action_type="case_closed",
        notes="Closed with resolution letter (photo/document complaint).",
    )
    messages.success(request, "Photo complaint closed with the resolution letter.")
    return redirect("complaint_detail", complaint_id=complaint_id)


@login_required
@require_POST
def force_resolve_complaint(request, complaint_id):
    """Admin-only force resolve path for operational emergencies."""
    if get_user_role(request.user) != Role.ADMIN:
        messages.error(request, "Only admin can force resolve complaints.")
        return redirect("complaint_detail", complaint_id=complaint_id)

    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
    if complaint.status == "case_closed":
        messages.info(request, "Complaint is already closed.")
        return redirect("complaint_detail", complaint_id=complaint_id)

    old_status = complaint.status
    complaint.status = "case_closed"
    complaint.save(update_fields=["status", "updated_at"])
    WorkflowLog.objects.create(
        complaint=complaint,
        from_status=old_status,
        to_status="case_closed",
        action_by=request.user.username,
        action_type="case_closed",
        notes="Force resolved by admin override.",
    )
    messages.success(request, "Complaint force resolved by admin.")
    return redirect("complaint_detail", complaint_id=complaint_id)


@login_required
def agent_dashboard(request):
    """Dashboard for survey agents to track their visits and complaints."""
    agents = SurveyAgent.objects.prefetch_related(
        "assigned_villages", "assigned_post_offices"
    ).annotate(
        total_visits=Count("surveyvisit"),
        complaints_this_month=Count("surveyvisit__complaints_collected"),
    )

    recent_visits = SurveyVisit.objects.select_related("agent", "village").order_by(
        "-visit_date"
    )[:10]

    return render(
        request,
        "core/agent_dashboard.html",
        {"agents": agents, "recent_visits": recent_visits},
    )
<<<<<<< HEAD


@csrf_exempt
def api_complaint_status(request, complaint_id):
    """API endpoint to get complaint status (for SMS integration)."""
    auth_error = _require_sms_webhook_secret(request)
    if auth_error:
        return auth_error

    try:
        complaint = Complaint.objects.get(complaint_id=complaint_id)
        return JsonResponse(
            {
                "complaint_id": complaint.complaint_id,
                "status": complaint.status,
                "status_display": complaint.get_status_display(),
                "villager_name": complaint.villager_name,
                "created_at": complaint.created_at.isoformat(),
                "last_updated": complaint.updated_at.isoformat(),
            }
        )
    except Complaint.DoesNotExist:
        return JsonResponse({"error": "Complaint not found"}, status=404)


@csrf_exempt
@require_POST
def api_update_via_sms(request):
    """API endpoint for SMS-based status updates."""
    auth_error = _require_sms_webhook_secret(request)
    if auth_error:
        return auth_error

    try:
        data = json.loads(request.body)
        complaint_id = data.get("complaint_id")
        sms_command = (data.get("command") or "").strip().upper()
        sender_phone = (data.get("phone") or "").strip()

        if not complaint_id or not sms_command or not sender_phone:
            return JsonResponse(
                {"error": "complaint_id, command, and phone are required"}, status=400
            )

        complaint = Complaint.objects.get(complaint_id=complaint_id)

        is_authorized = SurveyAgent.objects.filter(phone_number=sender_phone).exists()
        if not is_authorized:
            return JsonResponse({"error": "Unauthorized phone number"}, status=403)

        command_mapping = {
            "START": "work_in_progress",
            "PROGRESS": "work_in_progress",
            "DONE": "work_completed",
            "CHECKED": "sent_to_villager",
            "SATISFIED": "villager_satisfied",
            "UNSATISFIED": "villager_unsatisfied",
        }

        if sms_command in command_mapping:
            new_status = command_mapping[sms_command]
            old_status = complaint.status
            complaint.status = new_status
            complaint.save()

            WorkflowLog.objects.create(
                complaint=complaint,
                from_status=old_status,
                to_status=new_status,
                action_by=f"SMS from {sender_phone}",
                action_type="sms_update",
                notes=f"Updated via SMS command: {sms_command}",
            )

            return JsonResponse(
                {
                    "success": True,
                    "message": f"Status updated to {complaint.get_status_display()}",
                }
            )

        return JsonResponse({"error": "Invalid SMS command"}, status=400)
    except Complaint.DoesNotExist:
        return JsonResponse({"error": "Complaint not found"}, status=404)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=500)
=======
>>>>>>> 6a0a424 (Many changes in verification modules.)
