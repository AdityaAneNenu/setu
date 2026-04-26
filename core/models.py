from django.db import models, transaction
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
import uuid
from django.utils import timezone


class UserProfile(models.Model):
    """Profile to store role information for each user."""

    ROLE_CHOICES = [
        ("ground", "Ground Level"),
        ("manager", "Manager"),
        ("admin", "Admin"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="ground")

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"


class Village(models.Model):
    name = models.CharField(max_length=120)

    def __str__(self):
        return self.name


class Submission(models.Model):
    village = models.ForeignKey(Village, on_delete=models.CASCADE)
    image = models.ImageField(upload_to="uploads/")
    extracted_text = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


# Models for QR Code based offline data collection
class QRSubmission(models.Model):
    """Store QR code submissions with person photos from mobile app"""

    # Unique identifier
    submission_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    # QR Code data
    qr_code = models.TextField(help_text="Raw QR code data scanned")

    # Person information
    person_name = models.CharField(max_length=200)
    person_photo = models.ImageField(
        upload_to="qr_submissions/photos/",
        blank=True,
        null=True,
        help_text="Photo of the person submitting",
    )
    phone_number = models.CharField(max_length=15, blank=True, null=True)

    # Location data
    village = models.ForeignKey(
        Village, on_delete=models.CASCADE, null=True, blank=True
    )
    village_name = models.CharField(
        max_length=200, help_text="Village name from mobile app"
    )
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )

    # Form metadata
    form_type = models.CharField(max_length=50, default="complaint")
    additional_data = models.JSONField(default=dict, blank=True)

    # Sync tracking
    created_at = models.DateTimeField(auto_now_add=True)
    synced_from_mobile = models.BooleanField(
        default=True, help_text="True if synced from mobile app"
    )
    mobile_created_at = models.DateTimeField(
        null=True, blank=True, help_text="Original creation time on mobile"
    )

    # Linked to existing complaint system
    linked_complaint = models.OneToOneField(
        "Complaint",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="qr_submission",
    )
    linked_gap = models.OneToOneField(
        "Gap",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="qr_submission",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"QR-{self.id}: {self.person_name} - {self.village_name}"

    @transaction.atomic
    def generate_complaint_from_qr(self):
        """Convert QR submission to formal complaint"""
        if self.linked_complaint:
            return self.linked_complaint

        # Create complaint based on QR data
        complaint = Complaint.objects.create(
            villager_name=self.person_name,
            village=self.village
            or Village.objects.filter(name__icontains=self.village_name).first(),
            complaint_text=f"Complaint submitted via QR form: {self.qr_code}",
            complaint_type="QR_SUBMISSION",
            latitude=self.latitude,
            longitude=self.longitude,
            # Add post office assignment logic here
        )

        self.linked_complaint = complaint
        self.save()
        return complaint


class QRComplaintDetail(models.Model):
    """Additional complaint details for QR submissions"""

    qr_submission = models.OneToOneField(
        QRSubmission, on_delete=models.CASCADE, related_name="complaint_details"
    )

    # Complaint content
    complaint_text = models.TextField()
    complaint_type = models.CharField(max_length=100, blank=True)
    severity = models.CharField(
        max_length=20,
        choices=[
            ("low", "Low"),
            ("medium", "Medium"),
            ("high", "High"),
            ("urgent", "Urgent"),
        ],
        default="medium",
    )

    # Media files
    additional_photos = models.JSONField(
        default=list, help_text="List of additional photo file paths"
    )
    audio_file = models.FileField(
        upload_to="qr_submissions/audio/", blank=True, null=True
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    synced_from_mobile = models.BooleanField(default=True)

    def __str__(self):
        return f"Details for {self.qr_submission.person_name}"


class Gap(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("in_progress", "In Progress"),
        ("needs_review", "Needs Review"),
        ("resolved", "Resolved"),
    ]

    INPUT_METHOD_CHOICES = [
        ("image", "Image Upload"),
        ("voice", "Voice Recording"),
        ("text", "Text Input"),
    ]

    GAP_TYPE_CHOICES = [
        ("water", "Water Supply"),
        ("road", "Road Infrastructure"),
        ("sanitation", "Sanitation"),
        ("electricity", "Electricity"),
        ("education", "Education"),
        ("health", "Healthcare"),
        ("housing", "Housing"),
        ("agriculture", "Agriculture"),
        ("connectivity", "Connectivity"),
        ("employment", "Employment"),
        ("community_center", "Community Center"),
        ("drainage", "Drainage"),
        ("other", "Other"),
    ]

    SEVERITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    village = models.ForeignKey("Village", on_delete=models.CASCADE)
    description = models.TextField()
    gap_type = models.CharField(max_length=100, choices=GAP_TYPE_CHOICES, db_index=True)
    severity = models.CharField(
        max_length=50, choices=SEVERITY_CHOICES, default="low", db_index=True
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="open", db_index=True
    )
    input_method = models.CharField(
        max_length=10,
        choices=INPUT_METHOD_CHOICES,
        default="image",
        db_index=True,
        help_text="Method used to submit this gap",
    )
    audio_file = models.FileField(
        upload_to="gap_audio/",
        blank=True,
        null=True,
        help_text="Audio file if submitted via voice",
    )
    audio_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="External audio URL (Cloudinary) - will be downloaded to audio_file",
    )
    client_local_id = models.CharField(
        max_length=120,
        blank=True,
        null=True,
        unique=True,
        db_index=True,
        help_text="Client-generated local ID used for offline idempotent complaint sync",
    )
    initial_photo_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Initial complaint photo URL captured at submission time",
    )
    recommendations = models.TextField(blank=True, null=True, default="None")
    created_at = models.DateTimeField(auto_now_add=True)

    # Timeline tracking fields
    start_date = models.DateField(blank=True, null=True, help_text="Project start date")
    expected_completion = models.DateField(
        blank=True, null=True, help_text="Expected completion date"
    )
    actual_completion = models.DateField(
        blank=True, null=True, help_text="Actual completion date"
    )

    # Geolocation fields
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="Latitude coordinate",
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="Longitude coordinate",
    )
    initial_gps_accuracy_m = models.FloatField(
        blank=True,
        null=True,
        help_text="GPS accuracy in meters at complaint capture time",
    )

    # Resolution proof (required for closure by ADMIN)
    resolution_proof = models.FileField(
        upload_to="resolution_proofs/",
        blank=True,
        null=True,
        help_text="Document/letter proving gap resolution (required for ADMIN to close)",
    )
    resolution_proof_number = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Reference number of resolution letter/document",
    )
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_gaps",
        help_text="User who marked this as resolved",
    )
    resolved_at = models.DateTimeField(
        null=True, blank=True, help_text="Timestamp when gap was resolved"
    )

    # Geo-tagged closure photo proof
    closure_photo_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Cloudinary URL of the geo-tagged closure photo taken on-site",
    )
    closure_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="GPS latitude where the closure photo was taken",
    )
    closure_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="GPS longitude where the closure photo was taken",
    )
    closure_photo_timestamp = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when the closure photo was captured on-site",
    )
    closure_gps_accuracy_m = models.FloatField(
        blank=True,
        null=True,
        help_text="GPS accuracy in meters at closure capture time",
    )
    resolution_client_id = models.CharField(
        max_length=120,
        blank=True,
        null=True,
        help_text="Client-generated local ID used for idempotent resolution sync",
    )

    # Optional: closure-time selfie for "same person" verification
    closure_selfie_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Cloudinary URL of the closure-time selfie (for similarity check)",
    )
    closure_selfie_match_score = models.FloatField(
        blank=True,
        null=True,
        help_text="Selfie similarity score vs original person photo (0-1)",
    )

    # Rule and AI validation telemetry for resolution decisions
    closure_distance_m = models.FloatField(
        blank=True,
        null=True,
        help_text="Distance in meters between initial and closure locations",
    )
    resolution_time_minutes = models.FloatField(
        blank=True,
        null=True,
        help_text="Minutes between complaint creation and resolution attempt",
    )
    resolution_ai_score = models.FloatField(
        blank=True,
        null=True,
        help_text="AI-derived change score between initial and closure photos (0-1)",
    )
    resolution_ai_method = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Method used for AI score (opencv or pillow_fallback)",
    )
    resolution_type = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Resolution outcome category: auto or review",
    )
    resolution_review_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason captured when resolution is routed to manual review",
    )

    def __str__(self):
        return f"{self.village.name} - {self.gap_type} - {self.created_at}"

    @property
    def is_overdue(self):
        """Check if project is overdue"""
        if self.expected_completion and self.status != "resolved":
            return timezone.now().date() > self.expected_completion
        return False


