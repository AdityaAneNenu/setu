from django.urls import path
from . import views, workflow_views, voice_views

urlpatterns = [
    path("", views.home, name="home"),
    path("post-login/", views.post_login_redirect, name="post_login_redirect"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("upload/", views.upload_form, name="upload_form"),
    path("analytics/", views.analytics, name="analytics"),
    path("manage-gaps/", views.manage_gaps, name="manage_gaps"),
    path("villages/", views.villages_list, name="villages_list"),
    path("villages/<int:village_id>/", views.village_detail, name="village_detail"),
    path(
        "villages/<int:village_id>/report/", views.village_report, name="village_report"
    ),
    path(
        "update-gap-status/<int:gap_id>/",
        views.update_gap_status,
        name="update_gap_status",
    ),
    path("public-dashboard/", views.public_dashboard, name="public_dashboard"),
    path("budget-management/", views.budget_management, name="budget_management"),
    path("update-budget/<int:gap_id>/", views.update_budget, name="update_budget"),
    # Workflow Management URLs
    path("workflow/", workflow_views.workflow_dashboard, name="workflow_dashboard"),
    path("workflow/submit/", workflow_views.submit_complaint, name="submit_complaint"),
    path(
        "workflow/complaint/<str:complaint_id>/",
        workflow_views.complaint_detail,
        name="complaint_detail",
    ),
    path(
        "workflow/complaint/<str:complaint_id>/update/",
        workflow_views.update_complaint_status,
        name="update_complaint_status",
    ),
    path("workflow/agents/", workflow_views.agent_dashboard, name="agent_dashboard"),
    # API endpoints for SMS integration
    path(
        "api/complaint/<str:complaint_id>/status/",
        workflow_views.api_complaint_status,
        name="api_complaint_status",
    ),
    path("api/sms-update/", workflow_views.api_update_via_sms, name="api_sms_update"),
    # QR Submissions Management
    path(
        "qr-submissions/",
        views.qr_submissions_management,
        name="qr_submissions_management",
    ),
    path(
        "qr-submissions/<int:submission_id>/",
        views.qr_submission_detail,
        name="qr_submission_detail",
    ),
    # Voice Verification URLs
    path(
        "voice-verification/<str:complaint_id>/",
        voice_views.voice_verification_dashboard,
        name="voice_verification_dashboard",
    ),
    path(
        "api/voice/verify/",
        voice_views.verify_voice_for_closure,
        name="verify_voice_for_closure",
    ),
    path(
        "api/voice/close-complaint/",
        voice_views.close_complaint_with_voice,
        name="close_complaint_with_voice",
    ),
    path(
        "api/voice/history/<str:complaint_id>/",
        voice_views.get_verification_history,
        name="get_verification_history",
    ),
    path(
        "api/voice/check-quality/",
        voice_views.check_audio_quality,
        name="check_audio_quality",
    ),
    path(
        "api/voice/test-comparison/",
        voice_views.test_voice_comparison,
        name="test_voice_comparison",
    ),
    # Gap Voice Verification URLs
    path(
        "voice-verification/gap/<int:gap_id>/",
        voice_views.gap_voice_verification_dashboard,
        name="gap_voice_verification_dashboard",
    ),
    path(
        "api/voice/verify-gap/",
        voice_views.verify_voice_for_gap_resolution,
        name="verify_voice_for_gap_resolution",
    ),
]
