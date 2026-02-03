"""
Management command to set up users with proper roles.
Run: python manage.py setup_all_users
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import UserProfile, Village


class Command(BaseCommand):
    help = "Create/reset test users with proper roles"

    def handle(self, *args, **options):
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("Setting up test users...")
        self.stdout.write("=" * 60)

        # Define users with their roles
        users_config = [
            {
                "username": "admin",
                "password": "Admin@123",
                "role": "admin",
                "is_superuser": True,
                "is_staff": True,
            },
            {
                "username": "authority",
                "password": "Authority@123",
                "role": "authority",
                "is_superuser": False,
                "is_staff": True,
            },
            {
                "username": "manager",
                "password": "Manager@123",
                "role": "manager",
                "is_superuser": False,
                "is_staff": False,
            },
            {
                "username": "ground",
                "password": "Ground@123",
                "role": "ground",
                "is_superuser": False,
                "is_staff": False,
            },
        ]

        for config in users_config:
            user, created = User.objects.get_or_create(username=config["username"])
            user.set_password(config["password"])
            user.is_superuser = config["is_superuser"]
            user.is_staff = config["is_staff"]
            user.email = f"{config['username']}@example.com"
            user.save()

            # Create or update profile
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = config["role"]
            profile.save()

            status = "Created" if created else "Updated"
            self.stdout.write(
                self.style.SUCCESS(
                    f'  {status}: {config["username"]} (role: {config["role"]})'
                )
            )

        # Create sample villages
        self.stdout.write("\n" + "-" * 60)
        self.stdout.write("Setting up sample villages...")
        villages = [
            "Rampur",
            "Sitapur",
            "Mahavir Nagar",
            "Krishna Village",
            "Laxmi Nagar",
            "Shanti Gram",
            "Jai Nagar",
        ]

        for village_name in villages:
            village, created = Village.objects.get_or_create(name=village_name)
            if created:
                self.stdout.write(f"  Created: {village_name}")
            else:
                self.stdout.write(f"  Exists: {village_name}")

        # Display credentials
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("USER CREDENTIALS")
        self.stdout.write("=" * 60)
        self.stdout.write("\n| Role              | Username   | Password       |")
        self.stdout.write("|-------------------|------------|----------------|")
        self.stdout.write("| Admin (superuser) | admin      | Admin@123      |")
        self.stdout.write("| Highest Authority | authority  | Authority@123  |")
        self.stdout.write("| Manager           | manager    | Manager@123    |")
        self.stdout.write("| Ground Level      | ground     | Ground@123     |")
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("\nRoles and Permissions:")
        self.stdout.write("  - ground: Can create gaps, upload data")
        self.stdout.write("  - manager: Can verify gaps, change status to in_progress")
        self.stdout.write("  - authority: Can resolve gaps, manage budgets")
        self.stdout.write("  - admin: Full access to everything")
        self.stdout.write("\n")

        self.stdout.write(self.style.SUCCESS("Setup completed successfully!"))
