from io import BytesIO
from unittest.mock import Mock, patch

from PIL import Image
from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from core.models import Complaint, PostOffice, Village, WorkflowLog


def make_test_image(name="proof.jpg", color=(120, 80, 40)):
    image = Image.new("RGB", (32, 32), color=color)
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, buffer.read(), content_type="image/jpeg")


def make_test_audio(name="complaint.wav"):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(
        name,
        b"RIFF\x24\x00\x00\x00WAVEfmt ",
        content_type="audio/wav",
    )


class MobileComplaintVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="mobile-complaint-user",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)
        self.village = Village.objects.create(name="Verification Village")
        self.post_office = PostOffice.objects.create(
            name="Main Post Office",
            pincode="123456",
            district="Test District",
            state="Test State",
        )

    def test_mobile_submit_requires_submission_photo(self):
        response = self.client.post(
            "/api/mobile/complaints/submit/",
            {
                "villager_name": "Asha",
                "village_id": self.village.id,
                "post_office_id": self.post_office.id,
                "complaint_text": "Water has stopped coming",
                "submission_latitude": "25.1000",
                "submission_longitude": "82.1000",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("complaintee_photo", response.data["error"])

    def test_mobile_submit_requires_submission_gps(self):
        response = self.client.post(
            "/api/mobile/complaints/submit/",
            {
                "villager_name": "Asha",
                "village_id": self.village.id,
                "post_office_id": self.post_office.id,
                "complaint_text": "Water has stopped coming",
                "complaintee_photo": make_test_image("complaintee.jpg"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("submission_latitude", response.data["error"])

    def test_mobile_submit_is_idempotent(self):
        payload = {
            "villager_name": "Asha",
            "village_id": self.village.id,
            "post_office_id": self.post_office.id,
            "complaint_text": "Water has stopped coming",
            "submission_latitude": "25.1000",
            "submission_longitude": "82.1000",
            "client_submission_id": "complaint-once-123",
        }

        first = self.client.post(
            "/api/mobile/complaints/submit/",
            {
                **payload,
                "complaintee_photo": make_test_image("complaintee-first.jpg"),
            },
            format="multipart",
        )
        second = self.client.post(
            "/api/mobile/complaints/submit/",
            {
                **payload,
                "complaintee_photo": make_test_image("complaintee-second.jpg"),
            },
            format="multipart",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["complaint_id"], second.data["complaint_id"])
        self.assertEqual(
            Complaint.objects.filter(client_submission_id="complaint-once-123").count(),
            1,
        )

    def test_mobile_verify_close_requires_original_submission_proof(self):
        complaint = Complaint.objects.create(
            villager_name="Asha",
            village=self.village,
            post_office=self.post_office,
            complaint_text="Road repair pending",
            complaint_type="road",
            priority_level="medium",
            status="work_in_progress",
        )

        response = self.client.post(
            f"/api/mobile/complaints/{complaint.complaint_id}/verify-close/",
            {
                "closure_selfie": make_test_image("closure.jpg"),
                "closure_latitude": "25.1000",
                "closure_longitude": "82.1000",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Submission is missing", response.data["error"])

    def test_mobile_verify_close_accepts_assigned_worker_with_valid_proof(self):
        complaint = Complaint.objects.create(
            villager_name="Asha",
            village=self.village,
            post_office=self.post_office,
            complaint_text="Drainage problem",
            complaint_type="drainage",
            priority_level="medium",
            status="assigned_worker",
            submission_latitude=25.1,
            submission_longitude=82.1,
        )
        complaint.complaintee_photo = make_test_image("baseline.jpg")
        complaint.save()

        response = self.client.post(
            f"/api/mobile/complaints/{complaint.complaint_id}/verify-close/",
            {
                "closure_selfie": make_test_image("closure.jpg"),
                "closure_latitude": "25.1000",
                "closure_longitude": "82.1000",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, "case_closed")
        self.assertTrue(
            WorkflowLog.objects.filter(
                complaint=complaint, to_status="case_closed"
            ).exists()
        )


class WebComplaintSubmissionTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username="workflow-user",
            password="password123",
        )
        self.client.force_login(self.user)
        self.village = Village.objects.create(name="Web Village")
        self.post_office = PostOffice.objects.create(
            name="Web Post Office",
            pincode="654321",
            district="Web District",
            state="Web State",
        )

    @patch("core.workflow_views.ComplaintProcessor")
    def test_web_submit_accepts_audio_file_upload_alias(self, mock_processor_cls):
        processor = Mock()
        processor.process_audio_complaint.return_value = {
            "success": True,
            "processed_text": "Audio transcript",
            "detected_type": "water",
            "priority_level": "high",
        }
        mock_processor_cls.return_value = processor

        response = self.client.post(
            reverse("submit_complaint"),
            {
                "villager_name": "Kamla",
                "village": str(self.village.id),
                "post_office": str(self.post_office.id),
                "complaint_text": "",
                "language_code": "hi",
                "submission_latitude": "25.1000",
                "submission_longitude": "82.1000",
                "complaintee_photo": make_test_image("complaintee.jpg"),
                "audio_file_upload": make_test_audio(),
            },
        )

        self.assertEqual(response.status_code, 302)
        complaint = Complaint.objects.get(villager_name="Kamla")
        self.assertTrue(bool(complaint.audio_file))
        self.assertEqual(complaint.complaint_type, "water")
        self.assertEqual(complaint.priority_level, "high")
