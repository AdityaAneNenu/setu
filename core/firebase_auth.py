"""
Firebase Token Authentication for Django REST Framework.

Allows mobile app users (authenticated via Firebase Auth) to call
Django API endpoints using their Firebase ID token.

Mobile app sends: Authorization: Firebase <id_token>
"""

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import User


class FirebaseAuthentication(BaseAuthentication):
    """
    DRF authentication backend that verifies Firebase ID tokens.
    If Firebase is not configured, authentication is skipped (returns None).
    """

    keyword = "Firebase"

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith(f"{self.keyword} "):
            return None

        token = auth_header[len(f"{self.keyword} ") :]
        if not token:
            return None

        try:
            from firebase_admin import auth as firebase_auth
            from .firebase_utils import get_firebase_app

            app = get_firebase_app()
            if not app:
                # Firebase not configured - skip auth instead of failing
                # This allows the request to proceed without Firebase verification
                # The view will validate submitted_by field instead
                return None

            decoded_token = firebase_auth.verify_id_token(token, app=app)
            uid = decoded_token.get("uid")
            email = decoded_token.get("email", "")

            if not uid:
                raise AuthenticationFailed("Invalid Firebase token: no uid")

            # Find existing Django user by email
            user = None
            if email:
                user = User.objects.filter(email=email).first()

            if not user:
                # Create a basic Django user for mobile-only Firebase users
                username = email.split("@")[0] if email else f"firebase_{uid[:8]}"
                base_username = username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=None,
                )

            return (user, decoded_token)

        except AuthenticationFailed:
            raise
        except Exception as e:
            # If Firebase verification fails for any reason, skip auth
            # Let the view handle validation via submitted_by field
            print(f"Firebase auth skipped: {e}")
            return None
