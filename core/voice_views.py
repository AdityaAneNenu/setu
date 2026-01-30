"""
Views for Voice Verification System
API endpoints and views for voice-based complaint closure
"""

from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.files.storage import default_storage
from django.contrib import messages
from django.db import transaction
import json
import os

from .models import Complaint, VoiceVerificationLog
from .voice_verification import VoiceVerificationManager, VoiceComparator


@csrf_exempt
@require_http_methods(["POST"])
def verify_voice_for_closure(request):
    """
    API endpoint to verify voice before closing complaint

    POST parameters:
        - complaint_id: ID of the complaint
        - verification_audio: Audio file for verification
        - verified_by: Optional - name of person verifying

    Returns:
        JSON with verification result
    """
    try:
        complaint_id = request.POST.get("complaint_id")
        verified_by = request.POST.get("verified_by", "Unknown")

        if not complaint_id:
            return JsonResponse(
                {"success": False, "error": "Complaint ID is required"}, status=400
            )

        if "verification_audio" not in request.FILES:
            return JsonResponse(
                {"success": False, "error": "Verification audio file is required"},
                status=400,
            )

        # Get complaint
        complaint = get_object_or_404(Complaint, complaint_id=complaint_id)

        # Check if complaint already closed
        if complaint.status == "case_closed":
            return JsonResponse(
                {"success": False, "error": "Complaint is already closed"}, status=400
            )

        # Get verification audio
        verification_audio = request.FILES["verification_audio"]

        # Check audio quality first
        quality_check = VoiceVerificationManager.check_audio_quality(verification_audio)

        if not quality_check["is_good_quality"]:
            return JsonResponse(
                {
                    "success": False,
                    "error": "Audio quality insufficient",
                    "quality_check": quality_check,
                    "recommendations": quality_check.get("recommendations", []),
                },
                status=400,
            )

        # Perform voice verification
        verification_audio.seek(0)  # Reset file pointer
        verification_result = VoiceVerificationManager.verify_complaint_closure(
            complaint, verification_audio
        )

        # Update verification log with verified_by
        if verification_result.get("is_match"):
            latest_log = (
                VoiceVerificationLog.objects.filter(complaint=complaint)
                .order_by("-verification_date")
                .first()
            )

            if latest_log:
                latest_log.verified_by = verified_by
                latest_log.save()

        return JsonResponse(
            {
                "success": True,
                "verification": verification_result,
                "complaint_id": complaint_id,
                "can_close": verification_result["can_proceed"],
            }
        )

    except Complaint.DoesNotExist:
        return JsonResponse(
            {"success": False, "error": "Complaint not found"}, status=404
        )

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def close_complaint_with_voice(request):
    """
    Close complaint after successful voice verification

    POST parameters:
        - complaint_id: ID of the complaint
        - verification_audio: Audio file for verification
        - closure_notes: Optional notes about closure
    """
    try:
        complaint_id = request.POST.get("complaint_id")
        closure_notes = request.POST.get("closure_notes", "")

        if not complaint_id:
            return JsonResponse(
                {"success": False, "error": "Complaint ID is required"}, status=400
            )

        complaint = get_object_or_404(Complaint, complaint_id=complaint_id)

        # Check if already closed
        if complaint.status == "case_closed":
            return JsonResponse(
                {"success": False, "error": "Complaint is already closed"}, status=400
            )

        # Perform voice verification
        if "verification_audio" not in request.FILES:
            return JsonResponse(
                {
                    "success": False,
                    "error": "Voice verification is required to close complaint",
                },
                status=400,
            )

        verification_audio = request.FILES["verification_audio"]
        verification_result = VoiceVerificationManager.verify_complaint_closure(
            complaint, verification_audio
        )

        # Check if verification passed
        if not verification_result["can_proceed"]:
            return JsonResponse(
                {
                    "success": False,
                    "error": "Voice verification failed",
                    "verification": verification_result,
                    "message": "The voice does not match the original complaint. Closure denied.",
                },
                status=403,
            )

        # Voice verified - proceed with closure
        with transaction.atomic():
            complaint.status = "case_closed"
            complaint.save()

            # Mark verification as used for closure
            latest_log = (
                VoiceVerificationLog.objects.filter(complaint=complaint)
                .order_by("-verification_date")
                .first()
            )

            if latest_log:
                latest_log.used_for_closure = True
                latest_log.notes = closure_notes
                latest_log.save()

            # Create workflow log
            from .models import WorkflowLog

            WorkflowLog.objects.create(
                complaint=complaint,
                from_status=complaint.status,
                to_status="case_closed",
                action_by="Voice Verified Closure",
                action_type="case_closed",
                notes=f"Voice verified closure. Similarity: {verification_result['similarity_score']*100:.1f}%. {closure_notes}",
            )

        return JsonResponse(
            {
                "success": True,
                "message": "Complaint closed successfully after voice verification",
                "complaint_id": complaint_id,
                "verification": verification_result,
            }
        )

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@require_http_methods(["GET"])
def get_verification_history(request, complaint_id):
    """
    Get voice verification history for a complaint
    """
    try:
        complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
        history = VoiceVerificationManager.get_verification_history(complaint)

        history_data = [
            {
                "id": log.id,
                "verification_date": log.verification_date.isoformat(),
                "similarity_score": log.similarity_score,
                "similarity_percentage": log.similarity_percentage,
                "is_match": log.is_match,
                "confidence": log.confidence,
                "verified_by": log.verified_by,
                "used_for_closure": log.used_for_closure,
                "notes": log.notes,
            }
            for log in history
        ]

        return JsonResponse(
            {
                "success": True,
                "complaint_id": complaint_id,
                "total_attempts": len(history_data),
                "history": history_data,
            }
        )

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def check_audio_quality(request):
    """
    Check if audio quality is sufficient for verification
    """
    try:
        if "audio_file" not in request.FILES:
            return JsonResponse(
                {"success": False, "error": "Audio file is required"}, status=400
            )

        audio_file = request.FILES["audio_file"]
        quality_result = VoiceVerificationManager.check_audio_quality(audio_file)

        return JsonResponse({"success": True, "quality": quality_result})

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


