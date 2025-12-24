# PM-AJAY Quick Setup Script
# Run this in Django shell: python manage.py shell < setup_users.py

from django.contrib.auth.models import User
from core.models import UserProfile, Village

def setup_users():
    """Create test users with roles"""
    
    def ensure_user(username, password, role, is_superuser=False, is_staff=False):
        user, created = User.objects.get_or_create(username=username)
        user.is_superuser = is_superuser
        user.is_staff = is_staff
        user.set_password(password)
        user.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save()
        print(f"{'✅ Created' if created else '🔄 Updated'} {username} with role {role}")
    
    print("\n🔧 Setting up test users...")
    ensure_user("admin", "Admin@123", "admin", is_superuser=True, is_staff=True)
    ensure_user("authority", "Authority@123", "authority")
    ensure_user("manager", "Manager@123", "manager")
    ensure_user("ground", "Ground@123", "ground")
    print("\n✅ Users created successfully!")

def setup_sample_villages():
    """Create sample villages"""
    villages = [
        "Rampur", "Sitapur", "Mahavir Nagar", "Krishna Village",
        "Laxmi Nagar", "Shanti Gram", "Jai Nagar"
    ]
    
    print("\n🏘️ Setting up sample villages...")
    for village_name in villages:
        village, created = Village.objects.get_or_create(name=village_name)
        if created:
            print(f"✅ Created village: {village_name}")
        else:
            print(f"🔄 Village exists: {village_name}")
    print("\n✅ Villages created successfully!")

def display_credentials():
    """Display all user credentials"""
    print("\n" + "="*60)
    print("🔐 USER CREDENTIALS")
    print("="*60)
    print("\n| Role              | Username   | Password       |")
    print("|-------------------|------------|----------------|")
    print("| Admin (superuser) | admin      | Admin@123      |")
    print("| Highest Authority | authority  | Authority@123  |")
    print("| Manager           | manager    | Manager@123    |")
    print("| Ground Level      | ground     | Ground@123     |")
    print("\n" + "="*60)
    print("\n📌 Access the system at: http://localhost:8000/")
    print("📌 Login page: http://localhost:8000/accounts/login/")
    print("\n")

# Run setup
if __name__ == "__main__":
    try:
        setup_users()
        setup_sample_villages()
        display_credentials()
        print("🎉 Setup completed successfully!\n")
    except Exception as e:
        print(f"❌ Error during setup: {e}")
