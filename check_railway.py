#!/usr/bin/env python
"""
Railway Deployment Verification Script
Checks if the application is ready for Railway deployment
"""

import os
import sys
from pathlib import Path


def check_files():
    """Verify required files exist"""
    required_files = {
        "requirements.txt": "Python dependencies",
        "Procfile": "Railway process configuration",
        "runtime.txt": "Python version specification",
        "nixpacks.toml": "Build configuration",
        "manage.py": "Django management script",
        "config/settings.py": "Django settings",
        "config/wsgi.py": "WSGI configuration",
        "core/static/css/modern.css": "Enhanced UI stylesheet",
    }

    print("🔍 Checking required files...\n")
    all_good = True

    for file_path, description in required_files.items():
        if Path(file_path).exists():
            print(f"✅ {file_path} - {description}")
        else:
            print(f"❌ {file_path} - {description} [MISSING]")
            all_good = False

    return all_good


def check_requirements():
    """Verify critical dependencies in requirements.txt"""
    print("\n📦 Checking dependencies...\n")

    required_packages = [
        "Django==4.2.27",
        "gunicorn",
        "whitenoise",
        "psycopg2-binary",
        "django-unfold==0.40.0",
        "dj-database-url",
    ]

    try:
        with open("requirements.txt", "r") as f:
            content = f.read()

        all_good = True
        for package in required_packages:
            package_name = package.split("==")[0].split(">=")[0]
            if package_name.lower() in content.lower():
                print(f"✅ {package}")
            else:
                print(f"❌ {package} [MISSING]")
                all_good = False

        return all_good
    except FileNotFoundError:
        print("❌ requirements.txt not found")
        return False


def check_procfile():
    """Verify Procfile configuration"""
    print("\n🚂 Checking Procfile...\n")

    try:
        with open("Procfile", "r") as f:
            content = f.read()

        checks = {
            "migrate": "python manage.py migrate --noinput" in content,
            "collectstatic": "python manage.py collectstatic --noinput" in content,
            "gunicorn": "gunicorn config.wsgi" in content,
            "port_binding": "$PORT" in content,
        }

        all_good = True
        for check_name, passed in checks.items():
            if passed:
                print(f"✅ {check_name}")
            else:
                print(f"❌ {check_name} [MISSING]")
                all_good = False

        return all_good
    except FileNotFoundError:
        print("❌ Procfile not found")
        return False


def check_static_files():
    """Verify static files configuration"""
    print("\n🎨 Checking static files...\n")

    css_files = [
        "core/static/css/modern.css",
    ]

    all_good = True
    for css_file in css_files:
        if Path(css_file).exists():
            size = Path(css_file).stat().st_size
            print(f"✅ {css_file} ({size:,} bytes)")
        else:
            print(f"❌ {css_file} [MISSING]")
            all_good = False

    return all_good


def check_ui_templates():
    """Verify enhanced UI templates exist"""
    print("\n📄 Checking enhanced templates...\n")

    templates = [
        "core/templates/core/dashboard.html",
        "core/templates/core/villages.html",
        "core/templates/core/analytics.html",
        "core/templates/core/public_dashboard.html",
        "core/templates/core/manage_gaps.html",
        "core/templates/core/agent_dashboard.html",
        "core/templates/core/upload.html",
    ]

    all_good = True
    for template in templates:
        if Path(template).exists():
            # Check if it uses modern.css
            with open(template, "r", encoding="utf-8") as f:
                content = f.read()
                if "modern.css" in content:
                    print(f"✅ {template} (uses modern.css)")
                else:
                    print(f"⚠️  {template} (may need modern.css)")
        else:
            print(f"❌ {template} [MISSING]")
            all_good = False

    return all_good


def print_deployment_commands():
    """Print Railway deployment commands"""
    print("\n" + "=" * 60)
    print("🚀 RAILWAY DEPLOYMENT COMMANDS")
    print("=" * 60 + "\n")

    print("1️⃣  Install Railway CLI:")
    print("   npm install -g @railway/cli\n")

    print("2️⃣  Login to Railway:")
    print("   railway login\n")

    print("3️⃣  Initialize project:")
    print("   railway init\n")

    print("4️⃣  Add PostgreSQL:")
    print("   railway add postgresql\n")

    print("5️⃣  Set environment variables:")
    print(
        "   railway variables set SECRET_KEY=\"$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')\""
    )
    print('   railway variables set DEBUG="False"')
    print('   railway variables set ALLOWED_HOSTS="*.railway.app"\n')

    print("6️⃣  Deploy:")
    print("   railway up\n")

    print("7️⃣  Monitor deployment:")
    print("   railway logs -f\n")

    print("8️⃣  Create admin user:")
    print("   railway run python manage.py createsuperuser\n")


def main():
    """Run all verification checks"""
    print("\n" + "=" * 60)
    print("🚂 RAILWAY DEPLOYMENT READINESS CHECK")
    print("=" * 60 + "\n")

    results = {
        "Files": check_files(),
        "Dependencies": check_requirements(),
        "Procfile": check_procfile(),
        "Static Files": check_static_files(),
        "Templates": check_ui_templates(),
    }

    print("\n" + "=" * 60)
    print("📊 RESULTS SUMMARY")
    print("=" * 60 + "\n")

    for check_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{check_name:.<40} {status}")

    all_passed = all(results.values())

    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL CHECKS PASSED - READY FOR RAILWAY DEPLOYMENT!")
        print("=" * 60 + "\n")
        print_deployment_commands()
        return 0
    else:
        print("❌ SOME CHECKS FAILED - FIX ISSUES BEFORE DEPLOYING")
        print("=" * 60 + "\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
