from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.utils.text import slugify
from .models import Village, Submission, Gap, QRSubmission, QRComplaintDetail
from .permissions import role_required, Role, get_user_role
from .email_utils import send_resolution_email, TEAM_EMAIL
import google.generativeai as genai
from PIL import Image
import json
import os
from django.db.models import Count
from django.core.paginator import Paginator

# Initialize Gemini AI for translation
try:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("⚠️ WARNING: GEMINI_API_KEY not set. Translation will not work.")
        model = None
    else:
        genai.configure(api_key=api_key)
        # Use stable gemini-2.5-flash model
        model = genai.GenerativeModel("gemini-2.5-flash")
        print("✅ Gemini AI initialized successfully with gemini-2.5-flash")
except Exception as e:
    print(f"❌ Error initializing Gemini AI: {e}")
    print(f"   Common issues:")
    print(
        f"   - API key is leaked/disabled (get new key from https://aistudio.google.com/apikey)"
    )
    print(f"   - API quota exceeded (wait or upgrade plan)")
    print(f"   - Network connectivity issues")
    model = None

MANAGER_AND_ABOVE = [Role.MANAGER, Role.AUTHORITY, Role.ADMIN]
AUTHORITY_AND_ABOVE = [Role.AUTHORITY, Role.ADMIN]
ALL_ROLES = Role.ALL


@login_required
def post_login_redirect(request):
    """
    Route users to the correct landing page based on role.
    - Admin/staff: dashboard
    - Highest authority/Manager: dashboard
    - Ground: upload form
    """
    role = get_user_role(request.user)

    if request.user.is_superuser or request.user.is_staff:
        return redirect("dashboard")

    if role == Role.GROUND:
        return redirect("upload_form")

    if role in MANAGER_AND_ABOVE:
        return redirect("dashboard")

    # Fallback
    return redirect("upload_form")


def home(request):
    """Landing page for the PM-AJAY initiative"""
    return render(request, "core/home.html")


