"""
Management command to load local data fixture into the database.
Run: python manage.py load_local_data
"""

import json
import os
import shutil
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.conf import settings
from core.models import Gap, Village, Submission, VoiceVerificationLog


class Command(BaseCommand):
    help = "Load local data fixture (gaps, submissions, villages, voice logs)"

    # Map of local user PKs to usernames (from original local DB)
    LOCAL_USER_MAP = {
        15: "admin1",
        16: "authority1",
        17: "manager1",
        18: "ground1",
    }

    def handle(self, *args, **options):
        self._load_media_files()
        self._load_fixture_data()

    def _load_media_files(self):
        """Copy bundled media files to MEDIA_ROOT"""
        bundle_dir = os.path.join(settings.BASE_DIR, "core", "fixtures", "media_bundle")
        media_root = str(settings.MEDIA_ROOT)

        if not os.path.isdir(bundle_dir):
            self.stdout.write("No media bundle found, skipping media copy.")
            return

        # Count existing files in media root
        existing = sum(len(f) for _, _, f in os.walk(media_root)) if os.path.isdir(media_root) else 0
        if existing > 0:
            self.stdout.write(self.style.WARNING(
                f"Media files already exist ({existing} files). Skipping media copy."
            ))
            return

        copied = 0
        for root, dirs, files in os.walk(bundle_dir):
            for filename in files:
                src = os.path.join(root, filename)
                rel_path = os.path.relpath(src, bundle_dir)
                dest = os.path.join(media_root, rel_path)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copy2(src, dest)
                copied += 1

        self.stdout.write(self.style.SUCCESS(f"Copied {copied} media files to {media_root}"))

    def _load_fixture_data(self):
        """Load JSON fixture with user PK remapping"""
        if Gap.objects.exists():
            self.stdout.write(self.style.WARNING(
                f"Data already exists ({Gap.objects.count()} gaps). Skipping fixture load."
            ))
            return

        self.stdout.write("Loading local data fixture...")

        with open("core/fixtures/local_data.json", "r", encoding="utf-8") as f:
            data = json.load(f)

        # Build username->pk map for current Railway users
        username_to_pk = {}
        for username in self.LOCAL_USER_MAP.values():
            try:
                username_to_pk[username] = User.objects.get(username=username).pk
            except User.DoesNotExist:
                pass

        # Remap user FK fields
        user_fk_fields = ["resolved_by"]
        for obj in data:
            for field in user_fk_fields:
                if field in obj["fields"] and obj["fields"][field] in self.LOCAL_USER_MAP:
                    old_pk = obj["fields"][field]
                    username = self.LOCAL_USER_MAP[old_pk]
                    new_pk = username_to_pk.get(username)
                    if new_pk:
                        obj["fields"][field] = new_pk
                        self.stdout.write(f"  Remapped {field}: {old_pk} -> {new_pk} ({username})")
                    else:
                        obj["fields"][field] = None
                        self.stdout.write(f"  Nulled {field}: user {username} not found")

        # Write corrected fixture
        with open("core/fixtures/local_data_fixed.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        # Load the corrected fixture
        from django.core.management import call_command
        call_command("loaddata", "core/fixtures/local_data_fixed.json", verbosity=1)

        self.stdout.write(self.style.SUCCESS(
            f"Loaded: {Gap.objects.count()} gaps, "
            f"{Submission.objects.count()} submissions, "
            f"{VoiceVerificationLog.objects.count()} voice logs"
        ))
