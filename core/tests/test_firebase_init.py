from unittest import TestCase

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