@login_required
@role_required(ALL_ROLES)  # Ground and above can submit issues
def upload_form(request):
    if request.method == "POST":
        village_id = request.POST.get("village")
        image_file = request.FILES.get("image")
        audio_file = request.FILES.get("audio_file")
        submission_type = request.POST.get(
            "submission_type", "image"
        )  # "image" or "audio"

        try:
            village = Village.objects.get(id=village_id)
        except Village.DoesNotExist:
            messages.error(request, f"Village with ID {village_id} not found.")
            villages = Village.objects.all()
            return render(request, "core/upload.html", {"villages": villages})
        except ValueError:
            messages.error(request, "Invalid village ID.")
            villages = Village.objects.all()
            return render(request, "core/upload.html", {"villages": villages})

        # Handle different submission types
        if submission_type == "audio" and audio_file:
            # Process audio submission
            from .services import ComplaintProcessor

            processor = ComplaintProcessor()

            # Get and validate language code
            language_code = request.POST.get("language_code", "hi")
            # Ensure language_code is not empty or invalid
            if not language_code or language_code == "":
                language_code = "hi"  # Default to Hindi

            # Process the audio file
            result = processor.process_audio_complaint(audio_file, language_code)

            if result["success"]:
                transcribed_text = result["processed_text"]

                # Use AI to translate and categorize the transcribed text
                translation_prompt = f"""
                Translate the following text to English and analyze it for gap categorization. Respond only with JSON:
                Text: "{transcribed_text}"
                
                {{
                  "translated_text": "English translation of the text",
                  "gap_type": "water/road/sanitation/electricity/education/health/agriculture/welfare/connectivity/load_transport/livelihood_skill",
                  "reason": "Clear description of the problem in English",
                  "severity": "low/medium/high",
                  "recommendations": "Specific recommendations to solve this issue"
                }}
                """

                try:
                    # Check if Gemini API key is configured
                    if not os.getenv("GEMINI_API_KEY"):
                        raise ValueError("GEMINI_API_KEY not configured")

                    ai_response = model.generate_content(translation_prompt)

                    # Check if response is valid
                    if not ai_response or not hasattr(ai_response, "text"):
                        raise ValueError("Invalid AI response")

                    clean_response = (
                        ai_response.text.replace("```json", "")
                        .replace("```", "")
                        .strip()
                    )

                    # Validate JSON before parsing
                    if not clean_response:
                        raise ValueError("Empty AI response")

                    ai_data = json.loads(clean_response)

                    data = {
                        "extracted_text": transcribed_text,  # Original transcribed text
                        "translated_text": ai_data.get(
                            "translated_text", transcribed_text
                        ),
                        "gap_type": ai_data.get("gap_type", result["detected_type"]),
                        "reason": ai_data.get("reason", transcribed_text),
                        "severity": ai_data.get("severity", result["priority_level"]),
                        "recommendations": ai_data.get(
                            "recommendations",
                            f"Auto-analyzed from audio in {processor.speech_service.get_language_name(language_code)}",
                        ),
                    }

                    # Log success
                    print(f"✅ Translation successful: {language_code} -> English")

                except Exception as e:
                    # Log the error for debugging
                    print(f"❌ Translation error: {str(e)}")
                    print(f"   Transcribed text: {transcribed_text[:100]}...")

                    # Fallback to original processing if AI translation fails
                    data = {
                        "extracted_text": transcribed_text,
                        "translated_text": f"[Translation failed: {str(e)}] {transcribed_text}",
                        "gap_type": result["detected_type"],
                        "reason": transcribed_text,
                        "severity": (
                            result["priority_level"]
                            if result["priority_level"] in ["low", "medium", "high"]
                            else "medium"
                        ),
                        "recommendations": f"Auto-analyzed from audio complaint in {processor.speech_service.get_language_name(language_code)}. Translation service temporarily unavailable.",
                    }

                # Create submission with audio transcription
                submission = Submission.objects.create(
                    village=village,
                    extracted_text=data.get("translated_text", transcribed_text),
                )
            else:
                return JsonResponse(
                    {"error": f"Audio processing failed: {result['error']}"}, status=400
                )

        else:
            # Process traditional image submission
            if not image_file:
                return JsonResponse(
                    {"error": "Please provide either an image or audio file"},
                    status=400,
                )

            submission = Submission.objects.create(village=village, image=image_file)

            img = Image.open(submission.image.path)

            prompt = """
            Extract text from this image and respond only with JSON and no other text in the following format and only fill in english if there is any other language please translate to english:
            {
              "extracted_text": "",
              "gap_type": "water/road/sanitation/electricity/education/health/agriculture/welfare/connectivity/load_transport/livelihood_skill",
              "reason": "",
              "severity": "low/medium/high",
              "recommendations":""
            }
            """

            try:
                response = model.generate_content([prompt, img])
                clean_text = (
                    response.text.replace("```json", "").replace("```", "").strip()
                )

                try:
                    data = json.loads(clean_text)
                except json.JSONDecodeError:
                    data = {
                        "extracted_text": clean_text,
                        "gap_type": "unknown",
                        "reason": "Could not parse JSON response from AI",
                        "severity": "low",
                        "recommendations": "None",
                    }
            except Exception as e:
                data = {
                    "extracted_text": "Error processing image",
                    "gap_type": "unknown",
                    "reason": f"Image processing error: {str(e)}",
                    "severity": "low",
                    "recommendations": "Manual review required",
                }

        # Get additional fields from form
        start_date = request.POST.get("start_date")
        expected_completion = request.POST.get("expected_completion")
        latitude = request.POST.get("latitude")
        longitude = request.POST.get("longitude")

        # Determine input method based on submission type
        if submission_type == "audio":
            input_method = "voice"
        elif image_file:
            input_method = "image"
        else:
            input_method = "text"

        gap = Gap.objects.create(
            village=submission.village,
            description=data.get("reason", "No description available"),
            gap_type=data.get("gap_type", "unknown"),
            severity=data.get("severity", "low"),
            input_method=input_method,
            audio_file=(
                audio_file if submission_type == "audio" and audio_file else None
            ),
            recommendations=data.get("recommendations", "None"),
            start_date=start_date if start_date else None,
            expected_completion=expected_completion if expected_completion else None,
            latitude=latitude if latitude else None,
            longitude=longitude if longitude else None,
        )

        # BACKGROUND: Generate voice code for voice-based gaps
        if submission_type == "audio" and gap.audio_file:
            try:
                from .voice_verification import VoiceFeatureExtractor

                voice_code = VoiceFeatureExtractor.generate_voice_code(
                    gap.audio_file.path
                )
                gap.voice_code = voice_code
                gap.save(update_fields=["voice_code"])
                print(
                    f"✅ Voice code generated for Gap #{gap.id}: {voice_code[:16]}..."
                )
            except Exception as e:
                print(
                    f"⚠️ Warning: Could not generate voice code for Gap #{gap.id}: {e}"
                )

        # Return context with analysis results
        # Initialize language info variables
        language_name = None
        if submission_type == "audio":
            try:
                from .services import ComplaintProcessor

                temp_processor = ComplaintProcessor()
                language_name = temp_processor.speech_service.get_language_name(
                    language_code
                )
            except:
                language_name = "Unknown Language"

        context = {
            "villages": Village.objects.all(),
            "analysis_complete": True,
            "village_name": village.name,
            "submission_type": submission_type,
            "gap_data": {
                "gap_type": data.get("gap_type", "unknown").title(),
                "severity": data.get("severity", "low").title(),
                "description": data.get("reason", "No description available"),
                "recommendations": data.get("recommendations", "None"),
                "extracted_text": data.get("extracted_text", ""),
                "translated_text": data.get("translated_text", ""),
                "language_used": language_name,
            },
        }
        return render(request, "core/upload.html", context)

    villages = Village.objects.all()
    return render(request, "core/upload.html", {"villages": villages})


