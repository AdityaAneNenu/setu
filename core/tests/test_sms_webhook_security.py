"""
Tests for SMS webhook security - SMS_WEBHOOK_SECRET requirement.
Ensures SMS update endpoints validate proper authentication headers.
"""

import json
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework.test import APIClient

from core.models import Complaint, SurveyAgent, Village, PostOffice, WorkflowLog


@override_settings(SMS_WEBHOOK_SECRET="test-secret")
class SMSWebhookSecurityTests(TestCase):
    """Test SMS webhook authentication via X-SMS-Secret header."""

    def setUp(self):
        self.client = APIClient()
        self.village = Village.objects.create(name="SMS Test Village")
        self.post_office = PostOffice.objects.create(
            name="SMS Test Post Office",
            pincode="111111",
            district="Test",
            state="Test",
        )
        self.survey_agent = SurveyAgent.objects.create(
            name="Agent SMS",
            employee_id="AGENT-SMS-001",
            phone_number="+919876543210",
        )
        self.survey_agent.assigned_villages.add(self.village)
        self.survey_agent.assigned_post_offices.add(self.post_office)

        self.complaint = Complaint.objects.create(
            complaint_id="PMC20240001",
            villager_name="Villager SMS",
            village=self.village,
            post_office=self.post_office,
            complaint_text="Test complaint for SMS updates",
            complaint_type="water",
            status="assigned_worker",
        )

    def test_api_sms_update_rejects_missing_secret(self):
        """api/sms-update/ without X-SMS-Secret should be rejected."""
        payload = {
            "complaint_id": self.complaint.complaint_id,
            "command": "DONE",
            "phone": self.survey_agent.phone_number,
        }

        response = self.client.post(
            "/api/sms-update/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        # Should reject without X-SMS-Secret header
        self.assertIn(response.status_code, [401, 403])

    def test_api_sms_update_rejects_invalid_secret(self):
        """api/sms-update/ with wrong X-SMS-Secret should be rejected."""
        payload = {
            "complaint_id": self.complaint.complaint_id,
            "command": "DONE",
            "phone": self.survey_agent.phone_number,
        }

        response = self.client.post(
            "/api/sms-update/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_SMS_SECRET="wrong-secret",
        )

        # Should reject with wrong secret
        self.assertIn(response.status_code, [401, 403])

    def test_api_sms_update_accepts_valid_secret_and_authorized_agent(self):
        """api/sms-update/ with valid secret allows authorized SurveyAgent to update status."""
        payload = {
            "complaint_id": self.complaint.complaint_id,
            "command": "DONE",
            "phone": self.survey_agent.phone_number,
        }

        response = self.client.post(
            "/api/sms-update/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_SMS_SECRET="test-secret",
        )

        # Should accept with valid secret and authorized phone
        self.assertEqual(response.status_code, 200)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, "work_completed")

    def test_api_complaint_status_requires_secret(self):
        """api/complaint/<id>/status/ should also require X-SMS-Secret for security."""
        response = self.client.post(
            f"/api/complaint/{self.complaint.complaint_id}/status/",
            {"status": "work_in_progress"},
            format="json",
        )

        # Should require secret
        self.assertIn(response.status_code, [401, 403])
