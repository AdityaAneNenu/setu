#!/usr/bin/env python3
"""
🚀 SETU PM-AJAY Production Deployment Verification Script
Runs comprehensive checks before and after deployment to ensure production readiness.

Usage: python verify_deployment.py [--pre-deploy|--post-deploy|--full]
"""

import os
import sys
import django
import subprocess
import time
from pathlib import Path

# Add the project directory to sys.path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.core.management import call_command
from django.db import connection
from django.core.cache import cache
from django.test.utils import get_runner
from django.conf import settings
from core.models import Gap, Village, User


class DeploymentVerifier:
    """Comprehensive deployment verification"""

    def __init__(self):
        self.errors = []
        self.warnings = []

    def log_error(self, message):
        print(f"❌ ERROR: {message}")
        self.errors.append(message)

    def log_warning(self, message):
        print(f"⚠️  WARNING: {message}")
        self.warnings.append(message)

    def log_success(self, message):
        print(f"✅ {message}")

    def log_info(self, message):
        print(f"ℹ️  {message}")

    def check_environment_variables(self):
        """Verify critical environment variables"""
        print("\n🔍 Checking Environment Variables...")

        required_vars = ["SECRET_KEY", "DATABASE_URL", "RAILWAY_PUBLIC_DOMAIN"]

        recommended_vars = [
            "GEMINI_API_KEY",
            "ASSEMBLYAI_API_KEY",
            "CLOUDINARY_URL",
            "EMAIL_HOST_USER",
            "EMAIL_HOST_PASSWORD",
        ]

        for var in required_vars:
            if not os.getenv(var):
                self.log_error(f"Missing required environment variable: {var}")
            else:
                self.log_success(f"Required variable {var} is set")

        for var in recommended_vars:
            if not os.getenv(var):
                self.log_warning(f"Missing recommended environment variable: {var}")
            else:
                self.log_success(f"Recommended variable {var} is set")

    def check_database_connection(self):
        """Test database connectivity and migrations"""
        print("\n🗄️  Checking Database...")

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            self.log_success("Database connection successful")
        except Exception as e:
            self.log_error(f"Database connection failed: {e}")
            return

        try:
            # Check if migrations are applied
            call_command("migrate", "--check", verbosity=0)
            self.log_success("All migrations are applied")
        except Exception as e:
            self.log_error(f"Migration check failed: {e}")

        # Check critical tables
        try:
            gap_count = Gap.objects.count()
            village_count = Village.objects.count()
            user_count = User.objects.count()

            self.log_info(
                f"Database contents: {gap_count} gaps, {village_count} villages, {user_count} users"
            )
        except Exception as e:
            self.log_error(f"Database query failed: {e}")

    def check_cache_system(self):
        """Test cache connectivity"""
        print("\n💾 Checking Cache System...")

        try:
            test_key = f"verify_deployment_{int(time.time())}"
            cache.set(test_key, "test_value", 60)
            retrieved = cache.get(test_key)

            if retrieved == "test_value":
                self.log_success("Cache system working")
                cache.delete(test_key)
            else:
                self.log_warning("Cache read/write test failed")
        except Exception as e:
            self.log_warning(f"Cache system error: {e}")

    def check_firebase_configuration(self):
        """Check Firebase and mobile app config"""
        print("\n🔥 Checking Firebase Configuration...")

        # Check if Firebase credentials are properly secured
        firebase_config_path = (
            project_root / "mobile-app" / "src" / "config" / "firebase.js"
        )

        if firebase_config_path.exists():
            with open(firebase_config_path, "r") as f:
                content = f.read()

            if "AIzaSy" in content and "__DEV__" not in content:
                self.log_error(
                    "Firebase API keys still exposed in mobile app source code"
                )
            else:
                self.log_success("Firebase credentials properly secured")
        else:
            self.log_warning("Firebase config file not found")

        # Check Firestore rules
        firestore_rules_path = project_root / "firestore.rules"
        if firestore_rules_path.exists():
            with open(firestore_rules_path, "r") as f:
                rules_content = f.read()

            if "isOwner(userId)" in rules_content:
                self.log_success("Firestore rules properly secured")
            else:
                self.log_error("Firestore rules may be too permissive")
        else:
            self.log_warning("Firestore rules file not found")

    def check_security_settings(self):
        """Verify security configurations"""
        print("\n🔒 Checking Security Settings...")

        # Check Django security settings
        if settings.DEBUG:
            self.log_error("DEBUG is True - should be False in production")
        else:
            self.log_success("DEBUG properly disabled")

        if settings.SECRET_KEY and len(settings.SECRET_KEY) > 40:
            self.log_success("SECRET_KEY properly configured")
        else:
            self.log_error("SECRET_KEY missing or too short")

        if "whitenoise.middleware.WhiteNoiseMiddleware" in settings.MIDDLEWARE:
            self.log_success("WhiteNoise middleware configured")
        else:
            self.log_warning("WhiteNoise middleware not found")

    def check_api_endpoints(self):
        """Test critical API endpoints"""
        print("\n🌐 Checking API Endpoints...")

        try:
            from django.test import Client

            client = Client()

            # Test health endpoint
            response = client.get("/health/")
            if response.status_code == 200:
                self.log_success("Health endpoint working")
            else:
                self.log_error(f"Health endpoint failed: {response.status_code}")

            # Test readiness endpoint
            response = client.get("/ready/")
            if response.status_code == 200:
                self.log_success("Readiness endpoint working")
            else:
                self.log_error(f"Readiness endpoint failed: {response.status_code}")

        except Exception as e:
            self.log_error(f"API endpoint check failed: {e}")

    def check_static_files(self):
        """Verify static file configuration"""
        print("\n📁 Checking Static Files...")

        try:
            call_command("collectstatic", "--dry-run", "--noinput", verbosity=0)
            self.log_success("Static files collection configured correctly")
        except Exception as e:
            self.log_warning(f"Static files check failed: {e}")

    def run_security_tests(self):
        """Run security-focused tests"""
        print("\n🛡️  Running Security Tests...")

        # Test file size validation
        from django.test import Client
        from django.core.files.uploadedfile import SimpleUploadedFile
        import io

        client = Client()

        # Create oversized file (virtual)
        large_content = b"x" * (51 * 1024 * 1024)  # 51MB
        large_file = SimpleUploadedFile(
            "test.wav", large_content, content_type="audio/wav"
        )

        try:
            from django.contrib.auth.models import User
            from rest_framework.authtoken.models import Token

            # Create test user for authentication
            user, created = User.objects.get_or_create(username="test_security")
            token, _ = Token.objects.get_or_create(user=user)

            # Test oversized audio file rejection
            response = client.post(
                "/api/gaps/",
                {
                    "description": "Test gap",
                    "gap_type": "water",
                    "severity": "medium",
                    "latitude": 28.6139,
                    "longitude": 77.2090,
                    "audio_file": large_file,
                },
                HTTP_AUTHORIZATION=f"Token {token.key}",
            )

            if response.status_code == 400 and "too large" in str(response.content):
                self.log_success("File size validation working")
            else:
                self.log_error("File size validation may not be working")

        except Exception as e:
            self.log_warning(f"Security test failed: {e}")

    def run_pre_deploy_checks(self):
        """Run checks before deployment"""
        print("🚀 PRE-DEPLOYMENT VERIFICATION")
        print("=" * 50)

        self.check_environment_variables()
        self.check_database_connection()
        self.check_firebase_configuration()
        self.check_security_settings()

    def run_post_deploy_checks(self):
        """Run checks after deployment"""
        print("✅ POST-DEPLOYMENT VERIFICATION")
        print("=" * 50)

        self.check_database_connection()
        self.check_cache_system()
        self.check_api_endpoints()
        self.check_static_files()
        self.run_security_tests()

    def run_full_verification(self):
        """Run comprehensive verification"""
        print("🔍 FULL DEPLOYMENT VERIFICATION")
        print("=" * 50)

        self.check_environment_variables()
        self.check_database_connection()
        self.check_cache_system()
        self.check_firebase_configuration()
        self.check_security_settings()
        self.check_api_endpoints()
        self.check_static_files()
        self.run_security_tests()

    def generate_summary(self):
        """Generate verification summary"""
        print("\n" + "=" * 50)
        print("📊 VERIFICATION SUMMARY")
        print("=" * 50)

        if not self.errors and not self.warnings:
            print("🎉 ALL CHECKS PASSED! System is production-ready.")
            return 0

        if self.errors:
            print(f"❌ {len(self.errors)} ERRORS found:")
            for error in self.errors:
                print(f"   • {error}")

        if self.warnings:
            print(f"⚠️  {len(self.warnings)} WARNINGS found:")
            for warning in self.warnings:
                print(f"   • {warning}")

        if self.errors:
            print("\n🚨 DEPLOYMENT BLOCKED - Fix errors before proceeding")
            return 1
        else:
            print("\n✅ DEPLOYMENT OK - Address warnings when possible")
            return 0


def main():
    import argparse

    parser = argparse.ArgumentParser(description="SETU PM-AJAY Deployment Verification")
    parser.add_argument(
        "--pre-deploy", action="store_true", help="Run pre-deployment checks"
    )
    parser.add_argument(
        "--post-deploy", action="store_true", help="Run post-deployment checks"
    )
    parser.add_argument("--full", action="store_true", help="Run full verification")

    args = parser.parse_args()

    verifier = DeploymentVerifier()

    if args.pre_deploy:
        verifier.run_pre_deploy_checks()
    elif args.post_deploy:
        verifier.run_post_deploy_checks()
    elif args.full:
        verifier.run_full_verification()
    else:
        # Default to full verification
        verifier.run_full_verification()

    return verifier.generate_summary()


if __name__ == "__main__":
    sys.exit(main())