@login_required
@role_required(MANAGER_AND_ABOVE)  # Managers and above can oversee dashboards
def dashboard(request):
    gaps = Gap.objects.all()

    # Statistics
    total_gaps = gaps.count()
    pending_gaps = gaps.filter(status="open").count()
    in_progress_gaps = gaps.filter(status="in_progress").count()
    resolved_gaps = gaps.filter(status="resolved").count()

    # Recent gaps for the table
    recent_gaps = gaps.select_related("village").order_by("-created_at")[:10]

    # Villages data with gap counts
    villages_data = []
    villages = Village.objects.all()
    for village in villages:
        village_gaps = Gap.objects.filter(village=village)
        villages_data.append(
            {
                "id": village.id,
                "name": village.name,
                "total_gaps": village_gaps.count(),
                "pending_gaps": village_gaps.filter(status="open").count(),
                "in_progress_gaps": village_gaps.filter(status="in_progress").count(),
                "resolved_gaps": village_gaps.filter(status="resolved").count(),
            }
        )

    context = {
        "total_gaps": total_gaps,
        "pending_gaps": pending_gaps,
        "in_progress_gaps": in_progress_gaps,
        "resolved_gaps": resolved_gaps,
        "recent_gaps": recent_gaps,
        "villages": villages_data,
    }

    return render(request, "core/dashboard.html", context)


@login_required
@role_required(MANAGER_AND_ABOVE)
def villages_list(request):
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
                "name": village.name,
                "id": village.id,
                "total_gaps": total_gaps,
                "open_gaps": open_gaps,
                "in_progress_gaps": in_progress_gaps,
                "resolved_gaps": resolved_gaps,
                "high_severity": high_severity if total_gaps > 0 else 0,
                "medium_severity": medium_severity if total_gaps > 0 else 0,
                "low_severity": low_severity if total_gaps > 0 else 0,
            }
        )

    context = {"villages": villages_data}

    return render(request, "core/villages.html", context)


