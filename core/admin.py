from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group, User
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

# Register your models here.
from .models import (
    Complaint,
    Gap,
    GapStatusAuditLog,
    PMAJAYOffice,
    PostOffice,
    QRComplaintDetail,
    QRSubmission,
    Submission,
    SurveyAgent,
    SurveyVisit,
    UserProfile,
    Village,
    Worker,
    WorkflowLog,
)

# Unregister the default User and Group admins
admin.site.unregister(User)
admin.site.unregister(Group)


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    """Enhanced User admin with Unfold styling"""

    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "display_staff",
        "display_active",
    )
    list_filter_submit = True

    @display(description="Staff", boolean=True)
    def display_staff(self, obj):
        return obj.is_staff

    @display(description="Active", boolean=True)
    def display_active(self, obj):
        return obj.is_active


@admin.register(Group)
class GroupAdmin(ModelAdmin):
    """Enhanced Group admin with Unfold styling"""

    list_display = ("name", "user_count")
    search_fields = ("name",)
    filter_horizontal = ("permissions",)

    @display(description="Users")
    def user_count(self, obj):
        return obj.user_set.count()


@admin.register(Village)
class VillageAdmin(ModelAdmin):
    list_display = ("name", "id", "gap_count")
    search_fields = ("name",)
    list_filter_submit = True

    @display(description="Active Gaps", ordering="id")
    def gap_count(self, obj):
        count = obj.gap_set.exclude(status="resolved").count()
        if count > 0:
            return format_html(
                '<span style="color: #f97316; font-weight: 600;">{}</span>', count
            )
        return format_html('<span style="color: #22c55e; font-weight: 600;">0</span>')


@admin.register(Submission)
class SubmissionAdmin(ModelAdmin):
    list_display = ("village", "image", "created_at")
    list_filter = ("created_at", "village")
    search_fields = ("village__name",)
    list_filter_submit = True