def voice_verification_dashboard(request, complaint_id):
    """
    Web interface for voice verification
    """
    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
    verification_history = VoiceVerificationManager.get_verification_history(complaint)

    context = {
        "complaint": complaint,
        "has_original_audio": bool(complaint.audio_file),
        "verification_history": verification_history,
        "can_verify": complaint.status != "case_closed" and complaint.audio_file,
    }

    return render(request, "core/voice_verification_dashboard.html", context)


@csrf_exempt
@require_http_methods(["POST"])
def test_voice_comparison(request):
    """
    Test endpoint to compare two audio files
    Useful for testing and debugging
    """
    try:
        if "audio1" not in request.FILES or "audio2" not in request.FILES:
            return JsonResponse(
                {"success": False, "error": "Two audio files are required"}, status=400
            )

        audio1 = request.FILES["audio1"]
        audio2 = request.FILES["audio2"]

        # Save temporarily
        path1 = default_storage.save("temp_audio1.wav", audio1)
        path2 = default_storage.save("temp_audio2.wav", audio2)

        # Get full paths
        import os
        from django.conf import settings

        full_path1 = os.path.join(settings.MEDIA_ROOT, path1)
        full_path2 = os.path.join(settings.MEDIA_ROOT, path2)

        # Compare
        result = VoiceComparator.verify_voices(full_path1, full_path2)

        # Cleanup
        default_storage.delete(path1)
        default_storage.delete(path2)

        return JsonResponse({"success": True, "comparison_result": result})

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


def gap_voice_verification_dashboard(request, gap_id):
    """
    Voice verification dashboard specifically for Gap resolution
    Similar to complaint verification but for gaps
    """
    from .models import Gap

    gap = get_object_or_404(Gap, id=gap_id)

    # Check if gap has audio file
    if not gap.audio_file:
        messages.error(request, "This gap was not submitted via voice recording.")
        return render(
            request,
            "core/voice_verification_dashboard.html",
            {"error": "No audio file available for this gap", "gap": gap},
        )

    # Get verification history for this gap
    verification_logs = VoiceVerificationLog.objects.filter(gap=gap).order_by(
        "-verification_date"
    )

    context = {
        "gap": gap,
        "gap_id": gap.id,
        "original_audio_url": gap.audio_file.url if gap.audio_file else None,
        "has_original_audio": bool(gap.audio_file),
        "verification_history": verification_logs,
        "can_verify": gap.status != "resolved" and gap.audio_file,
        "is_gap_verification": True,  # Flag to differentiate from complaint verification
    }

    return render(request, "core/voice_verification_dashboard.html", context)


@csrf_exempt
@require_http_methods(["POST"])
def verify_voice_for_gap_resolution(request):
    """
    API endpoint to verify voice before resolving gap
    """
    try:
        from .models import Gap

        gap_id = request.POST.get("gap_id")
        verified_by = request.POST.get("verified_by", "Unknown")

        if not gap_id:
            return JsonResponse(
                {"success": False, "error": "Gap ID is required"}, status=400
            )

        if "verification_audio" not in request.FILES:
            return JsonResponse(
                {"success": False, "error": "Verification audio file is required"},
                status=400,
            )

        gap = get_object_or_404(Gap, id=gap_id)

        if not gap.audio_file:
            return JsonResponse(
                {
                    "success": False,
                    "error": "This gap has no original audio to verify against",
                },
                status=400,
            )

        # Get verification audio
        verification_audio = request.FILES["verification_audio"]

        # Perform VOICE BIOMETRIC verification (speaker recognition)
        # This compares the VOICE characteristics, not the words spoken
        # Different words are OK - we're verifying it's the SAME PERSON speaking
        result = VoiceVerificationManager.verify_gap_resolution(
            gap_obj=gap, verification_audio_file=verification_audio
        )

        # Extract voice codes from result
        verification_voice_code = result.get("verification_voice_code")

        # Update gap's voice code if not set
        if not gap.voice_code and result.get("original_voice_code"):
            gap.voice_code = result.get("original_voice_code")
            gap.save(update_fields=["voice_code"])
            print(f"✅ Stored voice code for Gap #{gap.id}")

        # Log the verification attempt (store gap reference in notes)
        log = VoiceVerificationLog.objects.create(
            complaint=None,  # No complaint for gaps
            verification_audio_path=result.get("verification_audio_path", ""),
            similarity_score=result.get("similarity_score", 0.0),
            is_match=result.get("is_match", False),
            confidence=result.get("confidence", "very_low"),
            verified_by=verified_by,
            used_for_closure=False,
            verification_voice_code=verification_voice_code,
            notes=f"Gap #{gap.id} - Voice biometric verification (speaker recognition)",
        )

        return JsonResponse(
            {
                "success": True,
                "verification": {
                    "is_match": result.get("is_match"),
                    "similarity_score": result.get("similarity_score"),
                    "confidence": result.get("confidence"),
                    "threshold": result.get("threshold_used"),
                    "message": result.get("message"),
                },
                "can_resolve": result.get("can_proceed", False),
                "log_id": log.id,
            }
        )

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)