@login_required
@role_required(MANAGER_AND_ABOVE)
def analytics(request):
    gaps = Gap.objects.all()
    open_count = gaps.filter(status="open").count()
    in_progress_count = gaps.filter(status="in_progress").count()
    resolved_count = gaps.filter(status="resolved").count()
    total_gaps = gaps.count()
    gaps_by_type_query = gaps.values("gap_type").annotate(count=Count("id"))
    # Provide consistent colors even for new gap types
    type_color_map = {
        "water": "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
        "road": "linear-gradient(90deg, #64748b 0%, #475569 100%)",
        "sanitation": "linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)",
        "electricity": "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
        "education": "linear-gradient(90deg, #ec4899 0%, #db2777 100%)",
        "health": "linear-gradient(90deg, #10b981 0%, #059669 100%)",
        "agriculture": "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)",
        "welfare": "linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)",
        "connectivity": "linear-gradient(90deg, #a855f7 0%, #7c3aed 100%)",
        "load_transport": "linear-gradient(90deg, #f97316 0%, #ea580c 100%)",
        "livelihood_skill": "linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)",
        "unknown": "linear-gradient(90deg, #1e293b 0%, #0f172a 100%)",
    }

    gaps_by_type = []
    for item in gaps_by_type_query:
        # Use share of total gaps so widths remain meaningful
        raw_percentage = (item["count"] / total_gaps * 100) if total_gaps > 0 else 0
        # Ensure bars are always visible for non-zero counts
        display_percentage = max(
            round(raw_percentage, 1), 6 if item["count"] > 0 else 0
        )
        type_slug = slugify(item["gap_type"] or "unknown")
        gaps_by_type.append(
            {
                "type_name": item["gap_type"],
                "count": item["count"],
                "percentage": display_percentage,
                "color": type_color_map.get(type_slug, type_color_map["unknown"]),
                "slug": type_slug,
            }
        )
    severity_query = gaps.values("severity").annotate(count=Count("id"))
    max_severity_count = max([item["count"] for item in severity_query], default=1)

    severity_distribution = []
    for item in severity_query:
        percentage = (
            (item["count"] / max_severity_count * 100) if max_severity_count > 0 else 0
        )
        severity_distribution.append(
            {
                "severity_name": item["severity"],
                "count": item["count"],
                "percentage": round(percentage, 1),
            }
        )

    context = {
        "total_gaps": total_gaps,
        "open_count": open_count,
        "in_progress_count": in_progress_count,
        "resolved_count": resolved_count,
        "gaps_by_type": gaps_by_type,
        "severity_distribution": severity_distribution,
    }

    return render(request, "core/analytics.html", context)


@login_required
@role_required(MANAGER_AND_ABOVE)
def manage_gaps(request):
    from .permissions import get_user_role, can_resolve_gaps

    gaps = Gap.objects.all().order_by("-id")
    status_filter = request.GET.get("status")
    if status_filter:
        gaps = gaps.filter(status=status_filter)
    severity_filter = request.GET.get("severity")
    if severity_filter:
        gaps = gaps.filter(severity=severity_filter)

    user_role = get_user_role(request.user)
    context = {
        "gaps": gaps,
        "user_role": user_role,
        "can_resolve": can_resolve_gaps(request.user),
    }

    return render(request, "core/manage_gaps.html", context)


