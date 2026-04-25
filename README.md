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

```bash
python -m venv .venv
pip install -r requirements.txt
python manage.py migrate
python manage.py check
```

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
