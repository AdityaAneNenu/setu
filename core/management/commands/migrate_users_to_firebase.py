"""
Management command to create Django users in Firebase Auth.

Usage:
    python manage.py migrate_users_to_firebase
    python manage.py migrate_users_to_firebase --password setu1234
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create Django users in Firebase Auth with matching emails and roles"

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            type=str,
            default="setu1234",
            help="Default password for all migrated users (default: setu1234)",
        )

    def handle(self, *args, **options):
        import firebase_admin
        from firebase_admin import auth as firebase_auth, firestore
        from core.firebase_utils import get_firebase_app, get_firestore_client

        app = get_firebase_app()
        if not app:
            self.stderr.write(
                self.style.ERROR(
                    "Firebase not initialized. Set FIREBASE_CREDENTIALS_JSON "
                    "with the full service-account JSON."
                )
            )
            return

        db = get_firestore_client()
        default_password = options["password"]

        from django.contrib.auth.models import User

        users = User.objects.all()

        self.stdout.write(
            self.style.WARNING(
                f"Migrating {users.count()} users to Firebase Auth "
                f"(password: {default_password})"
            )
        )
        self.stdout.write("")

        created = 0
        skipped = 0
        errors = 0

        for user in users:
            email = user.email
            if not email:
                email = f"{user.username}@setu-pm.local"

            # Get role
            role = "ground"
            try:
                if hasattr(user, "profile"):
                    role = user.profile.role
            except Exception:
                pass

            display_name = (
                f"{user.first_name} {user.last_name}".strip() or user.username
            )

            try:
                # Check if user already exists in Firebase Auth
                try:
                    existing = firebase_auth.get_user_by_email(email)
                    self.stdout.write(
                        f"  ⏭  {user.username} ({email}) — already exists in Firebase Auth (uid: {existing.uid})"
                    )
                    skipped += 1

                    # Still update Firestore profile
                    if db:
                        db.collection("users").document(existing.uid).set(
                            {
                                "django_id": user.id,
                                "uid": existing.uid,
                                "username": user.username,
                                "email": email,
                                "first_name": user.first_name or "",
                                "last_name": user.last_name or "",
                                "role": role,
                                "is_staff": user.is_staff,
                                "is_superuser": user.is_superuser,
                                "updated_at": firestore.SERVER_TIMESTAMP,
                            },
                            merge=True,
                        )
                    continue

                except firebase_auth.UserNotFoundError:
                    pass  # User doesn't exist yet — create it

                # Create user in Firebase Auth
                fb_user = firebase_auth.create_user(
                    email=email,
                    password=default_password,
                    display_name=display_name,
                    email_verified=True,
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"  ✅ {user.username} ({email}) — created (uid: {fb_user.uid}, role: {role})"
                    )
                )

                # Save/update Firestore user profile with Firebase UID
                if db:
                    db.collection("users").document(fb_user.uid).set(
                        {
                            "django_id": user.id,
                            "uid": fb_user.uid,
                            "username": user.username,
                            "email": email,
                            "first_name": user.first_name or "",
                            "last_name": user.last_name or "",
                            "role": role,
                            "is_staff": user.is_staff,
                            "is_superuser": user.is_superuser,
                            "updated_at": firestore.SERVER_TIMESTAMP,
                        },
                        merge=True,
                    )

                created += 1

            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(f"  ❌ {user.username} ({email}) — error: {e}")
                )
                errors += 1

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done! Created: {created}, Skipped: {skipped}, Errors: {errors}"
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"\nAll users can now login with their email + password: {default_password}"
            )
        )
        self.stdout.write("Users:")
        for user in users:
            email = user.email or f"{user.username}@setu-pm.local"
            role = "ground"
            try:
                if hasattr(user, "profile"):
                    role = user.profile.role
            except Exception:
                pass
            self.stdout.write(f"  • {email} (role: {role})")