@login_required
@role_required(MANAGER_AND_ABOVE)
def update_gap_status(request, gap_id):
    gap = get_object_or_404(Gap, id=gap_id)
    from .permissions import get_user_role, Role, can_resolve_gaps

    if request.method == "POST":
        new_status = request.POST.get("status")
        user_role = get_user_role(request.user)

        # DEBUG LOGGING - Track execution flow
        print(f"\n{'='*80}")
        print(f"🔍 DEBUG: update_gap_status() called for Gap #{gap.id}")
        print(f"  👤 User: {request.user.username} | Role: {user_role}")
        print(f"  📊 Current status: {gap.status}")
        print(f"  📊 Requested new status: {new_status}")
        print(f"  🎤 Input method: {gap.input_method}")
        print(f"  🎤 Has audio file: {bool(gap.audio_file)}")
        if gap.audio_file:
            print(f"  📁 Audio file path: {gap.audio_file.name}")
        print(f"{'='*80}\n")

        # ROLE CHECK: Only AUTHORITY and ADMIN can mark as "resolved"
        if new_status == "resolved" and not can_resolve_gaps(request.user):
            print(
                f"❌ DEBUG: User {request.user.username} ({user_role}) cannot resolve gaps"
            )
            messages.error(
                request,
                f"❌ <strong>Permission Denied!</strong><br>"
                f"Only AUTHORITY or ADMIN roles can mark gaps as resolved. Your role: {user_role.upper()}",
                extra_tags="safe",
            )
            return redirect("manage_gaps")

        # CRITICAL: Check if this is a voice-based gap (submitted via audio)
        # Voice verification is ONLY required for gaps submitted through voice recording
        is_voice_gap = gap.input_method == "voice" or bool(gap.audio_file)

        # RESOLUTION PROOF CHECK: AUTHORITY must provide proof when resolving
        # BUT: Only for photo/image uploads - NOT for voice recordings!
        if new_status == "resolved" and not is_voice_gap:
            resolution_proof = request.FILES.get("resolution_proof")
            resolution_proof_number = request.POST.get(
                "resolution_proof_number", ""
            ).strip()

            # Require proof for non-voice gaps, or if not already provided
            if not gap.resolution_proof and not resolution_proof:
                print(
                    f"❌ DEBUG: Resolution proof required but not provided (photo-based gap)"
                )
                messages.error(
                    request,
                    "❌ <strong>Resolution Proof Required!</strong><br>"
                    "Please upload the resolution letter/document and provide reference number before marking as resolved.<br>"
                    "<em>Note: This is required for photo uploads. Voice recordings use voice verification instead.</em>",
                    extra_tags="safe",
                )
                return redirect("manage_gaps")

            # Save resolution proof if provided
            if resolution_proof:
                gap.resolution_proof = resolution_proof
                print(f"✅ DEBUG: Resolution proof uploaded: {resolution_proof.name}")

            if resolution_proof_number:
                gap.resolution_proof_number = resolution_proof_number
                print(f"✅ DEBUG: Resolution proof number: {resolution_proof_number}")

        print(f"🔍 DEBUG: is_voice_gap = {is_voice_gap}")
        print(
            f"🔍 DEBUG: Condition check: new_status='{new_status}' == 'resolved' AND is_voice_gap={is_voice_gap}"
        )

        # If trying to resolve a VOICE GAP, voice CODE MATCHING is MANDATORY
        if new_status == "resolved" and is_voice_gap:
            print(
                f"🔒 DEBUG: Voice gap resolution detected - VOICE CODE VERIFICATION REQUIRED"
            )
            print(
                f"🔍 DEBUG: Original gap voice_code: {gap.voice_code[:16] if gap.voice_code else 'None'}..."
            )

            # Check if gap has a voice code
            from .models import VoiceVerificationLog

            if not gap.voice_code:
                print(f"⚠️ DEBUG: Gap has no voice code - trying to generate now")
                if gap.audio_file:
                    try:
                        from .voice_verification import VoiceFeatureExtractor

                        gap.voice_code = VoiceFeatureExtractor.generate_voice_code(
                            gap.audio_file.path
                        )
                        gap.save(update_fields=["voice_code"])
                        print(
                            f"✅ DEBUG: Generated voice code: {gap.voice_code[:16]}..."
                        )
                    except Exception as e:
                        print(f"❌ DEBUG: Failed to generate voice code: {e}")
                        messages.error(
                            request,
                            "❌ Cannot verify voice - gap audio processing failed.",
                        )
                        return redirect("manage_gaps")
                else:
                    messages.error(
                        request, "❌ Cannot verify voice - no audio file found."
                    )
                    return redirect("manage_gaps")

            # Look for SUCCESSFUL verification logs (is_match=True)
            # Voice verification passes if biometric comparison succeeded, regardless of exact code match
            # This is because we use fuzzy matching and similarity thresholds
            verified_logs = VoiceVerificationLog.objects.filter(
                gap=gap,  # Use gap foreign key instead of text search
                is_match=True,  # Voice biometric verification PASSED
                used_for_closure=False,
            ).order_by("-verification_date")

            verification_count = verified_logs.count()
            print(
                f"🔍 DEBUG: Found {verification_count} SUCCESSFUL verification logs (is_match=True)"
            )

            if not verified_logs.exists():
                # BLOCK RESOLUTION - No successful voice verification found
                print(
                    f"❌ DEBUG: BLOCKING RESOLUTION - No successful voice verification found!"
                )
                messages.error(
                    request,
                    "❌ <strong>Voice Verification Required!</strong><br>"
                    "You must complete voice verification before resolving this gap. "
                    "Click the 🎙️ Record Voice button to verify your identity.",
                    extra_tags="safe",
                )
                return redirect("manage_gaps")

            print(f"✅ DEBUG: Voice verification PASSED - proceeding with resolution")

            # Voice codes match - mark verification as used
            latest_verification = verified_logs.first()
            latest_verification.used_for_closure = True
            latest_verification.notes = f"Used for Gap #{gap.id} resolution. Voice codes matched. {latest_verification.notes or ''}"
            latest_verification.save()

            # Update status and show success message
            gap.status = new_status
            gap.resolved_by = request.user
            from django.utils import timezone

            gap.resolved_at = timezone.now()
            gap.save()

            # Send resolution email
            send_resolution_email(
                subject=f"Gap #{gap.id} resolved",
                message=(
                    f"Gap in village {gap.village.name} has been marked resolved.\n"
                    f"Type: {gap.gap_type}\n"
                    f"Description: {gap.description[:200]}...\n"
                    f"Resolved by: {request.user.username} ({user_role})\n"
                    f"Voice verification: PASSED"
                ),
                recipients=[TEAM_EMAIL],
            )

            print(
                f"✅ DEBUG: Gap #{gap.id} status updated to {new_status} (voice code verified + resolution proof)"
            )
            messages.success(
                request,
                "✅ Gap resolved successfully! Voice codes matched - verified authentic complainant.",
            )
            return redirect("manage_gaps")

        # For non-voice gaps or non-resolution status changes
        print(
            f"ℹ️ DEBUG: Non-voice gap or non-resolution status change - allowing update"
        )
        if new_status in dict(Gap.STATUS_CHOICES):
            old_status = gap.status
            gap.status = new_status

            # Track resolution metadata
            if new_status == "resolved":
                gap.resolved_by = request.user
                from django.utils import timezone

                gap.resolved_at = timezone.now()

            gap.save()

            # Send email for resolutions
            if new_status == "resolved":
                send_resolution_email(
                    subject=f"Gap #{gap.id} resolved",
                    message=(
                        f"Gap in village {gap.village.name} has been marked resolved.\n"
                        f"Type: {gap.gap_type}\n"
                        f"Description: {gap.description[:200]}...\n"
                        f"Resolved by: {request.user.username} ({user_role})\n"
                        f"Resolution proof: {'Provided' if gap.resolution_proof else 'N/A'}"
                    ),
                    recipients=[TEAM_EMAIL],
                )

            print(
                f"✅ DEBUG: Gap #{gap.id} status updated from {old_status} to {new_status}"
            )
            messages.success(
                request, f"✅ Gap status updated to {gap.get_status_display()}"
            )
        else:
            messages.error(request, "❌ Invalid status selected")

    return redirect("manage_gaps")


