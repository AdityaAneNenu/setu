from django.urls import path
from . import views, workflow_views

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
    path("delete-gap/<int:gap_id>/", views.delete_gap, name="delete_gap"),
    path("public-dashboard/", views.public_dashboard, name="public_dashboard"),
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
    path(
        "workflow/complaint/<str:complaint_id>/verify-close/",
        workflow_views.verify_and_close_complaint,
        name="verify_and_close_complaint",
    ),
    path(
        "workflow/complaint/<str:complaint_id>/resolve-photo/",
        workflow_views.resolve_photo_complaint_with_letter,
        name="resolve_photo_complaint_with_letter",
    ),
    path(
        "workflow/complaint/<str:complaint_id>/force-resolve/",
        workflow_views.force_resolve_complaint,
        name="force_resolve_complaint",
    ),
    path("workflow/agents/", workflow_views.agent_dashboard, name="agent_dashboard"),
<<<<<<< HEAD
    # API endpoints for SMS integration
    path(
        "api/complaint/<str:complaint_id>/status/",
        workflow_views.api_complaint_status,
        name="api_complaint_status",
    ),
    path("api/sms-update/", workflow_views.api_update_via_sms, name="api_sms_update"),
=======
>>>>>>> 6a0a424 (Many changes in verification modules.)
]
