from django.contrib import admin

# Register your models here.
from .models import (Village, Submission, Gap, PostOffice, PMAJAYOffice, 
                     Complaint, WorkflowLog, SurveyAgent, SurveyVisit, 
                     VillagerContact, SMSStatusUpdate, Worker, VoiceVerificationLog,
                     UserProfile, QRSubmission, QRComplaintDetail)

@admin.register(Village)
class VillageAdmin(admin.ModelAdmin):
    list_display = ('name', 'id')
    search_fields = ('name',)

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('village', 'image', 'created_at')
    list_filter = ('created_at', 'village')
    search_fields = ('village__name',)

@admin.register(Gap)
class GapAdmin(admin.ModelAdmin):
    list_display = ('village', 'gap_type', 'severity', 'status', 'budget_allocated', 'budget_spent', 'start_date', 'expected_completion', 'is_overdue')
    list_filter = ('status', 'severity', 'gap_type', 'created_at')
    list_editable = ('budget_allocated', 'budget_spent', 'status')
    search_fields = ('village__name', 'description', 'gap_type')
    readonly_fields = ('created_at', 'is_overdue', 'budget_remaining')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('village', 'gap_type', 'severity', 'status', 'description', 'recommendations')
        }),
        ('Budget Management (Manager Only)', {
            'fields': ('budget_allocated', 'budget_spent', 'budget_remaining'),
            'description': 'Budget allocation and tracking for this project'
        }),
        ('Timeline', {
            'fields': ('start_date', 'expected_completion', 'actual_completion', 'created_at', 'is_overdue'),
            'classes': ('collapse',)
        }),
        ('Location', {
            'fields': ('latitude', 'longitude'),
            'classes': ('collapse',)
        }),
    )
    
    def is_overdue(self, obj):
        return obj.is_overdue
    is_overdue.boolean = True
    is_overdue.short_description = 'Overdue?'
    
    def get_readonly_fields(self, request, obj=None):
        """Make budget_remaining always readonly"""
        return ('created_at', 'is_overdue', 'budget_remaining')

# Post Office Workflow Admin

@admin.register(PostOffice)
class PostOfficeAdmin(admin.ModelAdmin):
    list_display = ('name', 'pincode', 'district', 'state', 'postmaster_name')
    list_filter = ('state', 'district')
    search_fields = ('name', 'pincode', 'district', 'postmaster_name')
    ordering = ('state', 'district', 'name')

@admin.register(PMAJAYOffice)
class PMAJAYOfficeAdmin(admin.ModelAdmin):
    list_display = ('name', 'district', 'state', 'officer_name')
    list_filter = ('state', 'district')
    search_fields = ('name', 'district', 'officer_name')
    filter_horizontal = ('serves_post_offices',)