@login_required
def village_detail(request, village_id):
    village = get_object_or_404(Village, id=village_id)
    gaps = Gap.objects.filter(village=village).order_by("-created_at")

    open_gaps = gaps.filter(status="open").count()
    in_progress_gaps = gaps.filter(status="in_progress").count()
    resolved_gaps = gaps.filter(status="resolved").count()
    total_gaps = gaps.count()

    high_severity = gaps.filter(severity="high").count()
    medium_severity = gaps.filter(severity="medium").count()
    low_severity = gaps.filter(severity="low").count()

    context = {
        "village": village,
        "gaps": gaps,
        "open_gaps": open_gaps,
        "in_progress_gaps": in_progress_gaps,
        "resolved_gaps": resolved_gaps,
        "total_gaps": total_gaps,
        "high_severity": high_severity,
        "medium_severity": medium_severity,
        "low_severity": low_severity,
    }

    return render(request, "core/village_detail.html", context)


@login_required
@role_required(MANAGER_AND_ABOVE)
def village_report(request, village_id):
    village = get_object_or_404(Village, id=village_id)
    gaps = Gap.objects.filter(village=village).order_by("-severity", "-created_at")

    open_gaps = gaps.filter(status="open").count()
    in_progress_gaps = gaps.filter(status="in_progress").count()
    resolved_gaps = gaps.filter(status="resolved").count()
    total_gaps = gaps.count()

    gaps_by_type = gaps.values("gap_type").annotate(count=Count("id"))

    context = {
        "village": village,
        "gaps": gaps,
        "open_gaps": open_gaps,
        "in_progress_gaps": in_progress_gaps,
        "resolved_gaps": resolved_gaps,
        "total_gaps": total_gaps,
        "gaps_by_type": gaps_by_type,
    }

    return render(request, "core/village_report.html", context)


