# SETU PM-AJAY Platform

SETU is a full-stack platform for rural infrastructure and complaint lifecycle management.

It includes:
- A Django web app for dashboards, workflow operations, and administration
- A REST API consumed by web and mobile clients
- An Expo React Native mobile app for field workflows and sync
- AI-assisted media analysis endpoints for complaint/gap support

## Audit Snapshot (April 27, 2026)

This repository was audited before rewriting this README.

### High-severity findings
- Unresolved Git merge conflict markers exist in multiple tracked files:
  - `README.md` (fixed by this rewrite)
  - `core/templates/core/complaint_detail.html`
  - `core/fixtures/local_data.json`
- These conflict markers can break runtime behavior and data loading and should be resolved immediately.

### Medium-severity findings
- `requirements.txt` appears incomplete at the end (trailing section header: `# Audio/Scientific` with no packages listed).
- `config/settings.py` contains duplicated logging configuration blocks.

### Current health signal
- Editor diagnostics currently report no immediate syntax/lint errors, but unresolved merge conflicts are still critical technical debt.

## Tech Stack

### Backend
- Python 3.11 (runtime target)
- Django 4.2.27
- Django REST Framework 3.14.0
- SQLite (local default) or PostgreSQL via `DATABASE_URL`
- Firebase Admin SDK integration
- WhiteNoise + Gunicorn for production serving

### Mobile
- Expo SDK 54
- React Native 0.81.5
- Firebase client SDK
- Camera, location, file/document capture support

### AI and Media
- Google Generative AI SDK
- AssemblyAI SDK
- Pillow / OpenCV / NumPy for media handling

## Repository Layout

- `config/`: Django project config (`settings.py`, root URLs, WSGI/ASGI)
- `core/`: Main app (models, views, API views, workflow, templates, tests)
- `core/api_urls.py`: REST endpoint routes
- `core/urls.py`: Web UI routes
- `mobile-app/`: Expo React Native app
- `docs/`: Project documentation
- `locale/`: Translation files
- `media/`, `staticfiles/`, `logs/`: runtime artifacts and generated assets

## Key Web Routes

- `/` home page
- `/dashboard/` role-aware dashboard
- `/public-dashboard/` public progress dashboard
- `/manage-gaps/` gap management
- `/workflow/` workflow dashboard
- `/workflow/complaint/<complaint_id>/` complaint details
- `/workflow/complaint/<complaint_id>/verify-close/` verification close flow
- `/workflow/complaint/<complaint_id>/resolve-photo/` photo-resolution flow

## Key API Routes

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

### Mobile sync and workflow
- `POST /api/mobile/gaps/sync/`
- `POST /api/mobile/gaps/<firestore_id>/status/`
- `GET /api/mobile/gaps/`
- `POST /api/mobile/gaps/<gap_id>/resolve/`
- `POST /api/mobile/complaints/submit/`
- `GET /api/mobile/complaints/in-progress/`
- `POST /api/mobile/complaints/<complaint_id>/verify-close/`
- `POST /api/mobile/complaints/<complaint_id>/resolve-photo/`

### AI
- `POST /api/analyze-media/`

## Backend Setup (Local)

## 1. Prerequisites
- Python 3.10+ (3.11 recommended)
- pip

## 2. Create and activate virtual environment

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

## 3. Install dependencies
```bash
pip install -r requirements.txt
```

## 4. Configure environment
Create `.env` in repo root. Start from `.env.example`.

Minimum backend variables:
- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `DATABASE_URL` (optional; SQLite used if omitted)
- `FIREBASE_CREDENTIALS_PATH` or `FIREBASE_CREDENTIALS_JSON`
- `GEMINI_API_KEY` (if AI features enabled)
- `ASSEMBLYAI_API_KEY` (if speech processing enabled)

## 5. Run migrations and checks
```bash
python manage.py migrate
python manage.py check
```

## 6. Start development server
```bash
python manage.py runserver
```

Default local URL: `http://127.0.0.1:8000/`

## Mobile Setup (Expo)

## 1. Prerequisites
- Node.js 18+
- npm

## 2. Install and run
```bash
cd mobile-app
npm install
npm run start
```

Optional launch shortcuts:
```bash
npm run android
npm run ios
npm run web
```

Mobile API base URL logic is defined in:
- `mobile-app/src/config/api.js`

By default, production mobile API points to:
- `https://setu.up.railway.app`

## Testing

Run Django checks:
```bash
python manage.py check
```

Run all backend tests:
```bash
python manage.py test
```

Useful targeted tests:
```bash
python manage.py test core.tests.test_complaint_verification_flows
python manage.py test core.tests.test_firebase_init core.tests.test_firebase_sync_privacy
python manage.py test core.tests.test_analyze_media core.tests.test_speech_to_text_service
python manage.py test core.tests.test_mobile_gap_resolve_verification
```

## Deployment (Railway)

Relevant files:
- `Procfile`
- `runtime.txt`
- `nixpacks.toml`
- `RAILWAY_DEPLOY.md`

Current process command (from `Procfile`):
```bash
python manage.py migrate --noinput && python manage.py setup_all_users && python manage.py collectstatic --noinput && gunicorn config.wsgi --bind 0.0.0.0:$PORT
```

## Immediate Cleanup Recommended

1. Resolve all merge conflicts in tracked files:
   - `core/templates/core/complaint_detail.html`
   - `core/fixtures/local_data.json`
2. Repair and finalize `requirements.txt` tail section.
3. Consolidate duplicate logging configuration in `config/settings.py`.
4. Re-run `python manage.py check` and regression tests after conflict cleanup.

## Notes

- This README has been fully rewritten to replace a corrupted, conflict-marked version.
- Keep this file updated whenever endpoints, deployment commands, or environment variables change.
