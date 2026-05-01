from unittest import TestCase
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory

from core.firebase_auth import FirebaseAuthentication


class FirebaseAuthenticationHeaderTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_accepts_bearer_authorization_header(self):
        request = self.factory.get(
            "/api/mobile/gaps/", HTTP_AUTHORIZATION="Bearer fake-token"
        )

        with patch(
            "core.firebase_utils.get_firebase_app", return_value=object()
        ), patch(
            "firebase_admin.auth.verify_id_token",
            return_value={"uid": "uid-bearer", "email": "bearer@example.com"},
        ):
            user, decoded = FirebaseAuthentication().authenticate(request)

        self.assertEqual(user.email, "bearer@example.com")
        self.assertEqual(decoded["uid"], "uid-bearer")
        self.assertTrue(User.objects.filter(email="bearer@example.com").exists())

    def test_accepts_legacy_firebase_authorization_header(self):
        request = self.factory.get(
            "/api/mobile/gaps/", HTTP_AUTHORIZATION="Firebase legacy-token"
        )

        with patch(
            "core.firebase_utils.get_firebase_app", return_value=object()
        ), patch(
            "firebase_admin.auth.verify_id_token",
            return_value={"uid": "uid-legacy", "email": "legacy@example.com"},
        ):
            user, decoded = FirebaseAuthentication().authenticate(request)

        self.assertEqual(user.email, "legacy@example.com")
        self.assertEqual(decoded["uid"], "uid-legacy")

    def test_ignores_non_firebase_headers(self):
        request = self.factory.get(
            "/api/mobile/gaps/", HTTP_AUTHORIZATION="Token abc123"
        )
        self.assertIsNone(FirebaseAuthentication().authenticate(request))
