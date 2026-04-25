import types
from unittest.mock import Mock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient


class AnalyzeMediaAudioTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/analyze-media/"

    def _audio_file(self):
        return SimpleUploadedFile(
            "sample.wav",
            b"RIFF\x24\x00\x00\x00WAVEfmt ",
            content_type="audio/wav",
        )

    def _fake_genai_modules(self, response_text=None, error=None):
        fake_google = types.ModuleType("google")
        fake_genai = types.ModuleType("google.generativeai")

        def configure(api_key=None):
            return api_key

        class FakeModel:
            def __init__(self, *args, **kwargs):
                pass

            def generate_content(self, *args, **kwargs):
                if error:
                    raise error
                return types.SimpleNamespace(text=response_text or "{}")

        fake_genai.configure = configure
        fake_genai.GenerativeModel = FakeModel
        fake_genai.upload_file = lambda *_args, **_kwargs: "uploaded-file"
        fake_google.generativeai = fake_genai

        return {
            "google": fake_google,
            "google.generativeai": fake_genai,
        }

    def test_audio_analysis_falls_back_when_gemini_fails(self):
        fake_modules = self._fake_genai_modules(error=RuntimeError("quota exceeded"))

        with patch.dict("sys.modules", fake_modules):
            with patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False):
                with patch("core.services.ComplaintProcessor") as mock_processor_cls:
                    processor = Mock()
                    processor.speech_service.transcribe_audio.return_value = {
                        "success": True,
                        "text": "There is no water supply in our village",
                        "language": "en",
                    }
                    processor.analyze_complaint.return_value = {
                        "gap_type": "water",
                        "priority": "urgent",
                        "analysis_confidence": 0.92,
                    }
                    mock_processor_cls.return_value = processor

                    response = self.client.post(
                        self.url,
                        {
                            "file": self._audio_file(),
                            "media_type": "audio",
                            "language": "en",
                        },
                        format="multipart",
                    )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["analysis_source"], "heuristic")
        self.assertEqual(response.data["gap_type"], "water")
        self.assertEqual(response.data["severity"], "high")
        self.assertIn("transcription", response.data)
        self.assertIn("warning", response.data)

    def test_audio_analysis_uses_gemini_when_available(self):
        fake_modules = self._fake_genai_modules(
            response_text='{"description": "Water pipeline is broken", "gap_type": "water", "severity": "high", "confidence": 0.88}'
        )

        with patch.dict("sys.modules", fake_modules):
            with patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False):
                with patch("core.services.ComplaintProcessor") as mock_processor_cls:
                    processor = Mock()
                    processor.speech_service.transcribe_audio.return_value = {
                        "success": True,
                        "text": "The water pipe is damaged near the school",
                        "language": "en",
                    }
                    processor.analyze_complaint.return_value = {
                        "gap_type": "other",
                        "priority": "medium",
                        "analysis_confidence": 0.4,
                    }
                    mock_processor_cls.return_value = processor

                    response = self.client.post(
                        self.url,
                        {
                            "file": self._audio_file(),
                            "media_type": "audio",
                            "language": "en",
                        },
                        format="multipart",
                    )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["analysis_source"], "gemini")
        self.assertEqual(response.data["gap_type"], "water")
        self.assertEqual(response.data["severity"], "high")
        self.assertEqual(response.data["description"], "Water pipeline is broken")

    def test_audio_analysis_retries_language_when_transcription_is_low_signal(self):
        fake_modules = self._fake_genai_modules(
            response_text='{"description": "The handpump is broken and water is unavailable", "gap_type": "water", "severity": "high", "confidence": 0.91}'
        )

        with patch.dict("sys.modules", fake_modules):
            with patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False):
                with patch("core.services.ComplaintProcessor") as mock_processor_cls:
                    processor = Mock()
                    processor.speech_service.transcribe_audio.side_effect = [
                        {
                            "success": True,
                            "text": "h",
                            "language": "bn",
                            "confidence": 0.05,
                        },
                        {
                            "success": True,
                            "text": "Gaon mein handpump kharab hai aur paani nahi aa raha",
                            "language": "hi",
                            "confidence": 0.89,
                        },
                    ]
                    processor.analyze_complaint.return_value = {
                        "gap_type": "water",
                        "priority": "high",
                        "analysis_confidence": 0.85,
                    }
                    mock_processor_cls.return_value = processor

                    response = self.client.post(
                        self.url,
                        {
                            "file": self._audio_file(),
                            "media_type": "audio",
                            "language": "bn",
                        },
                        format="multipart",
                    )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["analysis_source"], "gemini")
        self.assertEqual(response.data["transcription_language"], "hi")
        self.assertIn("handpump", response.data["description"].lower())
        self.assertEqual(processor.speech_service.transcribe_audio.call_count, 2)

    def test_audio_analysis_returns_422_when_all_transcriptions_are_low_signal(self):
        fake_modules = self._fake_genai_modules(
            response_text='{"description": "", "gap_type": "other", "severity": "low", "confidence": 0.1}'
        )

        with patch.dict("sys.modules", fake_modules):
            with patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}, clear=False):
                with patch("core.services.ComplaintProcessor") as mock_processor_cls:
                    processor = Mock()
                    processor.speech_service.transcribe_audio.side_effect = [
                        {
                            "success": True,
                            "text": "h",
                            "language": "hi",
                            "confidence": 0.05,
                        },
                        {
                            "success": True,
                            "text": "i",
                            "language": "en",
                            "confidence": 0.04,
                        },
                    ]
                    mock_processor_cls.return_value = processor

                    response = self.client.post(
                        self.url,
                        {
                            "file": self._audio_file(),
                            "media_type": "audio",
                            "language": "hi",
                        },
                        format="multipart",
                    )

        self.assertEqual(response.status_code, 422)
        self.assertIn("Transcription quality is too low", response.data["error"])
