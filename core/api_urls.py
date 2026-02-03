from django.urls import path
from . import api_views
from .test_views import test_connection

# Simple API URLs for mobile app and Next.js frontend
urlpatterns = [
    # Authentication endpoints
    path("api/auth/login/", api_views.LoginAPIView.as_view(), name="api_login"),
    path("api/auth/logout/", api_views.LogoutAPIView.as_view(), name="api_logout"),
    path("api/auth/profile/", api_views.get_user_profile, name="api_profile"),
    path("api/auth/user/", api_views.get_user_profile, name="api_user"),
    # Dashboard & Analytics
    path("api/dashboard/", api_views.api_dashboard_stats, name="api_dashboard"),
    path("api/analytics/", api_views.api_analytics, name="api_analytics"),
    # Villages API
    path("api/villages/", api_views.api_villages_list, name="api_villages"),
    # Gaps API
    path("api/gaps/", api_views.api_gaps_list, name="api_gaps"),
    path("api/gaps/<int:gap_id>/", api_views.api_gap_detail, name="api_gap_detail"),
    path(
        "api/gaps/<int:gap_id>/status/",
        api_views.api_update_gap_status,
        name="api_gap_status",
    ),
    path(
        "api/gaps/upload/", api_views.GapUploadAPIView.as_view(), name="api_gap_upload"
    ),
    # Budget API
    path("api/budget/", api_views.api_budget_list, name="api_budget_list"),
    path(
        "api/budget/summary/", api_views.api_budget_summary, name="api_budget_summary"
    ),
    path(
        "api/budget/<int:gap_id>/update/",
        api_views.api_budget_update,
        name="api_budget_update",
    ),
    # Public Dashboard API
    path(
        "api/public-dashboard/",
        api_views.api_public_dashboard,
        name="api_public_dashboard",
    ),
    # Workflow/Complaint API
    path(
        "api/workflow/complaints/",
        api_views.api_workflow_complaints,
        name="api_workflow_complaints",
    ),
    path(
        "api/workflow/stats/", api_views.api_workflow_stats, name="api_workflow_stats"
    ),
    path(
        "api/workflow/agents/",
        api_views.api_workflow_agents,
        name="api_workflow_agents",
    ),
    # Voice Verification API
    path(
        "api/voice/<int:gap_id>/logs/",
        api_views.api_voice_verification_logs,
        name="api_voice_logs",
    ),
    path(
        "api/voice/<int:gap_id>/submit/",
        api_views.VoiceVerificationSubmitAPIView.as_view(),
        name="api_voice_submit",
    ),
    path(
        "api/voice/<int:gap_id>/gap-details/",
        api_views.api_gap_for_verification,
        name="api_gap_for_verification",
    ),
    path(
        "api/voice/<int:gap_id>/resolve/",
        api_views.api_resolve_gap_with_voice,
        name="api_resolve_gap_with_voice",
    ),
    # QR submission endpoint for mobile app
    path(
        "api/qr-submissions/",
        api_views.QRSubmissionAPIView.as_view(),
        name="qr_submissions",
    ),
    # Test endpoint for connectivity checking
    path("api/test/", test_connection, name="test_connection"),
]
