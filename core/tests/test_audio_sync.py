from unittest.mock import Mock, patch

import requests
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Gap, Village


class MobileGapSyncAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.village = Village.objects.create(name="Test Village")

    def _payload(self, **overrides):
        payload = {
            "firestore_id": "fs_123",
            "village_id": self.village.id,
            "village_name": self.village.name,
            "description": "Broken water pipe near school",
            "gap_type": "water",
            "severity": "high",
            "input_method": "voice",
            "recommendations": "Repair pipeline",
            "submitted_by": "firebase_uid_1",
        }
        payload.update(overrides)
        return payload

    def test_voice_submission_requires_audio(self):
        response = self.client.post(
            "/api/mobile/gaps/sync/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("audio", response.data.get("error", "").lower())

    @patch("requests.get")
    def test_audio_url_download_failure_returns_400(self, mock_get):
        mock_get.side_effect = requests.RequestException("network unreachable")

        response = self.client.post(
            "/api/mobile/gaps/sync/",
            self._payload(audio_url="https://example.com/audio.m4a"),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("failed to download", response.data.get("error", "").lower())
        self.assertEqual(Gap.objects.count(), 0)

    @patch("core.api_views._generate_voice_code_for_gap", return_value=False)
    @patch("requests.get")
    def test_audio_url_download_saves_audio_file(
        self, mock_get, _mock_generate_voice_code
    ):
        mock_response = Mock()
        mock_response.content = b"RIFF....WAVEfmt data"
        mock_response.headers = {"Content-Type": "audio/wav"}
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        response = self.client.post(
            "/api/mobile/gaps/sync/",
            self._payload(audio_url="https://example.com/audio.wav"),
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        gap = Gap.objects.get(id=response.data["django_id"])
        self.assertTrue(bool(gap.audio_file))
        self.assertTrue(response.data["has_audio"])


class GapAudioDetailFallbackTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="tester", password="pass12345")
        self.client.force_authenticate(user=self.user)
        self.village = Village.objects.create(name="Fallback Village")

    def test_gap_detail_returns_external_audio_url_when_local_file_missing(self):
        gap = Gap.objects.create(
            village=self.village,
            description="Voice complaint",
            gap_type="water",
            severity="medium",
            input_method="voice",
            audio_url="https://cdn.example.com/audio.mp4",
        )

        response = self.client.get(f"/api/gaps/{gap.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["audio_url"], gap.audio_url)
        self.assertEqual(response.data["audio_file"], gap.audio_url)


class GapVoiceVerificationBackfillTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="manager", password="pass12345")
        self.client.login(username="manager", password="pass12345")
        self.village = Village.objects.create(name="Voice Village")

    @patch("core.api_views._generate_voice_code_for_gap", return_value=False)
    @patch("requests.get")
    def test_gap_verification_dashboard_backfills_local_audio_from_url(
        self, mock_get, _mock_generate_voice_code
    ):
        mock_response = Mock()
        mock_response.content = b"RIFF....WAVEfmt data"
        mock_response.headers = {"Content-Type": "audio/wav"}
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        gap = Gap.objects.create(
            village=self.village,
            description="Voice gap from mobile",
            gap_type="water",
            severity="medium",
            input_method="voice",
            audio_url="https://example.com/mobile-audio.wav",
        )

        response = self.client.get(f"/voice-verification/gap/{gap.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["has_original_audio"])
        gap.refresh_from_db()
        self.assertTrue(bool(gap.audio_file))

    @patch("core.api_views._generate_voice_code_for_gap", return_value=False)
    @patch("requests.get")
    @patch("core.voice_views.VoiceVerificationManager.verify_gap_resolution")
    def test_verify_gap_resolution_backfills_audio_before_comparison(
        self, mock_verify_gap_resolution, mock_get, _mock_generate_voice_code
    ):
        mock_response = Mock()
        mock_response.content = b"RIFF....WAVEfmt data"
        mock_response.headers = {"Content-Type": "audio/wav"}
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        mock_verify_gap_resolution.return_value = {
            "is_match": True,
            "similarity_score": 0.93,
            "confidence": "high",
            "threshold_used": 0.7,
            "message": "Match",
            "can_proceed": True,
            "verification_audio_path": "voice_samples/test.wav",
            "original_voice_code": "orig123",
            "verification_voice_code": "ver123",
        }

        gap = Gap.objects.create(
            village=self.village,
            description="Voice gap from mobile",
            gap_type="water",
            severity="medium",
            input_method="voice",
            audio_url="https://example.com/mobile-audio.wav",
        )

        verification_audio = SimpleUploadedFile(
            "verification.wav", b"RIFF....WAVEfmt data", content_type="audio/wav"
        )

        response = self.client.post(
            "/api/voice/verify-gap/",
            {
                "gap_id": str(gap.id),
                "verified_by": "tester",
                "verification_audio": verification_audio,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json().get("success"))
        gap.refresh_from_db()
        self.assertTrue(bool(gap.audio_file))
