from django.conf import settings
from django.db import migrations
import hashlib
import hmac


def _is_hashed_code(value):
    if not value or len(value) != 64:
        return False
    return all(ch in "0123456789abcdef" for ch in value.lower())


def _hash_value(raw_value):
    key = getattr(settings, "VOICE_CODE_SECRET", None) or settings.SECRET_KEY
    if isinstance(key, str):
        key = key.encode("utf-8")
    return hmac.new(key, raw_value.encode("utf-8"), hashlib.sha256).hexdigest()


def forward_hash_voice_codes(apps, schema_editor):
    Gap = apps.get_model("core", "Gap")
    VoiceVerificationLog = apps.get_model("core", "VoiceVerificationLog")

    for gap in Gap.objects.exclude(voice_code__isnull=True).exclude(voice_code=""):
        if _is_hashed_code(gap.voice_code):
            continue
        gap.voice_code = _hash_value(gap.voice_code)
        gap.save(update_fields=["voice_code"])

    logs = VoiceVerificationLog.objects.exclude(
        verification_voice_code__isnull=True
    ).exclude(verification_voice_code="")
    for log in logs:
        if _is_hashed_code(log.verification_voice_code):
            continue
        log.verification_voice_code = _hash_value(log.verification_voice_code)
        log.save(update_fields=["verification_voice_code"])


def reverse_noop(apps, schema_editor):
    # One-way hardening migration; raw values cannot be recovered.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0026_add_audio_url_field"),
    ]

    operations = [
        migrations.RunPython(forward_hash_voice_codes, reverse_noop),
    ]
