"""
Management command to sync all Django data to Firebase Firestore.

Usage:
    python manage.py sync_to_firebase          # Sync everything
    python manage.py sync_to_firebase --gaps    # Sync only gaps
    python manage.py sync_to_firebase --villages # Sync only villages
    python manage.py sync_to_firebase --users   # Sync only users
    python manage.py sync_to_firebase --import  # Import mobile app data into Django
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Sync Django database to Firebase Firestore"

    def add_arguments(self, parser):
        parser.add_argument(
            "--gaps", action="store_true", help="Sync only gaps"
        )
        parser.add_argument(
            "--villages", action="store_true", help="Sync only villages"
        )
        parser.add_argument(
            "--users", action="store_true", help="Sync only users"
        )
        parser.add_argument(
            "--complaints", action="store_true", help="Sync only complaints"
        )
        parser.add_argument(
            "--import",
            dest="import_data",
            action="store_true",
            help="Import new data from Firestore into Django",
        )

    def handle(self, *args, **options):
        from core.firebase_utils import (
            sync_all_villages,
            sync_all_gaps,
            sync_all_complaints,
            sync_all_users,
            sync_everything,
            import_gaps_from_firestore,
            get_firebase_app,
        )

        app = get_firebase_app()
        if not app:
            self.stderr.write(
                self.style.ERROR(
                    "Firebase not initialized. Place firebase-service-account.json "
                    "in the project root or set FIREBASE_CREDENTIALS_PATH."
                )
            )
            return

        specific = (
            options["gaps"]
            or options["villages"]
            or options["users"]
            or options["complaints"]
            or options["import_data"]
        )

        if options["import_data"]:
            self.stdout.write(self.style.WARNING("Importing from Firestore → Django..."))
            count = import_gaps_from_firestore()
            self.stdout.write(self.style.SUCCESS(f"Imported {count} new gaps"))
            return

        if not specific:
            self.stdout.write(self.style.WARNING("Syncing ALL data to Firestore..."))
            result = sync_everything()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Done! {result['villages']} villages, {result['gaps']} gaps, "
                    f"{result['complaints']} complaints, {result['users']} users"
                )
            )
            return

        if options["villages"]:
            count = sync_all_villages()
            self.stdout.write(self.style.SUCCESS(f"Synced {count} villages"))

        if options["gaps"]:
            count = sync_all_gaps()
            self.stdout.write(self.style.SUCCESS(f"Synced {count} gaps"))

        if options["complaints"]:
            count = sync_all_complaints()
            self.stdout.write(self.style.SUCCESS(f"Synced {count} complaints"))

        if options["users"]:
            count = sync_all_users()
            self.stdout.write(self.style.SUCCESS(f"Synced {count} users"))
