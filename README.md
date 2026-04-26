<<<<<<< HEAD
# SETU

SETU is a Django-based rural infrastructure gap management platform. It supports mobile submissions, AI-assisted media analysis, workflow tracking, and closure verification using geo-tagged photos and user selfies.

## What The System Does

- Tracks rural infrastructure gaps from submission through closure.
- Supports admin, manager, and field workflows.
- Accepts image-based submissions and processes them through the backend AI analysis pipeline.
- Verifies gap closure with geo-tagged photo proof and optional selfie matching.
- Syncs data to Firebase/Firestore for mobile usage and auditability.
- Provides web dashboards for gap management, workflow review, and analytics.

## Current Architecture

### Backend

- Django 4.2.27
- Django REST Framework 3.14.0
- SQLite for local development
- Firestore synchronization for mobile and reporting flows

### Verification Model

- Gap closure is based on photo proof and GPS metadata.
- Complaint closure uses one of two verified paths:
- `resolution_letter` for written/photo complaints that include a complaint document image.
- `selfie_gps` for direct/audio complaints, which now require the original complaintee photo and submission GPS plus a closure-time selfie and closure GPS.
- Legacy voice verification has been removed from the active system.

### Mobile And Web Flows

- Web users manage gaps, review complaints, and approve closures.
- Mobile users submit complaints and resolve items through the sync endpoints.
- AI analysis runs on submitted media through the media analysis API.

## Key Routes

### Web

- `/` home
- `/dashboard/` dashboard
- `/manage-gaps/` gap administration
- `/workflow/` workflow dashboard
- `/workflow/complaint/<complaint_id>/` complaint details
- `/workflow/complaint/<complaint_id>/verify-close/` selfie verification and closure
- `/workflow/complaint/<complaint_id>/resolve-photo/` photo-based resolution flow

### API

- `/api/auth/login/`
- `/api/dashboard/`
- `/api/analytics/`
- `/api/gaps/`
- `/api/gaps/<gap_id>/status/`
- `/api/gaps/<gap_id>/close-with-proof/`
- `/api/mobile/gaps/sync/`
- `/api/mobile/complaints/submit/`
- `/api/mobile/complaints/in-progress/`
- `/api/mobile/complaints/<complaint_id>/verify-close/`
- `/api/mobile/complaints/<complaint_id>/resolve-photo/`
- `/api/analyze-media/`

## Data And Fixture Policy

- `core/fixtures/local_data.json` is intentionally empty to avoid loading stale test data.
- The local data loader skips deprecated models and removes removed legacy fields.
- Use `python manage.py load_local_data` only when you explicitly want cleaned fixture data loaded.
- Use `python manage.py load_local_data --with-media-bundle` if you also want the bundled media copied into `MEDIA_ROOT`.

## Setup

### Prerequisites

- Python 3.8 or newer
- Node.js 16+ for the mobile app
- Git

### Install
=======
﻿# SETU

SETU is a rural infrastructure and complaint lifecycle platform with a Django backend and an Expo React Native mobile app.

It supports:
- Gap reporting and lifecycle tracking (open -> in progress -> resolved)
- Complaint workflow management for post office and PM-AJAY operations
- Mobile-first sync between Firestore and Django APIs
- Geo-tagged closure proof for gaps
- Complaint closure verification using submission-time complaintee photo + GPS
- AI-assisted media analysis for image/audio submissions

## Tech Stack

Backend:
- Django 4.2
- Django REST Framework
- SQLite (default local), PostgreSQL via DATABASE_URL (production)
- Firebase Admin SDK for auth + Firestore sync
- Gemini + AssemblyAI integrations for AI/media processing

Mobile:
- Expo + React Native
- Firebase Auth + Firestore
- Camera, location, and media upload flows

## Repository Structure

- config/: Django project configuration (settings, root URLs, WSGI/ASGI)
- core/: Main app (models, views, workflow, APIs, templates, tests)
- core/api_urls.py: REST API routes used by web/mobile
- core/urls.py: Web routes and workflow pages
- mobile-app/: Expo React Native app
- locale/: Django translation files
- docs/: Project documentation (if present)

## Key Domain Flows

### 1. Gap Flow
- Gaps can be submitted from web or mobile.
- Mobile stores first in Firestore and then syncs to Django via /api/mobile/gaps/sync/.
- Gap status updates can sync to Django and are tracked with GapStatusAuditLog.
- Closing a gap with proof uses:
  - POST /api/gaps/<gap_id>/close-with-proof/
  - Required: closure photo URL + closure GPS
  - Optional: closure selfie URL
  - Distance validation checks closure GPS against original gap GPS.

