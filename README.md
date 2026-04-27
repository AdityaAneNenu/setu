# SETU PM-AJAY

SETU PM-AJAY is a full-stack rural service and grievance platform.

It combines:
- A Django web application for dashboards, workflow, and administration
- A REST API for web/mobile clients
- An Expo React Native mobile app for field operations and sync
- AI-assisted media analysis for image/audio complaint support

## Tech Stack

### Backend
- Python 3.11.11
- Django 4.2.27
- Django REST Framework
- django-unfold (admin UI)
- WhiteNoise + Gunicorn
- SQLite (default local) or PostgreSQL via `DATABASE_URL`
- Firebase Admin SDK

### AI and Media
- Google Generative AI (`google-generativeai`)
- AssemblyAI
- Pillow, NumPy, OpenCV

### Mobile
- Expo SDK 54
- React Native 0.81.5
- React Navigation 7
- Firebase JS SDK

## Repository Structure

- `config/`: Django project configuration (`settings.py`, `urls.py`, `wsgi.py`)
- `core/`: Main app (models, views, API views, templates, tests, commands)
- `core/management/commands/`: Operational and data bootstrap commands
- `core/tests/`: Backend tests
- `mobile-app/`: Expo React Native app
- `docs/`: Project documentation
- `media/`, `staticfiles/`, `logs/`: Runtime/generated artifacts

## Domain Model (Core)

Main entities in `core/models.py` include:
- `Village`
- `Gap` and `GapStatusAuditLog`
- `Complaint` and `WorkflowLog`
- `PostOffice`, `PMAJAYOffice`, `SurveyAgent`, `SurveyVisit`, `Worker`
- `QRSubmission` and `QRComplaintDetail`
- `UserProfile`

## Key Web Routes

From `core/urls.py`:
- `/`
- `/dashboard/`
- `/upload/`
- `/analytics/`
- `/manage-gaps/`
- `/villages/`
- `/public-dashboard/`
- `/workflow/`
- `/workflow/complaint/<complaint_id>/`
- `/workflow/agents/`

System endpoints from `config/urls.py`:
- `/health/`
- `/ready/`

## Key API Routes

From `core/api_urls.py`:

### Auth
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `GET /api/auth/profile/`

### Dashboard and analytics
- `GET /api/dashboard/`
- `GET /api/analytics/`
- `GET /api/public-dashboard/`

### Gaps
- `GET /api/gaps/`
- `GET /api/gaps/<gap_id>/`
- `POST /api/gaps/upload/`
- `POST /api/gaps/<gap_id>/status/`
- `POST /api/gaps/<gap_id>/close-with-proof/`

### Mobile sync and complaints
- `POST /api/mobile/gaps/sync/`
- `POST /api/mobile/gaps/<firestore_id>/status/`
- `GET /api/mobile/gaps/`
- `POST /api/mobile/gaps/<gap_id>/resolve/`
- `POST /api/mobile/complaints/submit/`
- `GET /api/mobile/complaints/in-progress/`
- `POST /api/mobile/complaints/<complaint_id>/verify-close/`
- `POST /api/mobile/complaints/<complaint_id>/resolve-photo/`

### Workflow and AI
- `GET /api/workflow/complaints/`
- `GET /api/workflow/stats/`
- `GET /api/workflow/agents/`
- `POST /api/analyze-media/`

### Utility
- `GET /api/test/`

## Local Backend Setup

### 1. Prerequisites
- Python 3.10+ (3.11 recommended)
- pip

### 2. Create and activate virtual environment

Windows PowerShell:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Windows CMD:
```cmd
python -m venv .venv
.venv\Scripts\activate.bat
```

macOS/Linux:
```bash
python -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment variables
Create `.env` in project root.

Recommended values:
- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `DATABASE_URL` (optional locally)
- `RAILWAY_PUBLIC_DOMAIN` (deployment)
- `FIREBASE_CREDENTIALS_PATH` or `FIREBASE_CREDENTIALS_JSON`
- `GEMINI_API_KEY` (optional, AI features)
- `ASSEMBLYAI_API_KEY` (optional, AI features)

### 5. Run migrations and checks
```bash
python manage.py migrate
python manage.py check
```

### 6. Optional bootstrap commands
```bash
python manage.py setup_all_users
python manage.py setup_workflow_data
python manage.py load_local_data
```

### 7. Start development server
```bash
python manage.py runserver
```

Default URL: `http://127.0.0.1:8000/`

## Mobile App Setup

```bash
cd mobile-app
npm install
npm run start
```

Optional:
```bash
npm run android
npm run ios
npm run web
```

Mobile backend URL selection is defined in `mobile-app/src/config/api.js`.

## Testing

Run all backend tests:
```bash
python manage.py test
```

Run targeted suites:
```bash
python manage.py test core.tests.test_complaint_verification_flows
python manage.py test core.tests.test_firebase_init core.tests.test_firebase_sync_privacy
python manage.py test core.tests.test_analyze_media core.tests.test_speech_to_text_service
python manage.py test core.tests.test_mobile_gap_resolve_verification
python manage.py test core.tests.test_sms_webhook_security
```

## Deployment (Railway)

Deployment-related files:
- `Procfile`
- `runtime.txt`
- `nixpacks.toml`
- `RAILWAY_DEPLOY.md`
- `DEPLOYMENT.md`

Current web process in `Procfile`:
```bash
python manage.py migrate --noinput && python manage.py setup_all_users && python manage.py collectstatic --noinput && gunicorn config.wsgi --bind 0.0.0.0:$PORT
```

Nixpacks setup includes audio dependencies (`libsndfile1-dev`, `ffmpeg`) for speech/media workflows.

## Additional Documentation

- `ROLES.md`: Role-based access model
- `AI_SETUP_GUIDE.md`: AI keys and media analysis setup
- `READY_FOR_RAILWAY.md`: Deployment readiness notes
- `docs/UI_ENHANCEMENT_GUIDE.md`: UI system and styling documentation
- `mobile-app/README.md`: Mobile-app specific guidance

## Notes

- This README was rebuilt from current code and config files to replace a corrupted version.
- If endpoints, startup commands, or env vars change, update this README in the same PR.