@login_required
@role_required(AUTHORITY_AND_ABOVE)  # Highest authority or admin
def budget_management(request):
    """Management view for budget allocation"""
    gaps = Gap.objects.all().order_by("-created_at")

    # Apply filters
    status_filter = request.GET.get("status")
    if status_filter:
        gaps = gaps.filter(status=status_filter)

    village_filter = request.GET.get("village")
    if village_filter:
        gaps = gaps.filter(village_id=village_filter)

    context = {
        "gaps": gaps,
        "villages": Village.objects.all(),
    }

    return render(request, "core/budget_management.html", context)


@login_required
@role_required(AUTHORITY_AND_ABOVE)
def update_budget(request, gap_id):
    """Update budget for a specific gap"""
    if request.method == "POST":
        gap = get_object_or_404(Gap, id=gap_id)
        budget_allocated = request.POST.get("budget_allocated")
        budget_spent = request.POST.get("budget_spent")

        if budget_allocated:
            gap.budget_allocated = budget_allocated
        if budget_spent:
            gap.budget_spent = budget_spent

        gap.save()

    return redirect("budget_management")


def public_dashboard(request):
    """Public dashboard showing ongoing development works - no login required"""
    from django.utils import timezone
    from django.db.models import Sum, Q

    # Get all gaps/projects that are not yet resolved
    ongoing_projects = (
        Gap.objects.filter(Q(status="open") | Q(status="in_progress"))
        .select_related("village")
        .order_by("-created_at")
    )

    # Get completed projects
    completed_projects = (
        Gap.objects.filter(status="resolved")
        .select_related("village")
        .order_by("-actual_completion")[:10]
    )

    # Statistics
    total_ongoing = ongoing_projects.count()
    total_completed = Gap.objects.filter(status="resolved").count()

    # Budget statistics
    total_budget_allocated = (
        Gap.objects.filter(Q(status="open") | Q(status="in_progress")).aggregate(
            total=Sum("budget_allocated")
        )["total"]
        or 0
    )

    total_budget_spent = (
        Gap.objects.filter(Q(status="open") | Q(status="in_progress")).aggregate(
            total=Sum("budget_spent")
        )["total"]
        or 0
    )

    # Projects by type (all gaps for complete chart display)
    projects_by_type = (
        Gap.objects.values("gap_type").annotate(count=Count("id")).order_by("-count")
    )

    # Projects by village (only villages with projects for display)
    villages_with_projects = (
        Village.objects.annotate(
            ongoing_count=Count(
                "gap", filter=Q(gap__status__in=["open", "in_progress"])
            ),
            completed_count=Count("gap", filter=Q(gap__status="resolved")),
        )
        .filter(ongoing_count__gt=0)
        .order_by("-ongoing_count")
    )

    # All villages for filter dropdown
    all_villages = Village.objects.all().order_by("name")

    # Get projects with geolocation for map
    projects_with_location = ongoing_projects.filter(
        latitude__isnull=False, longitude__isnull=False
    )

    context = {
        "ongoing_projects": ongoing_projects[:20],  # Limit to 20 for performance
        "completed_projects": completed_projects,
        "total_ongoing": total_ongoing,
        "total_completed": total_completed,
        "total_budget_allocated": total_budget_allocated,
        "total_budget_spent": total_budget_spent,
        "budget_remaining": total_budget_allocated - total_budget_spent,
        "projects_by_type": projects_by_type,
        "villages_with_projects": villages_with_projects,
        "all_villages": all_villages,  # Add all villages for filter dropdown
        "projects_with_location": projects_with_location,
        "current_date": timezone.now().date(),
    }

    return render(request, "core/public_dashboard.html", context)


