"""
Admin Dashboard configuration for Django Unfold.
Provides dashboard widgets and badge callbacks for the modern admin interface.
"""

from django.utils import timezone
from datetime import timedelta


def dashboard_callback(request, context):
    """
    Callback for the admin dashboard.
    Returns context with statistics and recent activity.
    """
    from core.models import Village, Gap, Complaint, SurveyVisit

    # Get date ranges
    today = timezone.now()
    last_7_days = today - timedelta(days=7)
    last_30_days = today - timedelta(days=30)

    # Gap statistics
    total_gaps = Gap.objects.count()
    pending_gaps = Gap.objects.filter(status="pending").count()
    in_progress_gaps = Gap.objects.filter(status="in_progress").count()
    resolved_gaps = Gap.objects.filter(status="resolved").count()
    overdue_gaps = Gap.objects.filter(
        expected_completion__lt=today, status__in=["pending", "in_progress"]
    ).count()

    # Complaint statistics
    total_complaints = Complaint.objects.count()
    open_complaints = Complaint.objects.filter(status="open").count()
    high_priority_complaints = Complaint.objects.filter(
        priority_level="high", status__in=["open", "in_progress"]
    ).count()

    # Recent activity
    recent_gaps = Gap.objects.filter(created_at__gte=last_7_days).count()
    recent_complaints = Complaint.objects.filter(created_at__gte=last_7_days).count()

    # Village statistics
    total_villages = Village.objects.count()
    villages_with_gaps = (
        Village.objects.filter(gap__status__in=["pending", "in_progress"])
        .distinct()
        .count()
    )

    context.update(
        {
            "kpi": [
                {
                    "title": "Total Gaps",
                    "metric": total_gaps,
                    "footer": f"{recent_gaps} new this week",
                },
                {
                    "title": "Pending Gaps",
                    "metric": pending_gaps,
                    "footer": f"{overdue_gaps} overdue",
                },
                {
                    "title": "Open Complaints",
                    "metric": open_complaints,
                    "footer": f"{high_priority_complaints} high priority",
                },
                {
                    "title": "Villages Monitored",
                    "metric": total_villages,
                    "footer": f"{villages_with_gaps} with active issues",
                },
            ],
            "progress": [
                {
                    "title": "Gap Resolution Progress",
                    "description": f"{resolved_gaps} of {total_gaps} gaps resolved",
                    "value": (
                        int((resolved_gaps / total_gaps) * 100) if total_gaps > 0 else 0
                    ),
                },
                {
                    "title": "Complaint Resolution",
                    "description": f"Handling {total_complaints} total complaints",
                    "value": (
                        int(
                            ((total_complaints - open_complaints) / total_complaints)
                            * 100
                        )
                        if total_complaints > 0
                        else 0
                    ),
                },
            ],
        }
    )

    return context


def gap_badge_callback(request):
    """Return badge count for pending gaps"""
    from core.models import Gap

    pending_count = Gap.objects.filter(status="pending").count()
    if pending_count > 0:
        return pending_count
    return None


def complaint_badge_callback(request):
    """Return badge count for open complaints"""
    from core.models import Complaint

    open_count = Complaint.objects.filter(status="open").count()
    if open_count > 0:
        return open_count
    return None