class GapStatusAuditLog(models.Model):
    """Audit log for tracking gap status changes"""

    gap = models.ForeignKey(
        Gap,
        on_delete=models.CASCADE,
        related_name="status_audit_logs",
        help_text="The gap whose status changed",
    )
    old_status = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Previous status (null for newly created gaps)",
    )
    new_status = models.CharField(
        max_length=20,
        help_text="New status after the change",
    )
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="gap_status_changes",
        help_text="User who made the change",
    )
    changed_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp of the status change",
    )
    notes = models.TextField(
        blank=True,
        help_text="Optional notes about the status change",
    )
    source = models.CharField(
        max_length=50,
        default="web",
        help_text="Source of the change (web, mobile, api, etc.)",
    )

    class Meta:
        ordering = ["-changed_at"]
        verbose_name = "Gap Status Audit Log"
        verbose_name_plural = "Gap Status Audit Logs"

    def __str__(self):
        return (
            f"Gap #{self.gap_id}: {self.old_status or 'NEW'} "
            f"-> {self.new_status} at {self.changed_at}"
        )


# Post Office Workflow System Models


class PostOffice(models.Model):
    """Post offices in PM-AJAY network"""

    name = models.CharField(max_length=200)
    pincode = models.CharField(max_length=6)
    district = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postmaster_name = models.CharField(max_length=100, blank=True)
    contact_number = models.CharField(max_length=15, blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )

    def __str__(self):
        return f"{self.name} - {self.pincode}"