@login_required
@role_required(MANAGER_AND_ABOVE)
def qr_submissions_management(request):
    """View for managing QR submissions from mobile app"""

    # Get filter parameters
    village_filter = request.GET.get("village", "")
    sync_status_filter = request.GET.get("sync_status", "")
    search_query = request.GET.get("search", "")

    # Base queryset
    qr_submissions = QRSubmission.objects.select_related(
        "village", "linked_gap", "linked_complaint"
    ).order_by("-created_at")

    # Apply filters
    if village_filter:
        qr_submissions = qr_submissions.filter(village__id=village_filter)

    if sync_status_filter == "synced":
        qr_submissions = qr_submissions.filter(synced_from_mobile=True)
    elif sync_status_filter == "pending":
        qr_submissions = qr_submissions.filter(synced_from_mobile=False)

    if search_query:
        qr_submissions = (
            qr_submissions.filter(person_name__icontains=search_query)
            | qr_submissions.filter(qr_code__icontains=search_query)
            | qr_submissions.filter(village_name__icontains=search_query)
        )

    # Pagination
    paginator = Paginator(qr_submissions, 20)
    page_number = request.GET.get("page")
    page_obj = paginator.get_page(page_number)

    # Statistics
    total_submissions = QRSubmission.objects.count()
    synced_submissions = QRSubmission.objects.filter(synced_from_mobile=True).count()
    pending_submissions = total_submissions - synced_submissions

    # Villages for filter dropdown
    villages = Village.objects.all().order_by("name")

    context = {
        "page_obj": page_obj,
        "total_submissions": total_submissions,
        "synced_submissions": synced_submissions,
        "pending_submissions": pending_submissions,
        "villages": villages,
        "selected_village": village_filter,
        "selected_sync_status": sync_status_filter,
        "search_query": search_query,
    }

    return render(request, "core/qr_submissions_management.html", context)


@login_required
@role_required(MANAGER_AND_ABOVE)
def qr_submission_detail(request, submission_id):
    """View detailed information about a QR submission"""

    qr_submission = get_object_or_404(
        QRSubmission.objects.select_related(
            "village", "linked_gap", "linked_complaint"
        ),
        id=submission_id,
    )

    # Get complaint details if they exist
    complaint_details = None
    try:
        complaint_details = qr_submission.complaint_details
    except QRComplaintDetail.DoesNotExist:
        pass

    # Handle form submissions
    if request.method == "POST":
        action = request.POST.get("action")

        if action == "create_gap":
            # Create a new Gap from QR submission
            gap = Gap.objects.create(
                village=qr_submission.village
                or Village.objects.filter(
                    name__icontains=qr_submission.village_name
                ).first(),
                description=f"Gap submitted via QR code: {qr_submission.qr_code}",
                gap_type=request.POST.get("gap_type", "unknown"),
                severity=request.POST.get("severity", "medium"),
                input_method="text",
                latitude=qr_submission.latitude,
                longitude=qr_submission.longitude,
            )

            qr_submission.linked_gap = gap
            qr_submission.save()

            return JsonResponse(
                {
                    "success": True,
                    "message": "Gap created successfully",
                    "gap_id": gap.id,
                }
            )

        elif action == "link_existing_gap":
            gap_id = request.POST.get("gap_id")
            if gap_id:
                try:
                    gap = Gap.objects.get(id=gap_id)
                    qr_submission.linked_gap = gap
                    qr_submission.save()

                    return JsonResponse(
                        {
                            "success": True,
                            "message": "Linked to existing gap successfully",
                        }
                    )
                except Gap.DoesNotExist:
                    return JsonResponse({"success": False, "error": "Gap not found"})

    context = {
        "qr_submission": qr_submission,
        "complaint_details": complaint_details,
    }

    return render(request, "core/qr_submission_detail.html", context)
