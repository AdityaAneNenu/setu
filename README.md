# SETU: Smart Evaluation and Tracking Utility

> A comprehensive rural infrastructure gap tracking, complaint resolution, and biometric voice verification platform for village development.

---

## 📋 Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Installation & Setup](#installation--setup)
- [User Roles](#user-roles)
- [Core Features](#core-features)
- [Mobile App](#mobile-app)
- [API Documentation](#api-documentation)
- [Database Models](#database-models)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## 🌟 Overview

SETU (Smart Evaluation and Tracking Utility) is a comprehensive platform designed to track and resolve rural infrastructure gaps across India. The system combines AI-powered analysis, voice biometric verification, and mobile app integration to create an efficient solution for rural development monitoring.

### The Problem
Rural areas face critical infrastructure gaps—water supply, roads, sanitation, electricity, education, healthcare—but lack efficient tracking and resolution mechanisms. Traditional systems are slow, prone to fraud, and offer limited stakeholder visibility.

### The Solution
SETU provides a complete ecosystem for infrastructure gap management:
- **Multi-modal Gap Submission**: Image, voice, text, and QR-based mobile submissions
- **AI-Powered Analysis**: Automatic categorization and severity assessment using Google Gemini AI
- **Voice Biometric Verification**: Prevents fraudulent closures through voice fingerprinting
- **Offline-First Mobile App**: QR code scanning with photo verification for remote areas
- **Role-Based Workflows**: Customized dashboards for ground workers, managers, and authorities
- **Real-Time Analytics**: Visual dashboards with comprehensive gap statistics
- **Budget Management**: Track allocations and expenditures per project
- **Post Office Network Integration**: Leverages India's postal network for last-mile connectivity

---

## 🚀 Key Features

### 1. Multi-Modal Gap Submission
- **Image Upload**: Upload infrastructure photos with automatic AI analysis
- **Voice Recording**: Record complaints in 6 regional languages (Hindi, English, Tamil, Telugu, Bengali, Marathi)
- **Text Input**: Manual gap entry with detailed descriptions
- **Mobile App**: Offline QR-based submissions with GPS tagging

### 2. AI-Powered Analysis
- Automatic categorization into 11 infrastructure types:
  - Water Supply
  - Road Infrastructure
  - Sanitation
  - Electricity
  - Education
  - Healthcare
  - Agriculture
  - Welfare Programs
  - Connectivity
  - Transportation
  - Livelihood & Skills
- Severity assessment (Low, Medium, High, Urgent)
- AI-generated recommendations for resolution
- Multi-language support with automatic translation

### 3. Voice Biometric Verification
- Voice fingerprint capture during complaint submission
- Biometric matching for resolution verification
- Prevents fraudulent closures
- Audio feature extraction using librosa
- Similarity threshold: 70%
- Complete verification audit trail

### 4. Comprehensive Workflow Management
- Post Office Network integration for complaint intake
- Survey Agents for field inspection
- Email notifications for stakeholders
- Timeline tracking (start, expected, actual completion dates)
- 12-stage status progression from submission to closure

### 5. Mobile Application
- React Native/Expo cross-platform app
- Offline-first architecture with local storage
- QR code scanning
- Camera integration with GPS tagging
- Background synchronization
- Batch upload support

### 6. Analytics & Reporting
- Real-time dashboards
- Village-wise breakdowns
- Gap type distribution charts
- Status tracking and trend analysis
- Budget utilization reports
- Public transparency dashboard

### 7. Role-Based Access Control
- **Admin**: Full system access and user management
- **Authority**: View all gaps, approve budgets, handle escalations
- **Manager**: Assign tasks, track progress, manage budgets
- **Ground Worker**: Submit gaps, update status, field operations

---

## 🛠️ Tech Stack

### Backend
- **Framework**: Django 4.2.27
- **API**: Django REST Framework 3.14.0
- **Database**: SQLite (Development), PostgreSQL (Production)
- **Authentication**: Django built-in authentication with role-based permissions

### AI & Machine Learning
- **LLM**: Google Gemini 2.5 Flash (`gemini-2.5-flash`)
- **Audio Processing**: 
  - librosa 0.10.1 (audio feature extraction)
  - scipy 1.11.4 (scientific computing)
  - scikit-learn 1.3.2 (similarity calculations)
  - soundfile 0.12.1 (audio I/O)
- **Speech Recognition**: AssemblyAI 0.48.1

### Frontend
- **Web**: Django Templates, HTML5, CSS3, JavaScript
- **Mobile**: React Native + Expo SDK 54
- **Styling**: Custom CSS, Bootstrap components

### Infrastructure
- **Web Server**: Django Development Server (Gunicorn for production)
- **File Storage**: Local filesystem (AWS S3/Azure Blob for production)
- **CORS**: django-cors-headers 4.3.1
- **Environment**: python-dotenv 1.0.0

### External Services
- **AI**: Google Gemini API
- **Speech**: AssemblyAI API
- **Email**: SMTP (Gmail)

---

## 📦 Installation & Setup

### Prerequisites
- Python 3.8 or higher
- Node.js 16+ and npm 8+ (for mobile app)
- Git
- Windows 10/11, macOS 11+, or Linux

### Required API Keys
1. **Google Gemini API Key**
   - Get from: https://makersuite.google.com/app/apikey
2. **Gmail App Password** (for email notifications)
   - Enable 2FA: https://myaccount.google.com/security
   - Generate App Password: https://myaccount.google.com/apppasswords
3. **AssemblyAI API Key** (optional, for advanced speech recognition)
   - Get from: https://www.assemblyai.com/

### Setup Steps

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd setu-pm-ajay-main
```

#### 2. Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

#### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 4. Configure Environment Variables
Create a `.env` file in the project root:

```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# AI Configuration
GEMINI_API_KEY=your-gemini-api-key

# Email Configuration
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password

# AssemblyAI (Optional)
ASSEMBLYAI_API_KEY=your-assemblyai-key

# Database (defaults to SQLite)
DATABASE_URL=sqlite:///db.sqlite3
```

#### 5. Initialize Database
```bash
python manage.py migrate
```

#### 6. Create Media Directories
```bash
# Windows PowerShell
New-Item -ItemType Directory -Force -Path media\voice_samples
New-Item -ItemType Directory -Force -Path media\gap_audio
New-Item -ItemType Directory -Force -Path media\uploads
New-Item -ItemType Directory -Force -Path media\qr_submissions\photos
New-Item -ItemType Directory -Force -Path media\qr_submissions\audio

# macOS/Linux
mkdir -p media/{voice_samples,gap_audio,uploads,qr_submissions/{photos,audio}}
```

#### 7. Start Development Server
```bash
python manage.py runserver 0.0.0.0:8000
```

Access the application at: **http://localhost:8000**

---

## 👥 User Roles

### Default Test Users

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| **Admin** | admin | Admin@123 | Full system access, user management |
| **Authority** | authority | Authority@123 | View all gaps, approve budgets, handle escalations |
| **Manager** | manager | Manager@123 | Assign tasks, track progress, manage budgets |
| **Ground** | ground | Ground@123 | Submit gaps, update status, field operations |

### Role Capabilities

#### Admin
- Create and manage users
- Access Django admin panel
- Configure system settings
- Override any action
- View system logs

#### Authority (Highest Level)
- View all gaps across all villages
- Approve/reject budget allocations
- Escalate critical issues
- Generate comprehensive reports
- Access analytics dashboard

#### Manager
- Assign gaps to field workers
- Update gap status
- Manage budgets (allocate, track spending)
- View assigned village data
- Monitor progress timelines

#### Ground Worker
- Submit new gaps (image/voice/text)
- Upload photos and audio recordings
- Update assigned gap status
- Report completion
- View assigned tasks

---

## 🎯 Core Features

### 1. Image-Based Gap Submission

**Workflow**:
1. Ground worker uploads infrastructure photo
2. Google Gemini AI analyzes the image
3. System automatically extracts:
   - Gap type classification
   - Severity level
   - Detailed description
   - Resolution recommendations
4. Gap saved to database
5. Email notification sent to manager

**Supported Formats**: JPG, PNG, WEBP, HEIC  
**Max File Size**: 10 MB

### 2. Voice-Based Gap Submission

**Workflow**:
1. Worker records complaint in regional language
2. AssemblyAI transcribes the audio
3. Text translated to English (if needed)
4. AI categorizes and analyzes content
5. Voice fingerprint extracted and stored
6. Gap created with unique voice code

**Supported Languages**: Hindi, English, Tamil, Telugu, Bengali, Marathi

**Audio Requirements**:
- Format: WAV, MP3, M4A
- Duration: 5 seconds - 5 minutes
- Quality: Clear speech with minimal background noise

### 3. Voice Biometric Verification

**How It Works**:
1. Voice sample captured during complaint submission
2. Audio features extracted using librosa:
   - MFCCs (Mel-frequency cepstral coefficients)
   - Spectral centroid
   - Zero crossing rate
   - Chroma features
3. Features normalized and stored as "voice code"
4. During resolution, new voice sample collected
5. Features compared using cosine similarity
6. Verification passes if similarity > 70%
7. Resolution allowed only with voice match

**Security Benefits**:
- Prevents fraudulent closures
- Ensures villager confirmation
- Creates complete audit trail
- Reduces corruption

### 4. QR-Based Offline Submissions

**Use Case**: Areas with limited or no internet connectivity

**Workflow**:
1. Government issues QR codes to villages
2. Mobile app scans QR code
3. Pre-filled form appears with village details
4. Worker captures person photo
5. GPS location tagged automatically
6. Data saved locally on phone
7. Auto-syncs when internet available
8. Server converts to formal complaint

**QR Data Format**:
```json
{
  "village_id": "123",
  "village_name": "Village Name",
  "district": "District Name",
  "state": "State Name",
  "form_type": "complaint"
}
```

### 5. Budget Management

**Features**:
- Allocate budget per gap
- Track spending in real-time
- Calculate remaining budget
- Generate utilization reports
- Flag over-budget projects

**Budget Fields**:
```python
Gap:
  - budget_allocated: Decimal
  - budget_spent: Decimal
  - budget_remaining: Calculated Property
```

**Manager Actions**:
- Set initial budget allocation
- Update spent amount as work progresses
- Approve additional budget requests
- Generate expenditure reports

### 6. Timeline Tracking

**Key Milestones**:
- **Start Date**: When work begins
- **Expected Completion**: Target deadline
- **Actual Completion**: When work finishes
- **Overdue Status**: Auto-calculated if delayed

**Dashboard Indicators**:
- On Track
- Near Deadline
- Overdue

### 7. Analytics Dashboard

**Metrics**:
- Total gaps by status (Open, In Progress, Resolved)
- Gap type distribution
- Village-wise breakdown
- Severity analysis
- Resolution rate and average time
- Budget utilization percentage
- Trending issues

**Available Filters**:
- Date range
- Village selection
- Gap type
- Status
- Severity level

---

## � Mobile App

### Setup Instructions

#### 1. Navigate to Mobile App Directory
```bash
cd mobile-app
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Backend URL
Edit `mobile-app/src/config.js`:
```javascript
export const API_BASE_URL = 'http://your-server-ip:8000';
```

#### 4. Start Development Server
```bash
# Windows
START_MOBILE_APP.bat

# macOS/Linux
npx expo start
```

#### 5. Run on Device
- Install **Expo Go** app from Play Store/App Store
- Scan QR code from terminal
- Or press `a` for Android emulator, `i` for iOS simulator

### Features

#### Home Screen
- Quick access to all features
- Sync status indicator
- Pending submissions counter

#### QR Scanner
- Scan government-issued QR codes
- Auto-fill complaint forms
- Offline form saving

#### Photo Upload
- Capture person photos
- GPS location tagging
- Offline storage with batch upload

#### Complaints List
- View submitted complaints
- Offline access
- Status tracking
- Manual sync management

#### Sync Screen
- Manual sync trigger
- Upload progress tracking
- Sync history
- Conflict resolution

### Mobile App Structure
```
mobile-app/
├── App.js                      # Main navigation
├── package.json                # Dependencies
├── app.json                    # Expo configuration
├── babel.config.js             # Babel config
├── assets/                     # Images, icons
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
└── src/
    ├── screens/               # App screens
    │   ├── HomeScreen.js
    │   ├── QRScannerScreen.js
    │   ├── PhotoUploadScreen.js
    │   ├── ComplaintsScreen.js
    │   └── SyncScreen.js
    ├── components/            # Reusable components
    ├── services/              # API services
    ├── utils/                 # Utility functions
    └── config.js              # App configuration
```

---

## 🔌 API Documentation

### Authentication
```http
POST /accounts/login/          # User login
POST /accounts/logout/         # User logout
GET  /post-login/              # Role-based redirect
```

### Gap Management
```http
GET    /dashboard/                      # Main dashboard
GET    /upload/                         # Gap submission form
POST   /upload/                         # Submit new gap
GET    /manage-gaps/                    # Gap management view
POST   /update-gap-status/<gap_id>/    # Update gap status
GET    /analytics/                      # Analytics dashboard
```

### Village Operations
```http
GET    /villages/                       # List all villages
GET    /villages/<village_id>/          # Village details
GET    /villages/<village_id>/report/   # Village report
```

### Workflow & Complaints
```http
GET    /workflow/                                # Workflow dashboard
POST   /workflow/submit/                         # Submit complaint
GET    /workflow/complaint/<complaint_id>/       # Complaint details
POST   /workflow/complaint/<complaint_id>/update/ # Update status
GET    /workflow/agents/                         # Agent dashboard
```

### Voice Verification
```http
GET    /voice-verification/<complaint_id>/       # Voice verification UI
POST   /api/voice/verify/                        # Verify voice sample
POST   /api/voice/close-complaint/               # Close with voice verification
GET    /api/voice/history/<complaint_id>/        # Verification history
POST   /api/voice/check-quality/                 # Check audio quality
GET    /voice-verification/gap/<gap_id>/         # Gap voice verification
POST   /api/voice/verify-gap/                    # Verify gap resolution
```

### QR & Mobile Integration
```http
GET    /qr-submissions/                      # List QR submissions
GET    /qr-submissions/<submission_id>/      # QR submission details
POST   /api/qr/submit/                       # Submit QR data (mobile app)
POST   /api/mobile/sync/                     # Batch sync from mobile
```

### Budget Management
```http
GET    /budget-management/               # Budget overview
POST   /update-budget/<gap_id>/          # Update budget allocation
```

### Public Access
```http
GET    /public-dashboard/                # Public transparency dashboard
GET    /                                 # Landing page
```

---

## 🗄️ Database Models

### Core Models

#### UserProfile
```python
user: OneToOne(User)
role: CharField (ground/manager/authority/admin)
```

#### Village
```python
name: CharField
gaps: ForeignKey(Gap)
```

#### Gap
```python
village: ForeignKey(Village)
description: TextField
gap_type: CharField (11 infrastructure types)
severity: CharField (low/medium/high/urgent)
status: CharField (open/in_progress/resolved)
input_method: CharField (image/voice/text)
audio_file: FileField
voice_code: CharField (voice fingerprint)
recommendations: TextField
created_at: DateTimeField
start_date: DateField
expected_completion: DateField
actual_completion: DateField
budget_allocated: DecimalField
budget_spent: DecimalField
latitude: DecimalField
longitude: DecimalField
```

#### QRSubmission
```python
submission_uuid: UUIDField
qr_code: TextField
person_name: CharField
person_photo: ImageField
phone_number: CharField
village: ForeignKey(Village)
village_name: CharField
latitude: DecimalField
longitude: DecimalField
form_type: CharField
additional_data: JSONField
created_at: DateTimeField
synced_from_mobile: BooleanField
linked_complaint: OneToOne(Complaint)
linked_gap: OneToOne(Gap)
```

### Workflow Models

#### PostOffice
```python
name: CharField
pincode: CharField
district: CharField
state: CharField
postmaster_name: CharField
contact_number: CharField
latitude: DecimalField
longitude: DecimalField
```

#### PMAJAYOffice
```python
name: CharField
district: CharField
state: CharField
officer_name: CharField
contact_number: CharField
email: EmailField
serves_post_offices: ManyToMany(PostOffice)
```

#### Complaint
```python
complaint_id: CharField (unique, e.g., CMP-12345678)
villager_name: CharField
village: ForeignKey(Village)
complaint_text: TextField
complaint_type: CharField
priority: CharField (low/medium/high/urgent)
status: CharField (12 stages)
post_office: ForeignKey(PostOffice)
pmajay_office: ForeignKey(PMAJAYOffice)
assigned_agent: ForeignKey(SurveyAgent)
created_at: DateTimeField
updated_at: DateTimeField
estimated_resolution: DateTimeField
actual_resolution: DateTimeField
villager_satisfaction: CharField
voice_code: CharField
photo: ImageField
audio_file: FileField
latitude: DecimalField
longitude: DecimalField
```

#### SurveyAgent
```python
user: OneToOne(User)
agent_id: CharField
phone_number: CharField
assigned_post_office: ForeignKey(PostOffice)
assigned_villages: ManyToMany(Village)
active: BooleanField
```

#### VoiceVerificationLog
```python
complaint: ForeignKey(Complaint, optional)
gap: ForeignKey(Gap, optional)
audio_file: FileField
similarity_score: FloatField
verification_status: CharField (pending/matched/failed)
verification_message: TextField
verified_by: ForeignKey(User)
timestamp: DateTimeField
```

---

## 🚀 Deployment

### Production Configuration

#### 1. Security Settings
```python
# settings.py
DEBUG = False
SECRET_KEY = os.environ.get('SECRET_KEY')  # Use strong random key
ALLOWED_HOSTS = ['yourdomain.com', 'www.yourdomain.com']
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

#### 2. Database Migration
Migrate from SQLite to PostgreSQL for production:

```bash
pip install psycopg2-binary
```

```python
# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': '5432',
    }
}
```

#### 3. Static Files
```bash
python manage.py collectstatic --noinput
```

#### 4. Cloud Storage
For media files, use AWS S3 or Azure Blob Storage:

```bash
pip install django-storages boto3
```

#### 5. Web Server
Use Gunicorn with Nginx:

```bash
pip install gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

#### 6. Background Tasks
Use Celery for async processing:

```bash
pip install celery redis
```

#### 7. Error Monitoring
Setup error tracking with Sentry:

```bash
pip install sentry-sdk
```

### Production Environment Variables
```env
SECRET_KEY=<strong-random-key>
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://user:pass@host:5432/dbname
GEMINI_API_KEY=<your-key>
EMAIL_HOST_USER=<email>
EMAIL_HOST_PASSWORD=<password>
AWS_ACCESS_KEY_ID=<aws-key>
AWS_SECRET_ACCESS_KEY=<aws-secret>
AWS_STORAGE_BUCKET_NAME=<bucket-name>
SENTRY_DSN=<sentry-url>
```

### Recommended Platforms
- **Heroku**: Simple deployment with Procfile
- **AWS Elastic Beanstalk**: Scalable with load balancing
- **DigitalOcean**: Affordable and straightforward
- **Google Cloud Run**: Serverless containers
- **Azure App Service**: Enterprise hosting

---

## 🐛 Troubleshooting

### Voice Verification Issues

**Problem**: Voice verification fails or shows low similarity

**Solutions**:
- Ensure audio files are clear and at least 3 seconds long
- Check librosa and soundfile are properly installed
- Verify audio format is supported (WAV, MP3, M4A)
- Test audio quality using the quality check endpoint

```bash
# Reinstall audio libraries
pip uninstall librosa soundfile scipy
pip install librosa==0.10.1 soundfile==0.12.1 scipy==1.11.4
```

### AI Analysis Failing

**Problem**: Gap submission fails with AI error

**Solutions**:
- Verify `GEMINI_API_KEY` is correctly set in `.env`
- Check API quota on Google AI Studio
- Test API connection:

```python
import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")
response = model.generate_content("Test connection")
print(response.text)
```

### Mobile App Sync Issues

**Problem**: Offline submissions not uploading

**Solutions**:
- Check backend URL in `mobile-app/src/config.js`
- Verify CORS settings allow mobile app domain
- Ensure network connectivity
- Check mobile app logs in Expo console

```python
# settings.py - Add your mobile app origins
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8081",
    "http://192.168.1.x:8081",  # Replace with your local IP
]
```

### Email Notifications Not Sending

**Problem**: No emails received

**Solutions**:
- Verify `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` in `.env`
- Use Gmail App Password (not regular password)
- Check spam folder
- Enable 2FA and generate app-specific password

### Database Locked Error

**Problem**: SQLite database is locked

**Solutions**:
- SQLite doesn't support concurrent writes well
- For production, migrate to PostgreSQL
- Temporary fix: Restart development server

### Static Files Not Loading

**Problem**: CSS/JS not loading in production

**Solutions**:
```bash
python manage.py collectstatic --noinput
```

Configure static file serving:
```python
# settings.py
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATIC_URL = '/static/'
```

---

## 📝 Utility Commands

### Management Commands

```bash
# Add sample data
python manage.py add_sample_data

# Setup workflow data
python manage.py setup_workflow_data

# Setup all users
python manage.py setup_all_users

# Estimate budgets
python manage.py estimate_budgets

# Flag stale gaps
python manage.py flag_stale_gaps
```

### Utility Scripts

```bash
# Check gaps
python check_gaps.py

# Convert gaps to complaints
python convert_gaps_to_complaints.py

# Test photo upload
python test_photo_upload.py
```

---

## 📄 License

This project is developed for educational and governmental use.

---

## 👨‍💻 Team

**Smart India Hackathon 2025 - Team SETU**

---

## 📞 Support

For issues, questions, or feedback:
- Create an issue in the repository
- Contact the development team

---

## 🎯 Future Roadmap

### Planned Enhancements
- WhatsApp bot integration for notifications
- Predictive analytics for infrastructure trends
- Blockchain audit trail
- Integration with government portals
- Real-time collaboration features
- Advanced reporting and insights
- Multi-language UI (beyond data)
- Mobile app performance optimizations

---

**Built for rural India's development**

*Last Updated: February 2026*