class PMAJAYOffice(models.Model):
    """PM-AJAY regional offices"""

    name = models.CharField(max_length=200)
    district = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    officer_name = models.CharField(max_length=100)
    contact_number = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    serves_post_offices = models.ManyToManyField(PostOffice, blank=True)

    def __str__(self):
        return f"PM-AJAY {self.name}"


class Complaint(models.Model):
    """Main complaint/grievance from villager"""

    CLOSURE_ALLOWED_STATUSES = (
        "assigned_worker",
        "work_in_progress",
        "work_completed",
    )

    COMPLAINT_STATUS = [
        ("received_post", "Received at Post Office"),
        ("sent_to_office", "Sent to PM-AJAY Office"),
        ("under_analysis", "AI Analysis in Progress"),
        ("assigned_worker", "Assigned to Field Worker"),
        ("work_in_progress", "Work in Progress"),
        ("work_completed", "Work Reported Complete"),
        ("sent_to_villager", "Report Sent to Villager"),
        ("villager_satisfied", "Villager Confirmed Satisfied"),
        ("villager_unsatisfied", "Villager Reported Unsatisfied"),
        ("case_closed", "Case Closed"),
        ("escalated", "Escalated to Admin"),
    ]

    # Basic details
    complaint_id = models.CharField(max_length=20, unique=True)  # PMC2024001 format
    villager_name = models.CharField(max_length=100)
    village = models.ForeignKey(Village, on_delete=models.CASCADE)
    post_office = models.ForeignKey(
        PostOffice, on_delete=models.CASCADE, null=True, blank=True
    )
    pmajay_office = models.ForeignKey(
        PMAJAYOffice, on_delete=models.CASCADE, null=True, blank=True
    )

    # Complaint content
    complaint_text = models.TextField(help_text="Original complaint text")
    complaint_type = models.CharField(max_length=100, blank=True)  # Auto-detected by AI
    priority_level = models.CharField(
        max_length=20,
        choices=[
            ("low", "Low"),
            ("medium", "Medium"),
            ("high", "High"),
            ("urgent", "Urgent"),
        ],
        default="medium",
    )

    # Workflow status
    status = models.CharField(
        max_length=30, choices=COMPLAINT_STATUS, default="received_post"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Audio support for illiterate villagers
    audio_file = models.FileField(upload_to="complaint_audio/", blank=True, null=True)
    audio_transcription = models.TextField(
        blank=True, help_text="AI transcription of audio"
    )
    recorded_by_agent = models.BooleanField(default=False)
    agent_name = models.CharField(max_length=100, blank=True)
    villager_signature_image = models.ImageField(
        upload_to="signatures/", blank=True, null=True
    )

    # Location
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )
    geotagged_photos = models.JSONField(default=list, blank=True)  # Store photo paths
    complaint_document_image = models.ImageField(
        upload_to="complaints/document_photos/",
        blank=True,
        null=True,
        help_text="Photo of written complaint document captured at submission",
    )

    # Complaintee verification (photo + geo at submission and closure)
    complaintee_photo = models.ImageField(
        upload_to="complaints/complaintee_photos/",
        blank=True,
        null=True,
        help_text="Photo of the complaintee captured at complaint time",
    )
    submission_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="GPS latitude captured at complaint submission time",
    )
    submission_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="GPS longitude captured at complaint submission time",
    )
    closure_selfie = models.ImageField(
        upload_to="complaints/closure_selfies/",
        blank=True,
        null=True,
        help_text="Closure-time selfie of complaintee for verification",
    )
    closure_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="GPS latitude captured at complaint closure time",
    )
    closure_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="GPS longitude captured at complaint closure time",
    )
    closure_timestamp = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when closure selfie was captured",
    )
    closure_distance_m = models.FloatField(
        blank=True,
        null=True,
        help_text="Distance between submission GPS and closure GPS (meters)",
    )
    closure_selfie_match_score = models.FloatField(
        blank=True,
        null=True,
        help_text="Similarity score between submission photo and closure selfie (0-1)",
    )
    resolution_letter_image = models.ImageField(
        upload_to="complaints/resolution_letters/",
        blank=True,
        null=True,
        help_text="Resolution letter image for photo/document complaints",
    )

    def __str__(self):
        return f"{self.complaint_id} - {self.villager_name}"

    @property
    def uses_resolution_letter(self):
        """Written/photo complaints close with a resolution letter image."""
        return bool(self.complaint_document_image)

    @property
    def requires_selfie_gps_verification(self):
        """Audio/direct complaints close by matching selfie + GPS against submission."""
        return not self.uses_resolution_letter

    @property
    def has_submission_identity_photo(self):
        return bool(self.complaintee_photo)

    @property
    def has_submission_geo(self):
        return (
            self.submission_latitude is not None
            and self.submission_longitude is not None
        )

    @property
    def is_submission_verification_ready(self):
        return self.has_submission_identity_photo and self.has_submission_geo

    @property
    def closure_status_is_actionable(self):
        return self.status in self.CLOSURE_ALLOWED_STATUSES

    @property
    def verification_block_reason(self):
        if self.uses_resolution_letter:
            return ""
        if not self.has_submission_identity_photo:
            return "Submission is missing the complaintee photo."
        if not self.has_submission_geo:
            return "Submission is missing the original GPS coordinates."
        if not self.closure_status_is_actionable:
            return "Complaint is not yet ready for closure verification."
        return ""

    def save(self, *args, **kwargs):
        if not self.complaint_id:
            # Auto-generate complaint_id in PMC{year}{seq} format
            # Use atomic transaction with proper unique constraint check
            import datetime
            from django.db import IntegrityError

            year = datetime.datetime.now().year

            max_retries = 10
            for attempt in range(max_retries):
                try:
                    with transaction.atomic():
                        # Get the highest existing sequence number for this year
                        last_complaint = (
                            Complaint.objects.filter(
                                complaint_id__startswith=f"PMC{year}"
                            )
                            .order_by("-complaint_id")
                            .first()
                        )

                        if last_complaint:
                            # Extract sequence number from existing ID
                            seq_str = last_complaint.complaint_id[
                                7:
                            ]  # Remove "PMC2024" prefix
                            seq = int(seq_str) + 1
                        else:
                            seq = 1

                        self.complaint_id = f"PMC{year}{seq:04d}"
                        super().save(*args, **kwargs)
                        return  # Success, exit retry loop

                except IntegrityError:
                    # Another process created a complaint with this ID, retry
                    if attempt == max_retries - 1:
                        raise  # Give up after max retries
                    continue
        else:
            super().save(*args, **kwargs)


