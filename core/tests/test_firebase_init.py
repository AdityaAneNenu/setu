from unittest import TestCase
from unittest.mock import patch

import core.firebase_utils as firebase_utils
from core.firebase_utils import _parse_firebase_credentials_json


class FirebaseCredentialsParsingTests(TestCase):
    def test_parse_accepts_valid_json(self):
        payload = '{"type":"service_account","project_id":"demo"}'
        parsed = _parse_firebase_credentials_json(payload)

        self.assertEqual(parsed["type"], "service_account")
        self.assertEqual(parsed["project_id"], "demo")

    def test_parse_accepts_python_dict_style_text(self):
        payload = "{'type':'service_account','project_id':'demo'}"
        parsed = _parse_firebase_credentials_json(payload)

        self.assertEqual(parsed["type"], "service_account")
        self.assertEqual(parsed["project_id"], "demo")

    def test_parse_rejects_invalid_payload(self):
        with self.assertRaises(ValueError):
            _parse_firebase_credentials_json("not-a-json-object")

    def test_parse_accepts_double_encoded_json(self):
        payload = '"{\\"type\\":\\"service_account\\",\\"project_id\\":\\"demo\\"}"'
        parsed = _parse_firebase_credentials_json(payload)

        self.assertEqual(parsed["type"], "service_account")
        self.assertEqual(parsed["project_id"], "demo")

    def test_parse_normalizes_private_key_newlines(self):
        payload = '{"type":"service_account","project_id":"demo","private_key":"line1\\\\nline2\\\\n"}'
        parsed = _parse_firebase_credentials_json(payload)

        self.assertEqual(parsed["private_key"], "line1\nline2\n")


class FirebaseAppInitializationTests(TestCase):
    def setUp(self):
        firebase_utils._firebase_app = None
        firebase_utils._firebase_init_attempted = False

    def tearDown(self):
        firebase_utils._firebase_app = None
        firebase_utils._firebase_init_attempted = False

    def test_get_firebase_app_initializes_from_env_json(self):
        payload = '{"type":"service_account","project_id":"demo","private_key":"line1\\\\nline2\\\\n","client_email":"test@example.com","token_uri":"https://oauth2.googleapis.com/token"}'
        app_obj = object()

        with patch.dict(
            "os.environ",
            {
                "FIREBASE_CREDENTIALS_JSON": payload,
                "FIREBASE_STORAGE_BUCKET": "demo.appspot.com",
            },
            clear=False,
        ), patch(
            "core.firebase_utils.firebase_admin.get_app", side_effect=ValueError
        ), patch(
            "core.firebase_utils.credentials.Certificate", return_value="cred"
        ) as certificate_mock, patch(
            "core.firebase_utils.firebase_admin.initialize_app", return_value=app_obj
        ) as initialize_mock:
            app = firebase_utils.get_firebase_app()

        self.assertIs(app, app_obj)
        certificate_mock.assert_called_once()
        initialize_mock.assert_called_once_with(
            "cred", {"storageBucket": "demo.appspot.com"}
        )

    def test_get_firebase_app_returns_none_when_env_missing(self):
        with patch.dict("os.environ", {}, clear=True), patch(
            "core.firebase_utils.firebase_admin.get_app", side_effect=ValueError
        ), patch("core.firebase_utils.firebase_admin.initialize_app") as initialize_mock:
            app = firebase_utils.get_firebase_app()

        self.assertIsNone(app)
        initialize_mock.assert_not_called()
