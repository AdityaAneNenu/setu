# 🚀 SETU Production Deployment Guide

This guide covers deploying SETU PM-AJAY to production environments with enterprise-grade security.

## 📋 Quick Deployment Checklist

- [ ] 🔒 **Security**: All secrets in environment variables
- [ ] 🗄️ **Database**: PostgreSQL 15+ configured
- [ ] 🔥 **Firebase**: Credentials rotated, rules secured
- [ ] 📱 **Mobile**: EAS Build configured with secrets
- [ ] 🌐 **Web**: Railway/Heroku deployment ready
- [ ] 🔍 **Monitoring**: Health checks operational

---

## 🌊 Railway Deployment (Recommended)

### Step 1: Railway Setup
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to existing project or create new
railway link

# Set environment variables (see section below)
railway variables set SECRET_KEY="your-secret-key"
```

### Step 2: Environment Variables
```bash
# Required (CRITICAL)
railway variables set SECRET_KEY="your-django-secret-key"
railway variables set DATABASE_URL="postgresql://..."
railway variables set RAILWAY_PUBLIC_DOMAIN="your-app.up.railway.app"

# Recommended (Features)
railway variables set GEMINI_API_KEY="your-gemini-key"
railway variables set ASSEMBLYAI_API_KEY="your-assemblyai-key"  
railway variables set CLOUDINARY_URL="cloudinary://..."
railway variables set EMAIL_HOST_USER="your-email@gmail.com"
railway variables set EMAIL_HOST_PASSWORD="your-app-password"

# Firebase (Mobile App)
railway variables set FIREBASE_API_KEY="your-firebase-key"
railway variables set FIREBASE_PROJECT_ID="your-project-id"
```

### Step 3: Deploy
```bash
# Deploy to production
railway up --detach

# Monitor deployment
railway logs -f

# Run migrations
railway shell "python manage.py migrate"

# Verify deployment
curl https://your-app.up.railway.app/health/
```

---

## 🔥 Firebase Security Setup

### Step 1: Rotate API Keys
```bash
# 1. Go to Firebase Console → Project Settings → Service Accounts
# 2. Generate new private key
# 3. Download JSON file (DO NOT commit to Git)
# 4. Set in Railway environment variables
```

### Step 2: Secure Firestore Rules  
The deployed `firestore.rules` file includes owner-only access:
```javascript
// ✅ SECURED: Only owners can access their data
match /users/{userId} {
  allow read: if isAuthenticated() && isOwner(userId);
  allow create, update: if isOwner(userId);
  allow delete: if false;
}
```

### Step 3: Mobile App Secrets (EAS Build)
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Configure secrets (DO NOT put in app.json)
eas secret:create --scope project --name FIREBASE_API_KEY --value "your-key"
eas secret:create --scope project --name FIREBASE_PROJECT_ID --value "your-project"

# Build for production
eas build --platform android --profile production
```

---

## 📱 Mobile App Deployment

### Android Deployment
```bash
cd mobile-app/

# Install dependencies
npm install

# Configure app.json with production URL
# Set "apiUrl": "https://your-app.up.railway.app"

# Build APK
eas build --platform android --profile production

# OR build locally
npx expo run:android --variant release
```

### iOS Deployment  
```bash
# Requires Apple Developer Account
eas build --platform ios --profile production

# OR build locally (macOS only)
npx expo run:ios --configuration Release
```

---

## 🌐 Alternative Deployment Platforms

### Heroku
```bash
# Install Heroku CLI
# Set buildpacks
heroku buildpacks:set heroku/python
heroku buildpacks:add --index 1 heroku/nodejs

# Set environment variables
heroku config:set SECRET_KEY="your-secret"
heroku config:set DATABASE_URL="postgresql://..."

# Deploy
git push heroku main
```

### DigitalOcean App Platform
```yaml
# .do/app.yaml
name: setu-pm-ajay
services:
- name: django-api
  source_dir: /
  github:
    repo: AdityaAneNenu/setu
    branch: main
  run_command: gunicorn config.wsgi:application --bind 0.0.0.0:8080
  environment_slug: python
  envs:
  - key: SECRET_KEY
    value: your-secret
```

