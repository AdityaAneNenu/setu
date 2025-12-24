# SETU: Smart Evaluation and Tracking Utility for Village Development 🎯

> **Smart Evaluation and Tracking Utility**  
> A comprehensive rural infrastructure gap tracking, complaint resolution, and biometric voice verification platform for village development.

---

## 📋 Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [User Roles & Credentials](#user-roles--credentials)
- [API Endpoints](#api-endpoints)
- [Mobile App](#mobile-app)
- [Features Documentation](#features-documentation)
- [Database Models](#database-models)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🌟 Overview

SETU is an integrated system designed to track and resolve rural infrastructure gaps across India. The platform combines AI-powered analysis, voice biometric verification, mobile app integration, and SMS-based updates to create a comprehensive solution for rural development monitoring.

### Problem Statement
Rural areas face multiple infrastructure gaps (water, roads, sanitation, electricity, etc.) but lack efficient tracking and resolution mechanisms. Traditional complaint systems are slow, prone to fraud, and don't provide real-time visibility to stakeholders.

### Solution
SETU provides:
- **Multi-modal Gap Submission**: Image, voice, text, and mobile app submissions
- **AI-Powered Analysis**: Automatic categorization and severity assessment using Google Gemini AI
- **Voice Biometric Verification**: Prevents fraudulent closures using voice fingerprinting
- **Offline-First Mobile App**: QR-based complaint submission with photo verification
- **SMS Integration**: Simple SMS commands for updates (no internet needed)
- **Role-Based Dashboards**: Customized views for ground workers, managers, and authorities
- **Real-Time Analytics**: Visual dashboards with gap statistics and progress tracking
- **Budget Management**: Track allocated and spent budgets per project
- **Post Office Network Integration**: Leverages India's postal network for last-mile connectivity

---

## 🚀 Key Features

### 1. **Multi-Modal Gap Submission System**
- **Image Upload**: Upload infrastructure gap photos with AI analysis
- **Voice Recording**: Record complaints in regional languages (Hindi, English, Tamil, Telugu, Bengali, Marathi)
- **Text Input**: Manual gap entry with detailed descriptions
- **Mobile App**: Offline QR-based submissions with photo verification

### 2. **AI-Powered Gap Analysis**
- Automatic categorization into 11 gap types:
  - Water Supply
  - Road Infrastructure
  - Sanitation
  - Electricity
  - Education
  - Healthcare
  - Agriculture
  - Welfare Programs
  - Connectivity
  - Load Transport
  - Livelihood & Skills
- Severity assessment (Low, Medium, High, Urgent)
- AI-generated recommendations for resolution
- Multi-language support with automatic translation

### 3. **Voice Biometric Verification** 🎤
- Voice fingerprint capture during complaint submission
- Biometric matching for complaint resolution verification
- Prevents fraudulent closures
- Uses librosa and scikit-learn for audio feature extraction
- Similarity score calculation (threshold: 70%)
- Voice verification history tracking

### 4. **Workflow Management**
- **Post Office Network**: Complaints received at local post offices
- **Regional Coordination Offices**: Regional coordination centers
- **Survey Agents**: Field workers for gap inspection
- **SMS Status Updates**: Simple commands (START, PROGRESS, DONE, CHECKED, SATISFIED)
- **Email Notifications**: Automatic updates to stakeholders
- **Timeline Tracking**: Start date, expected completion, actual completion
- **Status Progression**: 12-stage workflow from receipt to closure

### 5. **Mobile Application** 📱
- React Native/Expo-based cross-platform app
- Offline-first architecture with local storage
- QR code scanning for form-based data collection
- Camera integration for person photos
- GPS location capture
- Background sync when internet available
- Batch upload support

### 6. **Analytics & Reporting** 📊
- Real-time dashboard with gap statistics
- Village-wise breakdown
- Gap type distribution charts
- Status tracking (Open, In Progress, Resolved)
- Budget utilization reports
- Geolocation mapping
- Public transparency dashboard

### 7. **Role-Based Access Control**
- **Admin**: Full system access, user management
- **Authority**: View all gaps, approve budgets, escalation handling
- **Manager**: Assign tasks, track progress, update budgets
- **Ground**: Submit gaps, update status, field operations

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Web UI (Django Templates)  │  Mobile App (React Native)   │
│  - Role-based dashboards     │  - QR Scanner                │
│  - Gap submission forms      │  - Photo Upload              │
│  - Analytics views           │  - Offline Storage           │
│  - Voice verification UI     │  - Background Sync           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Layer (Django)                    │
├─────────────────────────────────────────────────────────────┤
│  - REST API (DRF)           │  - Voice Verification Engine │
│  - Authentication           │  - Audio Feature Extraction   │
│  - Business Logic           │  - Similarity Calculation     │
│  - File Upload Handling     │  - librosa + scikit-learn     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI/ML Services                           │
├─────────────────────────────────────────────────────────────┤
│  Google Gemini 2.5 Flash    │  Audio Processing (librosa)  │
│  - Image Analysis           │  - MFCC Extraction            │
│  - Text Translation         │  - Spectral Features          │
│  - Gap Categorization       │  - Voice Fingerprinting       │
│  - Recommendation Gen       │  - Cosine Similarity          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer (SQLite)                       │
├─────────────────────────────────────────────────────────────┤
│  - User Profiles            │  - QR Submissions             │
│  - Villages                 │  - Voice Verification Logs    │
│  - Gaps & Complaints        │  - SMS Updates                │
│  - Post Offices & Agents    │  - Budget Tracking            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Integrations                      │
├─────────────────────────────────────────────────────────────┤
│  SMS Gateway (Twilio)       │  Email (SMTP)                 │
│  Maps API (Google Maps)     │  Cloud Storage (Optional)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Framework**: Django 4.2.27
- **API**: Django REST Framework 3.14.0
- **Database**: SQLite (Development), PostgreSQL (Production)
- **Authentication**: Django Auth with role-based permissions

### AI & ML
- **LLM**: Google Gemini 2.5 Flash Lite (`gemini-2.5-flash-lite`)
- **Audio Processing**: 
  - librosa 0.10.1
  - scipy 1.11.4
  - scikit-learn 1.3.2
  - soundfile 0.12.1
- **Speech Recognition**: AssemblyAI 0.48.1

### Frontend
- **Web**: Django Templates, HTML5, CSS3, JavaScript
- **Mobile**: React Native + Expo SDK 54
- **Styling**: Bootstrap 5, Custom CSS

### Infrastructure
- **Web Server**: Django Development Server (Gunicorn for production)
- **File Storage**: Local filesystem (S3 for production)
- **CORS**: django-cors-headers 4.3.1
- **Environment**: python-dotenv 1.0.0

### External APIs
- **AI**: Google Gemini API
- **Speech**: AssemblyAI
- **SMS**: Twilio (optional)
- **Email**: SMTP (Gmail)

---

## 📦 Prerequisites

### System Requirements
- **Python**: 3.8 or higher
- **Node.js**: 16.x or higher (for mobile app)
- **npm**: 8.x or higher
- **Git**: Latest version
- **OS**: Windows 10/11, macOS 11+, or Linux

### API Keys Required
1. **Google Gemini API Key** - For AI analysis
   - Get from: https://makersuite.google.com/app/apikey
2. **Gmail App Password** - For email notifications
   - Enable 2FA: https://myaccount.google.com/security
   - Generate App Password: https://myaccount.google.com/apppasswords
3. **AssemblyAI API Key** (Optional) - For advanced speech recognition
   - Get from: https://www.assemblyai.com/

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd pm_ajay_ai0
```

### 2. Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 4. Create Environment File
Create a `.env` file in the project root:
```env
# Django Configuration
SECRET_KEY=django-insecure-your-secret-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here

# Email Configuration (Gmail)
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password

# AssemblyAI (Optional)
ASSEMBLYAI_API_KEY=your-assemblyai-key-here

# Database (Optional - defaults to SQLite)
DATABASE_URL=sqlite:///db.sqlite3
```

### 5. Initialize Database
```bash
# Run migrations
python manage.py migrate

# Create test users and sample data
python manage.py shell < setup_users.py
```

### 6. Create Media Directories
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

### 7. Configure Firewall (Windows)
```powershell
# Run as Administrator
.\allow_django_firewall.ps1
```

### 8. Start Development Server
```bash
python manage.py runserver 0.0.0.0:8000
```

Access the application at: **http://localhost:8000**

---

## 👥 User Roles & Credentials

### Default Test Users

| Role | Username | Password | Access Level |
|------|----------|----------|--------------|
| **Admin** | `admin` | `Admin@123` | Full system access, user management |
| **Authority** | `authority` | `Authority@123` | View all gaps, approve budgets |
| **Manager** | `manager` | `Manager@123` | Assign tasks, track progress |
| **Ground** | `ground` | `Ground@123` | Submit gaps, update status |

### Role Capabilities

#### 🔴 Admin
- Create/delete users
- Manage all system settings
- Access Django admin panel
- Override any action
- View system logs

#### 🟠 Highest Authority
- View all gaps across all villages
- Approve/reject budget allocations
- Escalate critical issues
- Generate comprehensive reports
- Access analytics dashboard

#### 🟡 Manager
- Assign gaps to field workers
- Update gap status
- Manage budgets (allocate, track spending)
- View assigned village data
- Monitor progress timelines

#### 🟢 Ground Level
- Submit new gaps (image/voice/text)
- Upload photos and audio recordings
- Update assigned gap status
- Report completion
- View assigned tasks

---

## 🔌 API Endpoints

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
GET    /villages/<village_id>/report/   # Generate village report
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
POST   /api/voice/verify-gap/                    # Verify gap resolution with voice
```

### QR & Mobile Integration
```http
GET    /qr-submissions/                      # List QR submissions
GET    /qr-submissions/<submission_id>/      # QR submission details
POST   /api/qr/submit/                       # Submit QR data (mobile app)
POST   /api/mobile/sync/                     # Batch sync from mobile
```

### SMS Integration
```http
GET    /api/complaint/<complaint_id>/status/  # Get status via SMS
POST   /api/sms-update/                       # Update via SMS command
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

## 📱 Mobile App

### Setup Instructions

1. **Navigate to mobile app directory**:
```bash
cd mobile-app
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure backend URL**:
Edit `mobile-app/src/config.js`:
```javascript
export const API_BASE_URL = 'http://your-server-ip:8000';
```

4. **Start Expo development server**:
```bash
# Windows
START_MOBILE_APP.bat

# macOS/Linux
npx expo start
```

5. **Run on device**:
   - Install **Expo Go** app from Play Store/App Store
   - Scan QR code from terminal
   - Or press `a` for Android emulator, `i` for iOS simulator

### Mobile App Features

#### Home Screen
- Quick access to all features
- Sync status indicator
- Pending submissions counter

#### QR Scanner
- Scan government QR codes
- Auto-fill complaint forms
- Offline form saving

#### Photo Upload
- Capture person photo
- GPS location tagging
- Offline storage
- Batch upload

#### Complaints List
- View submitted complaints
- Offline access
- Status tracking
- Sync management

#### Sync Screen
- Manual sync trigger
- Upload progress
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

## 📚 Features Documentation

### 1. Image-Based Gap Submission

**Process Flow**:
1. Ground worker uploads infrastructure gap photo
2. AI analyzes image using Google Gemini Vision
3. System extracts:
   - Gap type (water, road, etc.)
   - Severity level
   - Detailed description
   - Recommendations
4. Gap saved to database
5. Notification sent to manager

**Supported Image Formats**: JPG, PNG, WEBP, HEIC  
**Max File Size**: 10 MB

### 2. Voice-Based Gap Submission

**Process Flow**:
1. Worker records complaint in regional language
2. Audio transcribed using AssemblyAI
3. Text translated to English
4. AI categorizes and analyzes
5. Voice fingerprint extracted and saved
6. Gap created with voice code

**Supported Languages**:
- Hindi (hi)
- English (en)
- Tamil (ta)
- Telugu (te)
- Bengali (bn)
- Marathi (mr)

**Audio Requirements**:
- Format: WAV, MP3, M4A
- Duration: 5 seconds - 5 minutes
- Quality: Clear speech, minimal background noise

### 3. Voice Biometric Verification

**How It Works**:
1. During complaint submission, voice sample captured
2. Audio features extracted using librosa:
   - MFCCs (Mel-frequency cepstral coefficients)
   - Spectral centroid
   - Zero crossing rate
   - Chroma features
3. Features normalized and stored as "voice code"
4. During resolution, new voice sample collected
5. Features compared using cosine similarity
6. If similarity > 70%, verification passes
7. Resolution allowed only with voice match

**Security Benefits**:
- Prevents fake closures
- Ensures villager confirmation
- Creates audit trail
- Reduces corruption

**Voice Verification Log**:
```python
VoiceVerificationLog:
  - complaint
  - audio_file
  - similarity_score
  - verification_status (pending/matched/failed)
  - verification_message
  - timestamp
```

### 4. QR-Based Offline Submissions

**Use Case**: Areas with no internet connectivity

**Process**:
1. Government issues QR codes to villages
2. Mobile app scans QR code
3. Pre-filled form appears
4. Worker captures person photo
5. GPS location tagged automatically
6. Data saved locally on phone
7. When internet available, auto-sync to server
8. Server converts to formal complaint

**QR Data Format**:
```json
{
  "village_id": "123",
  "village_name": "Rampur",
  "district": "Gorakhpur",
  "state": "Uttar Pradesh",
  "form_type": "complaint"
}
```

### 5. SMS-Based Updates

**Commands**:
- `PM[ID] START` - Work started
- `PM[ID] PROGRESS` - Work in progress
- `PM[ID] DONE` - Work completed
- `PM[ID] CHECKED` - Villager checked work
- `PM[ID] SATISFIED` - Villager satisfied
- `PM[ID] UNSATISFIED` - Villager not satisfied
- `PM[ID] PROBLEM [text]` - Report issue

**Example**:
```
SMS: PM123 DONE
Auto-Reply: Gap PM123 marked as complete. Awaiting villager verification.
```

### 6. Budget Management

**Features**:
- Allocate budget per gap
- Track spending in real-time
- Calculate remaining budget
- Generate utilization reports
- Flag overbudget projects

**Budget Fields**:
```python
Gap:
  - budget_allocated (Decimal)
  - budget_spent (Decimal)
  - budget_remaining (Calculated Property)
```

**Manager Actions**:
- Set initial budget allocation
- Update spent amount as work progresses
- Approve additional budget requests
- Generate expenditure reports

### 7. Timeline Tracking

**Milestones**:
- **Start Date**: When work begins
- **Expected Completion**: Target deadline
- **Actual Completion**: When work finishes
- **Overdue Flag**: Auto-calculated if delayed

**Dashboard Indicators**:
- 🟢 On Track
- 🟡 Near Deadline
- 🔴 Overdue

### 8. Analytics Dashboard

**Metrics Displayed**:
- Total gaps by status (Open, In Progress, Resolved)
- Gap type distribution (pie chart)
- Village-wise breakdown
- Severity analysis
- Resolution rate
- Average resolution time
- Budget utilization percentage
- Most common gap types
- Trending issues

**Filters Available**:
- Date range
- Village selection
- Gap type
- Status
- Severity level

---

## 🗄️ Database Models

### Core Models

#### UserProfile
```python
- user: OneToOne(User)
- role: CharField (ground/manager/authority/admin)
```

#### Village
```python
- name: CharField
- gaps: ForeignKey(Gap)
```

#### Gap
```python
- village: ForeignKey(Village)
- description: TextField
- gap_type: CharField (11 types)
- severity: CharField (low/medium/high/urgent)
- status: CharField (open/in_progress/resolved)
- input_method: CharField (image/voice/text)
- audio_file: FileField (optional)
- voice_code: CharField (voice fingerprint)
- recommendations: TextField
- created_at: DateTimeField
- start_date: DateField
- expected_completion: DateField
- actual_completion: DateField
- budget_allocated: DecimalField
- budget_spent: DecimalField
- latitude: DecimalField
- longitude: DecimalField
```

#### QRSubmission
```python
- submission_uuid: UUIDField
- qr_code: TextField
- person_name: CharField
- person_photo: ImageField
- phone_number: CharField
- village: ForeignKey(Village)
- village_name: CharField
- latitude: DecimalField
- longitude: DecimalField
- form_type: CharField
- additional_data: JSONField
- created_at: DateTimeField
- synced_from_mobile: BooleanField
- linked_complaint: OneToOne(Complaint)
- linked_gap: OneToOne(Gap)
```

### Workflow Models

#### PostOffice
```python
- name: CharField
- pincode: CharField
- district: CharField
- state: CharField
- postmaster_name: CharField
- contact_number: CharField
- latitude: DecimalField
- longitude: DecimalField
```

#### PMAJAYOffice
```python
- name: CharField
- district: CharField
- state: CharField
- officer_name: CharField
- contact_number: CharField
- email: EmailField
- serves_post_offices: ManyToMany(PostOffice)
```

#### Complaint
```python
- complaint_id: CharField (unique, e.g., CMP-12345678)
- villager_name: CharField
- village: ForeignKey(Village)
- complaint_text: TextField
- complaint_type: CharField
- priority: CharField (low/medium/high/urgent)
- status: CharField (12 stages)
- post_office: ForeignKey(PostOffice)
- pmajay_office: ForeignKey(PMAJAYOffice)
- assigned_agent: ForeignKey(SurveyAgent)
- created_at: DateTimeField
- updated_at: DateTimeField
- estimated_resolution: DateTimeField
- actual_resolution: DateTimeField
- villager_satisfaction: CharField
- voice_code: CharField
- photo: ImageField
- audio_file: FileField
- latitude: DecimalField
- longitude: DecimalField
```

#### SurveyAgent
```python
- user: OneToOne(User)
- agent_id: CharField
- phone_number: CharField
- assigned_post_office: ForeignKey(PostOffice)
- assigned_villages: ManyToMany(Village)
- active: BooleanField
```

#### VoiceVerificationLog
```python
- complaint: ForeignKey(Complaint)
- gap: ForeignKey(Gap, optional)
- audio_file: FileField
- similarity_score: FloatField
- verification_status: CharField (pending/matched/failed)
- verification_message: TextField
- verified_by: ForeignKey(User)
- timestamp: DateTimeField
```

#### SMSStatusUpdate
```python
- gap: ForeignKey(Gap)
- sender_phone: CharField
- sms_command: CharField (START/PROGRESS/DONE/etc.)
- raw_sms_text: TextField
- timestamp: DateTimeField
- response_sent: TextField
- response_sent_at: DateTimeField
```

---

## 🚀 Deployment

### Production Checklist

1. **Security**:
```python
# settings.py
DEBUG = False
SECRET_KEY = os.environ.get('SECRET_KEY')
ALLOWED_HOSTS = ['yourdomain.com', 'www.yourdomain.com']
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

2. **Database**: Migrate to PostgreSQL
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

3. **Static Files**:
```bash
python manage.py collectstatic
```

4. **Media Files**: Use cloud storage (AWS S3/Azure Blob)
```bash
pip install django-storages boto3
```

5. **Web Server**: Use Gunicorn + Nginx
```bash
pip install gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

6. **Background Tasks**: Use Celery for async processing
```bash
pip install celery redis
```

7. **Monitoring**: Setup error tracking (Sentry)
```bash
pip install sentry-sdk
```

### Environment Variables for Production
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

### Deployment Platforms
- **Heroku**: Easy deployment with Procfile
- **AWS Elastic Beanstalk**: Scalable with load balancing
- **DigitalOcean App Platform**: Simple and affordable
- **Google Cloud Run**: Serverless containers
- **Azure App Service**: Enterprise-grade hosting

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Voice Verification Not Working
**Symptoms**: Voice verification fails or shows low similarity

**Solutions**:
- Ensure audio files are clear and at least 3 seconds long
- Check that librosa and soundfile are installed correctly
- Verify audio format is supported (WAV, MP3, M4A)
- Test audio quality using `/api/voice/check-quality/`

```bash
# Reinstall audio libraries
pip uninstall librosa soundfile scipy
pip install librosa==0.10.1 soundfile==0.12.1 scipy==1.11.4
```

#### 2. AI Analysis Failing
**Symptoms**: Gap submission fails with AI error

**Solutions**:
- Verify GEMINI_API_KEY is set correctly in `.env`
- Check API quota on Google AI Studio
- Test API connection:
```python
import google.generativeai as genai
import os
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash-lite")
response = model.generate_content("Test")
print(response.text)
```

#### 3. Mobile App Not Syncing
**Symptoms**: Offline submissions not uploading

**Solutions**:
- Check backend URL in `mobile-app/src/config.js`
- Verify CORS settings allow mobile app domain
- Ensure network connectivity
- Check mobile app logs in Expo

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8081",
    "http://192.168.1.x:8081",  # Your local IP
]
```

#### 4. Email Notifications Not Sending
**Symptoms**: No emails received

**Solutions**:
- Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in `.env`
- Use Gmail App Password (not regular password)
- Check spam folder
- Enable "Less secure app access" (not recommended) or use OAuth2

#### 5. Database Locked Error
**Symptoms**: SQLite database is locked

**Solutions**:
- SQLite doesn't support concurrent writes well
- For production, migrate to PostgreSQL
- Temporary fix: Restart development server

#### 6. Static Files Not Loading
**Symptoms**: CSS/JS not loading in production

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

## 📝 Utility Scripts

### 1. Check Gaps
```bash
python check_gaps.py
```
Displays all gaps in database with details.

### 2. Convert Gaps to Complaints
```bash
python convert_gaps_to_complaints.py
```
Migrates old gaps to new complaint workflow.

### 3. Test Photo Upload
```bash
python test_photo_upload.py
```
Tests image upload and AI analysis.

### 4. Setup Users
```bash
python manage.py shell < setup_users.py
```
Creates default test users and sample villages.

### 5. Allow Django Firewall (Windows)
```powershell
.\allow_django_firewall.ps1
```
Configures Windows Firewall to allow Django server.

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create feature branch**:
```bash
git checkout -b feature/your-feature-name
```

3. **Make changes and commit**:
```bash
git add .
git commit -m "Add: your feature description"
```

4. **Push to your fork**:
```bash
git push origin feature/your-feature-name
```

5. **Create Pull Request**

### Code Standards
- Follow PEP 8 for Python code
- Use meaningful variable names
- Add docstrings to functions
- Write unit tests for new features
- Update README if adding features

### Commit Message Format
```
Type: Brief description

Detailed explanation (if needed)

Types: Add, Update, Fix, Remove, Refactor, Docs, Test
```

Examples:
- `Add: Voice verification for gap resolution`
- `Fix: Audio quality check threshold`
- `Update: Mobile app sync logic`

---

## 📄 License

This project is developed for **Smart India Hackathm 2025** and is intended for educational and governmental use.

---

## 👨‍💻 Development Team

**Smart India Hackathon 2025 - Team SETU**

---

## 📞 Support

For issues, questions, or contributions:
- **Email**: support@setu.gov.in
- **GitHub Issues**: [Report Bug](https://github.com/your-repo/issues)
- **Documentation**: [Wiki](https://github.com/your-repo/wiki)

---

## 🎯 Roadmap

### Phase 1 (Completed) ✅
- Multi-modal gap submission
- AI-powered analysis
- Voice biometric verification
- Mobile app with offline support
- Basic workflow management

### Phase 2 (In Progress) 🚧
- SMS gateway integration
- Advanced analytics dashboard
- Budget tracking system
- Multi-language UI
- Mobile app enhancements

### Phase 3 (Planned) 📋
- WhatsApp bot integration
- Predictive analytics for gap trends
- Blockchain for audit trail
- Integration with government portals
- Real-time collaboration features
- Advanced reporting and insights

---

## 🙏 Acknowledgments

- **Google Gemini AI**: For powerful multimodal AI capabilities
- **AssemblyAI**: For accurate speech-to-text transcription
- **Django Community**: For excellent framework and documentation
- **Expo/React Native**: For cross-platform mobile development
- **librosa**: For audio feature extraction
- **Indian Postal Service**: For inspiring the workflow model

---

## 📊 Project Statistics

- **Total Lines of Code**: ~15,000+
- **API Endpoints**: 40+
- **Database Models**: 15+
- **Supported Languages**: 6
- **Gap Categories**: 11
- **User Roles**: 4
- **Mobile App Screens**: 5
- **Workflow Stages**: 12

---

**Built with ❤️ for rural India's development**

*Last Updated: December 9, 2025*