### 2. Mobile Gap Flow
- Mobile app uses Gap as the only source of truth.
- Mobile gap list endpoint returns grouped buckets:
  - GET /api/mobile/gaps/
  - Response keys: open, in_progress, resolved
- Mobile gap resolve endpoint:
  - POST /api/mobile/gaps/<gap_id>/resolve/

### 3. AI Media Analysis
- Unified endpoint: POST /api/analyze-media/
- Supports image/audio analysis and returns structured suggestion fields.

## Local Backend Setup

Prerequisites:
- Python 3.10+ (project currently works with newer versions too)
- pip

Create environment:

```bash
python -m venv .venv
```

Activate:
- Windows PowerShell: .venv\Scripts\Activate.ps1
- Windows CMD: .venv\Scripts\activate.bat
- macOS/Linux: source .venv/bin/activate

Install dependencies:
>>>>>>> 6a0a424 (Many changes in verification modules.)

```bash
python -m venv .venv
pip install -r requirements.txt
<<<<<<< HEAD
=======
```

Run migrations and checks:

```bash
>>>>>>> 6a0a424 (Many changes in verification modules.)
python manage.py migrate
python manage.py check
```

<<<<<<< HEAD
Activate the virtual environment before installing packages:

- Windows PowerShell: `.venv\Scripts\Activate.ps1`
- Windows CMD: `.venv\Scripts\activate.bat`
- macOS/Linux: `source .venv/bin/activate`

### Environment

Create a `.env` file with the project secrets and API keys required by your deployment. At minimum, configure:

- Django settings and secret key
- `GEMINI_API_KEY`
- Firebase admin credentials (`FIREBASE_CREDENTIALS_JSON` or `FIREBASE_CREDENTIALS_PATH`)
- Any email or cloud storage credentials used by your deployment

For the mobile app, make sure the Expo config points at the correct backend URL through `PRODUCTION_API_URL`. The complaint verification and geotagged closure flows depend on that URL matching the Django server that owns the synced records.

### Run The Server

```bash
python manage.py runserver
```

## Validation

- `python manage.py check`
- `python manage.py test`
- Focused backend coverage exists for Firestore sync, media analysis, complaint submission, and complaint closure verification flows

## Project Layout

- `config/` Django project settings and root URL routing
- `core/` main application code, templates, models, APIs, workflow views, and tests
- `core/fixtures/` local fixture data and media bundle assets
- `mobile-app/` React Native application
- `docs/` supporting documentation

## Deployment Notes

- The repository includes Railway deployment guidance and helper scripts.
- `manage.py check` currently passes cleanly.
- Legacy voice-specific documentation and test data should not be used for current deployments.
=======
Start server:

```bash
python manage.py runserver
```

Backend base URL (local):
- http://127.0.0.1:8000/

## Environment Variables

Create a .env file in repository root.

Important variables used by the backend:
- SECRET_KEY
- DEBUG
- DATABASE_URL (for PostgreSQL production)
- GEMINI_API_KEY
- ASSEMBLYAI_API_KEY
- FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH
- EMAIL_* settings (if email notifications are used)

Optional deployment-related variables may also be used in settings.

## Mobile App Setup

Prerequisites:
- Node.js 18+
- npm
- Expo tooling (via npx)

Install mobile dependencies:

```bash
cd mobile-app
npm install
```

Run mobile app:

```bash
npm run start
```

Platform shortcuts:

```bash
npm run android
npm run ios
npm run web
```

API configuration is controlled in mobile-app/src/config/api.js.

## Testing and Validation

Run Django checks:

```bash
python manage.py check
```

Run backend tests:

```bash
python manage.py test
```

Run specific test modules:

```bash
python manage.py test core.tests.test_complaint_verification_flows
python manage.py test core.tests.test_firebase_init core.tests.test_firebase_sync_privacy
python manage.py test core.tests.test_analyze_media core.tests.test_speech_to_text_service
```

## Deployment Notes

- The repo includes Railway-oriented files (Procfile, runtime, helper scripts).
- Static/media serving differs between local and production; verify storage and media routing before go-live.
- Firestore sync should be monitored in production to avoid drift between mobile and backend records.

## Current Product Direction

- Voice-verification-based closure is deprecated/removed from active flow.
- Active verification model is photo + GPS based closure evidence for gaps and complaints.
- SMS integration endpoints are not part of active routed functionality.
>>>>>>> 6a0a424 (Many changes in verification modules.)
