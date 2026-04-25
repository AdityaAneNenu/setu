from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from core.services import SpeechToTextService


class SpeechToTextServiceConfigTests(TestCase):
    @patch("core.services.aai.Transcriber")
    @patch("core.services.aai.TranscriptionConfig")
    def test_transcribe_audio_uses_keyterms_prompt_not_word_boost(
        self, mock_config_cls, mock_transcriber_cls
    ):
        mock_config = object()
        mock_config_cls.return_value = mock_config

        mock_transcriber = Mock()
        mock_transcriber.transcribe.return_value = SimpleNamespace(
            status="completed",
            text="water pipeline issue",
            confidence=0.91,
        )
        mock_transcriber_cls.return_value = mock_transcriber

        with patch.dict(
            "os.environ",
            {
                "ASSEMBLYAI_API_KEY": "test-key",
                "ASSEMBLYAI_KEYTERMS_PROMPT": "pm-ajay, पंचायत, borewell",
            },
            clear=False,
        ):
            service = SpeechToTextService()
            result = service.transcribe_audio("dummy.wav", "hi")

        kwargs = mock_config_cls.call_args.kwargs
        self.assertEqual(kwargs["keyterms_prompt"], ["pm-ajay", "पंचायत", "borewell"])
        self.assertNotIn("word_boost", kwargs)
        mock_transcriber.transcribe.assert_called_once_with("dummy.wav", config=mock_config)
        self.assertTrue(result["success"])

    @patch("core.services.aai.Transcriber")
    @patch("core.services.aai.TranscriptionConfig")
    def test_transcribe_audio_without_keyterms_does_not_send_word_boost(
        self, mock_config_cls, mock_transcriber_cls
    ):
        mock_config = object()
        mock_config_cls.return_value = mock_config

        mock_transcriber = Mock()
        mock_transcriber.transcribe.return_value = SimpleNamespace(
            status="completed",
            text="road has potholes",
            confidence=0.82,
        )
        mock_transcriber_cls.return_value = mock_transcriber

        with patch.dict(
            "os.environ",
            {
                "ASSEMBLYAI_API_KEY": "test-key",
                "ASSEMBLYAI_KEYTERMS_PROMPT": "",
            },
            clear=False,
        ):
            service = SpeechToTextService()
            result = service.transcribe_audio("dummy.wav", "hi")

        kwargs = mock_config_cls.call_args.kwargs
        self.assertNotIn("keyterms_prompt", kwargs)
        self.assertNotIn("word_boost", kwargs)
        mock_transcriber.transcribe.assert_called_once_with("dummy.wav", config=mock_config)
        self.assertTrue(result["success"])
