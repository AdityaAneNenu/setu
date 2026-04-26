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
    # Mobile App Sync Endpoints
    path(
        "api/mobile/gaps/sync/",
        api_views.MobileGapSyncAPIView.as_view(),
        name="api_mobile_gap_sync",
    ),
    path(
        "api/mobile/gaps/<str:firestore_id>/status/",
        api_views.api_mobile_gap_status_sync,
        name="api_mobile_gap_status_sync",
    ),
    path(
        "api/mobile/gaps/",
        api_views.api_mobile_gaps,
        name="api_mobile_gaps",
    ),
    path(
        "api/mobile/gaps/<int:gap_id>/resolve/",
        api_views.api_mobile_resolve_gap,
        name="api_mobile_resolve_gap",
    ),
    path(
        "api/mobile/complaints/submit/",
        api_views.api_mobile_submit_complaint,
        name="api_mobile_submit_complaint",
    ),
    path(
        "api/mobile/complaints/in-progress/",
        api_views.api_mobile_in_progress_complaints,
        name="api_mobile_in_progress_complaints",
    ),
    path(
        "api/mobile/complaints/<str:complaint_id>/verify-close/",
        api_views.api_mobile_verify_close_complaint,
        name="api_mobile_verify_close_complaint",
    ),
    path(
        "api/mobile/complaints/<str:complaint_id>/resolve-photo/",
        api_views.api_mobile_resolve_photo_complaint,
        name="api_mobile_resolve_photo_complaint",
    ),
    # Geo-tagged Photo Closure
    path(
        "api/gaps/<int:gap_id>/close-with-proof/",
        api_views.close_gap_with_photo_proof,
        name="api_close_gap_with_photo",
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
    # AI Analysis API
    path(
        "api/analyze-media/",
        api_views.api_analyze_media,
        name="api_analyze_media",
    ),
    # Test endpoint for connectivity checking
    path("api/test/", test_connection, name="test_connection"),
]
