import logging
from django.core.mail import send_mail
from django.conf import settings


logger = logging.getLogger(__name__)

TEAM_EMAIL = "teamnpcars@gmail.com"


def _get_sender():
    """Choose a sender address with safe fallbacks."""
    return (
        getattr(settings, "DEFAULT_FROM_EMAIL", None)
        or getattr(settings, "EMAIL_HOST_USER", None)
        or "no-reply@example.com"
    )


def send_flag_email(subject: str, message: str, recipients: list[str]):
    """Send flag/escalation emails."""
    if not recipients:
        return
    unique_recipients = list({email for email in recipients if email})
    if not unique_recipients:
        return
    fail_silently = not getattr(settings, "DEBUG", False)
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=_get_sender(),
            recipient_list=unique_recipients,
            fail_silently=fail_silently,
        )
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Flag email send failed: %s", exc)


def send_resolution_email(subject: str, message: str, recipients: list[str]):
    """
    Send resolution notification emails.
    - In DEBUG, fail loudly to surface SMTP misconfig.
    - In non-DEBUG, fail silently but log the exception.
    """
    if not recipients:
        return

    unique_recipients = list({email for email in recipients if email})

    if not unique_recipients:
        return

    fail_silently = not getattr(settings, "DEBUG", False)

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=_get_sender(),
            recipient_list=unique_recipients,
            fail_silently=fail_silently,
        )
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Resolution email send failed: %s", exc)