class WorkflowLog(models.Model):
    """Track every step in the complaint workflow"""

    complaint = models.ForeignKey(
        Complaint, on_delete=models.CASCADE, related_name="workflow_logs"
    )
    from_status = models.CharField(max_length=30, blank=True)
    to_status = models.CharField(max_length=30)
    action_by = models.CharField(max_length=100)  # Person/system who performed action
    action_type = models.CharField(
        max_length=50,
        choices=[
            ("received", "Document Received"),
            ("scanned", "Document Scanned"),
            ("ai_analysis", "AI Analysis Complete"),
            ("assigned", "Assigned to Worker"),
            ("work_update", "Work Progress Update"),
            ("report_sent", "Report Sent"),
            ("feedback_received", "Villager Feedback"),
            ("case_closed", "Case Closed"),
            ("escalated", "Case Escalated"),
            ("status_update", "Status Update"),
            ("sms_update", "SMS Update"),
        ],
    )
    notes = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.complaint.complaint_id} - {self.action_type}"


class SurveyAgent(models.Model):
    """Agents who visit villages twice a month"""

    name = models.CharField(max_length=100)
    employee_id = models.CharField(max_length=20, unique=True)
    phone_number = models.CharField(max_length=15)
    assigned_villages = models.ManyToManyField(Village)
    assigned_post_offices = models.ManyToManyField(PostOffice)

    def __str__(self):
        return f"Agent {self.name} ({self.employee_id})"


