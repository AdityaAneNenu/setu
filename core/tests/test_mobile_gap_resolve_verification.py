from io import BytesIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient
from PIL import Image

from core.models import Gap, Village


def make_test_image(name="proof.jpg", color=(120, 80, 40)):
    image = Image.new("RGB", (32, 32), color=color)
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/jpeg")


class MobileGapResolveVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="mobile-gap-user",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)
        self.village = Village.objects.create(name="Resolve Verification Village")
        self.gap = Gap.objects.create(
            village=self.village,
            description="Road is broken",
            gap_type="road",
            severity="medium",
            status="in_progress",
            latitude=25.100000,
            longitude=82.100000,
        )

    def test_mobile_resolve_requires_photo(self):
        response = self.client.post(
            f"/api/mobile/gaps/{self.gap.id}/resolve/",
            {
                "latitude": "25.1001",
                "longitude": "82.1001",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Proof photo is required", response.data["error"])

    def test_mobile_resolve_requires_location(self):
        response = self.client.post(
            f"/api/mobile/gaps/{self.gap.id}/resolve/",
            {
                "photo": make_test_image(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("latitude and longitude are required", response.data["error"])

    def test_mobile_resolve_succeeds_with_photo_and_location(self):
        with patch("core.firebase_utils.sync_gap_to_firestore", return_value=None):
            response = self.client.post(
                f"/api/mobile/gaps/{self.gap.id}/resolve/",
                {
                    "photo": make_test_image(),
                    "latitude": "25.1001",
                    "longitude": "82.1001",
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, 200)
        self.gap.refresh_from_db()
        self.assertEqual(self.gap.status, "resolved")
        self.assertIsNotNone(self.gap.resolution_proof)
        self.assertIsNotNone(self.gap.closure_latitude)
        self.assertIsNotNone(self.gap.closure_longitude)

    def test_mobile_resolve_is_idempotent(self):
        with patch("core.firebase_utils.sync_gap_to_firestore", return_value=None):
            first = self.client.post(
                f"/api/mobile/gaps/{self.gap.id}/resolve/",
                {
                    "photo": make_test_image("first.jpg"),
                    "latitude": "25.1001",
                    "longitude": "82.1001",
                    "client_submission_id": "resolve-once-123",
                },
                format="multipart",
            )
            second = self.client.post(
                f"/api/mobile/gaps/{self.gap.id}/resolve/",
                {
                    "photo": make_test_image("second.jpg"),
                    "latitude": "25.1001",
                    "longitude": "82.1001",
                    "client_submission_id": "resolve-once-123",
                },
                format="multipart",
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["gap_id"], second.data["gap_id"])
        self.gap.refresh_from_db()
        self.assertEqual(self.gap.resolution_client_id, "resolve-once-123")