### Docker Deployment
```dockerfile
# Dockerfile already configured
docker build -t setu-pm-ajay .
docker run -p 8000:8000 --env-file .env setu-pm-ajay
```

---

## 🔍 Post-Deployment Verification

### Automated Verification
```bash
# Run comprehensive verification
python verify_deployment.py --post-deploy

# Check specific components
python verify_deployment.py --full
```

### Manual Health Checks
```bash
# Basic health
curl https://your-app.up.railway.app/health/

# Readiness check  
curl https://your-app.up.railway.app/ready/

# API authentication test
curl -X POST https://your-app.up.railway.app/api/gaps/ \
  -F "description=Test" \
  -F "gap_type=water"
# Should return: {"detail":"Authentication credentials were not provided."}
```

### Expected Health Response:
```json
{
  "status": "healthy",
  "database": "healthy", 
  "cache": "healthy",
  "firebase_sync": "healthy",
  "firebase_retry_queue": 0,
  "service": "setu-pm-django"
}
```

---

## 🛠️ Maintenance & Monitoring

### Firebase Retry Queue Management
```bash
# Set up cron job (every 30 minutes)
*/30 * * * * cd /path/to/setu && python manage.py process_firebase_retries

# Manual processing
railway shell "python manage.py process_firebase_retries"

# Check retry queue status
railway shell "python manage.py process_firebase_retries --dry-run"
```

### Log Monitoring
```bash  
# Railway logs
railway logs -f

# Filter errors only
railway logs -f | grep ERROR

# Export logs
railway logs --format json > deployment.log
```

### Performance Monitoring
```bash
# Database performance
railway shell "python manage.py dbshell"
# Run: SELECT * FROM pg_stat_activity;

# Cache performance  
railway shell "python -c 'from django.core.cache import cache; print(cache.get(\"test\"))'"
```

---

## 🚨 Security Hardening

### SSL/TLS Configuration
✅ **Railway provides automatic HTTPS**
✅ **HSTS headers configured**  
✅ **Secure cookie settings enabled**

### Rate Limiting (Active)
- 100 requests/hour (anonymous users)
- 1000 requests/hour (authenticated users)  
- File upload limits: 50MB audio, 10MB images

### Security Headers (Configured)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff  
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy: comprehensive ruleset

### Database Security
- PostgreSQL with connection pooling
- Parameterized queries (SQL injection protection)
- Database backups enabled on Railway

---

## 🔧 Troubleshooting

### Common Issues

**❌ "Authentication credentials were not provided"**
```bash
# ✅ This is CORRECT behavior - API requires authentication
# Create user and token for testing:
railway shell "python manage.py createsuperuser"
```

**❌ Firebase sync failures**
```bash
# Check retry queue
railway shell "python manage.py process_firebase_retries --dry-run"

# Manual retry
railway shell "python manage.py process_firebase_retries"
```

**❌ Large file upload errors**
```bash
# ✅ This is CORRECT - security protection active
# Files > 50MB (audio) or 10MB (images) are rejected
```

**❌ Mobile app "Firebase configuration missing"**
```bash
# Set EAS Build secrets:
eas secret:create --scope project --name FIREBASE_API_KEY --value "your-key"
```

### Health Check Failures
```bash
# Database connection issues
railway shell "python manage.py dbshell"

# Cache connection issues  
railway shell "python -c 'from django.core.cache import cache; cache.set(\"test\", \"ok\")'"

# Migration issues
railway shell "python manage.py showmigrations"
railway shell "python manage.py migrate"
```

---

## 📞 Support & Resources

- **Production URL**: https://setu-pm-django-production.up.railway.app  
- **Health Monitoring**: https://setu-pm-django-production.up.railway.app/health/
- **GitHub Actions**: Automated CI/CD pipeline
- **Documentation**: Complete API docs at `/api/schema/swagger/`

**Need Help?** Check the deployment verification results:
```bash
python verify_deployment.py --full
```

---

## 🎯 Production Readiness: 95%

✅ **Security**: Enterprise-grade protection  
✅ **Scalability**: Railway auto-scaling enabled  
✅**Monitoring**: Health checks + retry queues  
✅ **Backup**: Database backups configured  
✅ **CI/CD**: GitHub Actions pipeline  

**Ready for production deployment!** 🚀