@admin.register(Gap)
class GapAdmin(ModelAdmin):
    list_display = (
        "id",
        "village",
        "gap_type",
        "display_severity",
        "display_status",
        "resolved_by",
        "resolution_status",
        "start_date",
        "expected_completion",
        "display_overdue",
    )
    list_filter = ("status", "severity", "gap_type", "created_at", "resolved_by")
    search_fields = (
        "village__name",
        "description",
        "gap_type",
        "resolution_proof_number",
    )
    readonly_fields = (
        "created_at",
        "is_overdue",
        "resolved_by",
        "resolved_at",
        "closure_photo_url",
        "closure_latitude",
        "closure_longitude",
        "closure_photo_timestamp",
    )
    list_filter_submit = True
    list_per_page = 25
    date_hierarchy = "created_at"

    @display(
        description="Severity",
        label={
            "high": "danger",
            "medium": "warning",
            "low": "info",
        },
    )
    def display_severity(self, obj):
        return obj.severity

    @display(
        description="Status",
        label={
            "resolved": "success",
            "in_progress": "warning",
            "pending": "info",
        },
    )
    def display_status(self, obj):
        return obj.status

    @display(description="Overdue", boolean=True)
    def display_overdue(self, obj):
        return obj.is_overdue

    def resolution_status(self, obj):
        if obj.status == "resolved":
            if obj.resolution_proof:
                return format_html(
                    '<span style="color: #22c55e;">✅ Proof Uploaded</span>'
                )
            return format_html('<span style="color: #f97316;">⚠️ No Proof</span>')
        return "-"

    resolution_status.short_description = "Resolution Proof"

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "village",
                    "gap_type",
                    "severity",
                    "status",
                    "description",
                    "recommendations",
                ),
                "classes": ["tab"],
            },
        ),
        (
            "Resolution Tracking",
            {
                "fields": (
                    "resolution_proof",
                    "resolution_proof_number",
                    "resolved_by",
                    "resolved_at",
                ),
                "description": "Resolution proof required by ADMIN role",
                "classes": ["tab"],
            },
        ),
        (
            "Timeline",
            {
                "fields": (
                    "start_date",
                    "expected_completion",
                    "actual_completion",
                    "created_at",
                    "is_overdue",
                ),
                "classes": ["tab"],
            },
        ),
        (
            "Location",
            {
                "fields": ("latitude", "longitude"),
                "classes": ["tab"],
            },
        ),
        (
            "Closure Photo Proof",
            {
                "fields": (
                    "closure_photo_url",
                    "closure_latitude",
                    "closure_longitude",
                    "closure_photo_timestamp",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    def is_overdue(self, obj):
        return obj.is_overdue

    is_overdue.boolean = True
    is_overdue.short_description = "Overdue?"

    def get_readonly_fields(self, request, obj=None):
        """Make certain fields always readonly"""
        return (
            "created_at",
            "is_overdue",
            "resolved_by",
            "resolved_at",
            "closure_photo_url",
            "closure_latitude",
            "closure_longitude",
            "closure_photo_timestamp",
        )


@admin.register(GapStatusAuditLog)
class GapStatusAuditLogAdmin(ModelAdmin):
    """Admin for viewing gap status change audit logs"""

    list_display = (
        "gap",
        "display_old_status",
        "display_new_status",
        "changed_by",
        "changed_at",
        "display_source",
    )
    list_filter = ("new_status", "source", "changed_at")
    search_fields = ("gap__description", "notes", "changed_by__username")
    readonly_fields = (
        "gap",
        "old_status",
        "new_status",
        "changed_by",
        "changed_at",
        "notes",
        "source",
    )
    ordering = ("-changed_at",)
    date_hierarchy = "changed_at"
    list_filter_submit = True

    @display(description="From Status", label=True)
    def display_old_status(self, obj):
        return obj.old_status or "N/A"

    @display(
        description="To Status",
        label={
            "resolved": "success",
            "in_progress": "warning",
            "pending": "info",
        },
    )
    def display_new_status(self, obj):
        return obj.new_status

    @display(
        description="Source",
        label={
            "admin": "info",
            "api": "warning",
            "system": "success",
        },
    )
    def display_source(self, obj):
        return obj.source or "admin"

    def has_add_permission(self, request):
        """Audit logs should not be manually created"""
        return False

    def has_change_permission(self, request, obj=None):
        """Audit logs should not be modified"""
        return False

    def has_delete_permission(self, request, obj=None):
        """Only superusers can delete audit logs"""
        return request.user.is_superuser


@admin.register(PostOffice)
class PostOfficeAdmin(ModelAdmin):
    list_display = ("name", "pincode", "district", "state", "postmaster_name")
    list_filter = ("state", "district")
    search_fields = ("name", "pincode", "district", "postmaster_name")
    ordering = ("state", "district", "name")
    list_filter_submit = True


@admin.register(PMAJAYOffice)
class PMAJAYOfficeAdmin(ModelAdmin):
    list_display = ("name", "district", "state", "officer_name")
    list_filter = ("state", "district")
    search_fields = ("name", "district", "officer_name")
    filter_horizontal = ("serves_post_offices",)
    list_filter_submit = True


@admin.register(Complaint)
class ComplaintAdmin(ModelAdmin):
    list_display = (
        "complaint_id",
        "villager_name",
        "village",
        "display_status",
        "display_priority",
        "created_at",
    )
    list_filter = (
        "status",
        "priority_level",
        "post_office",
        "pmajay_office",
        "created_at",
    )
    search_fields = ("complaint_id", "villager_name", "village__name", "complaint_text")
    readonly_fields = (
        "complaint_id",
        "audio_transcription",
        "created_at",
        "updated_at",
        "closure_timestamp",
        "closure_distance_m",
        "closure_selfie_match_score",
    )
    list_filter_submit = True
    list_per_page = 25
    date_hierarchy = "created_at"

    @display(
        description="Status",
        label={
            "resolved": "success",
            "in_progress": "warning",
            "open": "danger",
            "closed": "info",
        },
    )
    def display_status(self, obj):
        return obj.status

    @display(
        description="Priority",
        label={
            "high": "danger",
            "medium": "warning",
            "low": "info",
        },
    )
    def display_priority(self, obj):
        return obj.priority_level

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "complaint_id",
                    "villager_name",
                    "village",
                    "post_office",
                    "pmajay_office",
                ),
                "classes": ["tab"],
            },
        ),
        (
            "Complaint Details",
            {
                "fields": (
                    "complaint_text",
                    "complaint_type",
                    "priority_level",
                    "status",
                ),
                "classes": ["tab"],
            },
        ),
        (
            "Audio Support",
            {
                "fields": (
                    "audio_file",
                    "audio_transcription",
                    "recorded_by_agent",
                    "agent_name",
                    "villager_signature_image",
                ),
                "classes": ["tab"],
            },
        ),
        (
            "Location & Photos",
            {
                "fields": (
                    "latitude",
                    "longitude",
                    "geotagged_photos",
                    "complaint_document_image",
                    "complaintee_photo",
                    "submission_latitude",
                    "submission_longitude",
                ),
                "classes": ["tab"],
            },
        ),
        (
            "Closure Verification",
            {
                "fields": (
                    "closure_selfie",
                    "closure_latitude",
                    "closure_longitude",
                    "closure_timestamp",
                    "closure_distance_m",
                    "closure_selfie_match_score",
                    "resolution_letter_image",
                ),
                "classes": ["tab"],
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ["tab"],
            },
        ),
    )


@admin.register(WorkflowLog)
class WorkflowLogAdmin(ModelAdmin):
    list_display = (
        "complaint",
        "display_action_type",
        "from_status",
        "to_status",
        "action_by",
        "timestamp",
    )
    list_filter = ("action_type", "timestamp")
    search_fields = ("complaint__complaint_id", "action_by", "notes")
    readonly_fields = ("timestamp",)
    ordering = ("-timestamp",)
    list_filter_submit = True
    date_hierarchy = "timestamp"

    @display(description="Action", label=True)
    def display_action_type(self, obj):
        return obj.action_type