class SurveyVisit(models.Model):
    """Track agent visits to villages"""

    agent = models.ForeignKey(SurveyAgent, on_delete=models.CASCADE)
    village = models.ForeignKey(Village, on_delete=models.CASCADE)
    visit_date = models.DateField()
    complaints_collected = models.ManyToManyField(Complaint, blank=True)

    # Updates on existing complaints
    follow_ups_completed = models.JSONField(
        default=list
    )  # List of complaint IDs checked
    photos_collected = models.JSONField(default=list)  # Geotagged photo paths
    signatures_collected = models.JSONField(default=list)  # Signature image paths

    # New complaints filed
    new_complaints_filed = models.IntegerField(default=0)
    audio_recordings = models.JSONField(
        default=list
    )  # Audio file paths for illiterate villagers

    notes = models.TextField(blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )

    def __str__(self):
        return f"{self.agent.name} - {self.village.name} - {self.visit_date}"


# Enhanced models for automated PM-AJAY workflow tracking
# Worker model for field workers
class Worker(models.Model):
    """Workers assigned to solve problems"""

    WORKER_TYPE_CHOICES = [
        ("electrician", "Electrician"),
        ("plumber", "Plumber"),
        ("road_contractor", "Road Contractor"),
        ("mason", "Mason"),
        ("healthcare", "Healthcare Worker"),
        ("agriculture", "Agriculture Specialist"),
        ("general", "General Worker"),
    ]

    name = models.CharField(max_length=100)
    worker_type = models.CharField(max_length=20, choices=WORKER_TYPE_CHOICES)
    phone_number = models.CharField(max_length=15)
    pmajay_office = models.ForeignKey("PMAJAYOffice", on_delete=models.CASCADE)
    is_available = models.BooleanField(default=True)
    current_location_lat = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )
    current_location_lng = models.DecimalField(
        max_digits=9, decimal_places=6, blank=True, null=True
    )

    def __str__(self):
        return f"{self.name} ({self.worker_type})"





# --- Signals ---


@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    """Ensure each user has an associated profile for role management."""
    if created:
        UserProfile.objects.create(user=instance)
    else:
        UserProfile.objects.get_or_create(user=instance)