@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ('complaint_id', 'villager_name', 'village', 'status', 'priority_level', 'created_at')
    list_filter = ('status', 'priority_level', 'post_office', 'pmajay_office', 'created_at')
    search_fields = ('complaint_id', 'villager_name', 'village__name', 'complaint_text')
    readonly_fields = ('complaint_id', 'audio_transcription', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('complaint_id', 'villager_name', 'village', 'post_office', 'pmajay_office')
        }),
        ('Complaint Details', {
            'fields': ('complaint_text', 'complaint_type', 'priority_level', 'status')
        }),
        ('Audio Support', {
            'fields': ('audio_file', 'audio_transcription', 'recorded_by_agent', 'agent_name', 'villager_signature_image'),
            'classes': ('collapse',)
        }),
        ('Location & Photos', {
            'fields': ('latitude', 'longitude', 'geotagged_photos'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(WorkflowLog)
class WorkflowLogAdmin(admin.ModelAdmin):
    list_display = ('complaint', 'action_type', 'from_status', 'to_status', 'action_by', 'timestamp')
    list_filter = ('action_type', 'timestamp')
    search_fields = ('complaint__complaint_id', 'action_by', 'notes')
    readonly_fields = ('timestamp',)
    ordering = ('-timestamp',)

@admin.register(SurveyAgent)
class SurveyAgentAdmin(admin.ModelAdmin):
    list_display = ('name', 'employee_id', 'phone_number')
    search_fields = ('name', 'employee_id', 'phone_number')
    filter_horizontal = ('assigned_villages', 'assigned_post_offices')

@admin.register(SurveyVisit)
class SurveyVisitAdmin(admin.ModelAdmin):
    list_display = ('agent', 'village', 'visit_date', 'new_complaints_filed')
    list_filter = ('visit_date', 'agent', 'village')
    search_fields = ('agent__name', 'village__name', 'notes')
    filter_horizontal = ('complaints_collected',)

@admin.register(Worker)
class WorkerAdmin(admin.ModelAdmin):
    list_display = ('name', 'worker_type', 'phone_number', 'pmajay_office', 'is_available')
    list_filter = ('worker_type', 'is_available', 'pmajay_office')
    search_fields = ('name', 'phone_number')
    list_editable = ('is_available',)

@admin.register(VoiceVerificationLog)
class VoiceVerificationLogAdmin(admin.ModelAdmin):
    list_display = ('complaint', 'verification_date', 'similarity_percentage', 'is_match', 'confidence', 'used_for_closure', 'verified_by')
    list_filter = ('is_match', 'confidence', 'used_for_closure', 'verification_date')
    search_fields = ('complaint__complaint_id', 'complaint__villager_name', 'verified_by')
    readonly_fields = ('verification_date', 'similarity_percentage')
    ordering = ('-verification_date',)
    
    fieldsets = (
        ('Complaint Information', {
            'fields': ('complaint', 'verified_by')
        }),
        ('Verification Results', {
            'fields': ('similarity_score', 'similarity_percentage', 'is_match', 'confidence')
        }),
        ('Audio & Metadata', {
            'fields': ('verification_audio_path', 'verification_date', 'used_for_closure', 'notes')
        }),
    )
    
    def similarity_percentage(self, obj):
        return f"{obj.similarity_percentage:.1f}%"


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'user_email', 'user_is_active')
    list_filter = ('role',)
    search_fields = ('user__username', 'user__email')
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'Email'
    
    def user_is_active(self, obj):
        return obj.user.is_active
    user_is_active.boolean = True
    user_is_active.short_description = 'Active'


@admin.register(QRSubmission)
class QRSubmissionAdmin(admin.ModelAdmin):
    list_display = ('submission_uuid', 'person_name', 'village_name', 'form_type', 'synced_from_mobile', 'created_at')
    list_filter = ('synced_from_mobile', 'form_type', 'created_at')
    search_fields = ('person_name', 'village_name', 'qr_code', 'phone_number')
    readonly_fields = ('submission_uuid', 'created_at')
    
    fieldsets = (
        ('Person Information', {
            'fields': ('person_name', 'phone_number', 'person_photo')
        }),
        ('Location', {
            'fields': ('village', 'village_name', 'latitude', 'longitude')
        }),
        ('QR Data', {
            'fields': ('qr_code', 'form_type', 'additional_data')
        }),
        ('Sync Information', {
            'fields': ('submission_uuid', 'synced_from_mobile', 'mobile_created_at', 'created_at')
        }),
        ('Linked Records', {
            'fields': ('linked_complaint', 'linked_gap'),
            'classes': ('collapse',)
        }),
    )


@admin.register(QRComplaintDetail)
class QRComplaintDetailAdmin(admin.ModelAdmin):
    list_display = ('qr_submission', 'complaint_type', 'severity', 'created_at')
    list_filter = ('severity', 'complaint_type', 'synced_from_mobile')
    search_fields = ('complaint_text', 'qr_submission__person_name')
    
    fieldsets = (
        ('Complaint Information', {
            'fields': ('qr_submission', 'complaint_text', 'complaint_type', 'severity')
        }),
        ('Media', {
            'fields': ('audio_file', 'additional_photos'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'synced_from_mobile')
        }),
    )