@admin.register(SurveyAgent)
class SurveyAgentAdmin(ModelAdmin):
    list_display = ("name", "employee_id", "phone_number", "village_count")
    search_fields = ("name", "employee_id", "phone_number")
    filter_horizontal = ("assigned_villages", "assigned_post_offices")
    list_filter_submit = True

    @display(description="Assigned Villages")
    def village_count(self, obj):
        return obj.assigned_villages.count()


@admin.register(SurveyVisit)
class SurveyVisitAdmin(ModelAdmin):
    list_display = ("agent", "village", "visit_date", "new_complaints_filed")
    list_filter = ("visit_date", "agent", "village")
    search_fields = ("agent__name", "village__name", "notes")
    filter_horizontal = ("complaints_collected",)
    list_filter_submit = True
    date_hierarchy = "visit_date"


@admin.register(Worker)
class WorkerAdmin(ModelAdmin):
    list_display = (
        "name",
        "display_worker_type",
        "phone_number",
        "pmajay_office",
        "is_available",
    )
    list_filter = ("worker_type", "is_available", "pmajay_office")
    search_fields = ("name", "phone_number")
    list_editable = ("is_available",)
    list_filter_submit = True

    @display(description="Type", label=True)
    def display_worker_type(self, obj):
        return obj.worker_type


@admin.register(UserProfile)
class UserProfileAdmin(ModelAdmin):
    list_display = ("user", "display_role", "user_email", "display_active")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email")
    list_filter_submit = True

    @display(
        description="Role",
        label={
            "admin": "danger",
            "manager": "warning",
            "agent": "info",
            "viewer": "success",
        },
    )
    def display_role(self, obj):
        return obj.role

    @display(description="Email")
    def user_email(self, obj):
        return obj.user.email

    @display(description="Active", boolean=True)
    def display_active(self, obj):
        return obj.user.is_active


@admin.register(QRSubmission)
class QRSubmissionAdmin(ModelAdmin):
    list_display = (
        "submission_uuid",
        "person_name",
        "village_name",
        "display_form_type",
        "display_synced",
        "created_at",
    )
    list_filter = ("synced_from_mobile", "form_type", "created_at")
    search_fields = ("person_name", "village_name", "qr_code", "phone_number")
    readonly_fields = ("submission_uuid", "created_at")
    list_filter_submit = True
    date_hierarchy = "created_at"

    @display(description="Form Type", label=True)
    def display_form_type(self, obj):
        return obj.form_type

    @display(description="Mobile Sync", boolean=True)
    def display_synced(self, obj):
        return obj.synced_from_mobile

    fieldsets = (
        (
            "Person Information",
            {
                "fields": ("person_name", "phone_number", "person_photo"),
                "classes": ["tab"],
            },
        ),
        (
            "Location",
            {
                "fields": ("village", "village_name", "latitude", "longitude"),
                "classes": ["tab"],
            },
        ),
        (
            "QR Data",
            {
                "fields": ("qr_code", "form_type", "additional_data"),
                "classes": ["tab"],
            },
        ),
        (
            "Sync Information",
            {
                "fields": (
                    "submission_uuid",
                    "synced_from_mobile",
                    "mobile_created_at",
                    "created_at",
                ),
                "classes": ["tab"],
            },
        ),
        (
            "Linked Records",
            {
                "fields": ("linked_complaint", "linked_gap"),
                "classes": ["tab"],
            },
        ),
    )


@admin.register(QRComplaintDetail)
class QRComplaintDetailAdmin(ModelAdmin):
    list_display = (
        "qr_submission",
        "complaint_type",
        "display_severity",
        "display_synced",
        "created_at",
    )
    list_filter = ("severity", "complaint_type", "synced_from_mobile")
    search_fields = ("complaint_text", "qr_submission__person_name")
    readonly_fields = ("created_at",)
    list_filter_submit = True
    date_hierarchy = "created_at"

    @display(
        description="Severity",
        label={
            "high": "danger",
            "medium": "warning",
            "low": "info",
        },
    )
    def display_severity(self, obj):
        return obj.severity

    @display(description="Mobile Sync", boolean=True)
    def display_synced(self, obj):
        return obj.synced_from_mobile

    fieldsets = (
        (
            "Complaint Information",
            {
                "fields": (
                    "qr_submission",
                    "complaint_text",
                    "complaint_type",
                    "severity",
                ),
                "classes": ["tab"],
            },
        ),
        (
            "Media",
            {
                "fields": ("audio_file", "additional_photos"),
                "classes": ["tab"],
            },
        ),
        (
            "Metadata",
            {
                "fields": ("created_at", "synced_from_mobile"),
                "classes": ["tab"],
            },
        ),
    )
