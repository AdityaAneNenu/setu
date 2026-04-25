"""
Firebase Firestore integration for the Django backend.

This module keeps Django and Firestore aligned so the web dashboard and the
mobile app see the same records.
"""

import ast
import json
import os
import threading

import firebase_admin
from django.conf import settings
from firebase_admin import credentials, firestore

_firebase_app = None
_firestore_client = None
_firebase_init_attempted = False
_firebase_init_lock = threading.Lock()


def _parse_firebase_credentials_json(raw_json):
    """Parse Firebase credentials from env with resilient fallbacks."""
    if not raw_json:
        raise ValueError("Empty FIREBASE_CREDENTIALS_JSON")

    payload = raw_json.strip()
    if (
        len(payload) >= 2
        and payload[0] == payload[-1]
        and payload[0] in {'"', "'"}
    ):
        payload = payload[1:-1]

    try:
        parsed = json.loads(payload)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    try:
        parsed = ast.literal_eval(payload)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    raise ValueError(
        "FIREBASE_CREDENTIALS_JSON is not valid JSON/object text. "
        "Ensure keys are quoted and the value is the full service-account JSON."
    )


def get_firebase_app():
    """Initialize Firebase Admin SDK once and reuse it."""
    global _firebase_app, _firebase_init_attempted

    if _firebase_app is not None:
        return _firebase_app
    if _firebase_init_attempted:
        return None

    with _firebase_init_lock:
        if _firebase_app is not None:
            return _firebase_app
        if _firebase_init_attempted:
            return None

        _firebase_init_attempted = True

        cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
        cred_path = os.getenv(
            "FIREBASE_CREDENTIALS_PATH",
            os.path.join(settings.BASE_DIR, "firebase-service-account.json"),
        )
        storage_bucket = os.getenv(
            "FIREBASE_STORAGE_BUCKET", "setu-pm.firebasestorage.app"
        )

        try:
            if cred_json:
                cred_dict = _parse_firebase_credentials_json(cred_json)
                cred = credentials.Certificate(cred_dict)
                _firebase_app = firebase_admin.initialize_app(
                    cred, {"storageBucket": storage_bucket}
                )
                print("Firebase Admin SDK initialized from env var")
            elif os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                _firebase_app = firebase_admin.initialize_app(
                    cred, {"storageBucket": storage_bucket}
                )
                print("Firebase Admin SDK initialized from file")
            else:
                print(
                    "Firebase credentials not found. "
                    "Set FIREBASE_CREDENTIALS_JSON or place firebase-service-account.json in the project root."
                )
                _firebase_app = None
        except Exception as exc:
            print(
                "Firebase initialization failed: "
                f"{exc}. Check FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH."
            )
            _firebase_app = None

    return _firebase_app


def get_firestore_client():
    """Return the shared Firestore client."""
    global _firestore_client

    if _firestore_client is not None:
        return _firestore_client

    app = get_firebase_app()
    if app:
        _firestore_client = firestore.client()

    return _firestore_client


def sync_village_to_firestore(village):
    """Sync a Django Village model to Firestore."""
    db = get_firestore_client()
    if not db:
        return

    db.collection("villages").document(str(village.id)).set(
        {
            "name": village.name,
            "django_id": village.id,
            "updated_at": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )


def _gap_document_ref(db, gap):
    """
    Reuse the original Firestore gap document when a mobile-created gap has
    already been linked back to Django via django_id.
    """
    try:
        existing_docs = list(
            db.collection("gaps").where("django_id", "==", gap.id).limit(1).stream()
        )
        if existing_docs:
            return existing_docs[0].reference
    except Exception:
        pass
    return db.collection("gaps").document(str(gap.id))


def sync_gap_to_firestore(gap):
    """Sync a Django Gap model to Firestore."""
    db = get_firestore_client()
    if not db:
        return

    try:
        data = {
            "django_id": gap.id,
            "village_id": str(gap.village_id),
            "village_name": gap.village.name if gap.village else "",
            "description": gap.description or "",
            "gap_type": gap.gap_type or "other",
            "severity": gap.severity or "medium",
            "status": gap.status or "open",
            "input_method": gap.input_method or "text",
            "recommendations": gap.recommendations or "",
            "audio_url": gap.audio_file.url if gap.audio_file else (gap.audio_url or None),
            "image_url": None,
            "voice_code": firestore.DELETE_FIELD,
            "latitude": float(gap.latitude) if gap.latitude else None,
            "longitude": float(gap.longitude) if gap.longitude else None,
            "start_date": gap.start_date.isoformat() if gap.start_date else None,
            "expected_completion": (
                gap.expected_completion.isoformat() if gap.expected_completion else None
            ),
            "actual_completion": (
                gap.actual_completion.isoformat() if gap.actual_completion else None
            ),
            "resolved_by": gap.resolved_by.username if gap.resolved_by else None,
            "resolved_at": gap.resolved_at.isoformat() if gap.resolved_at else None,
            "closure_photo_url": gap.closure_photo_url or None,
            "closure_latitude": (
                float(gap.closure_latitude) if gap.closure_latitude else None
            ),
            "closure_longitude": (
                float(gap.closure_longitude) if gap.closure_longitude else None
            ),
            "closure_photo_timestamp": (
                gap.closure_photo_timestamp.isoformat()
                if gap.closure_photo_timestamp
                else None
            ),
            "closure_selfie_url": gap.closure_selfie_url or None,
            "closure_selfie_match_score": (
                float(gap.closure_selfie_match_score)
                if gap.closure_selfie_match_score is not None
                else None
            ),
            "created_at": gap.created_at.isoformat() if gap.created_at else None,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }

        _gap_document_ref(db, gap).set(data, merge=True)
    except Exception as exc:
        print(f"Firestore sync failed for gap {gap.id}: {exc}")


def sync_complaint_to_firestore(complaint):
    """Sync a Django Complaint model to Firestore."""
    db = get_firestore_client()
    if not db:
        return

    data = {
        "django_id": complaint.id,
        "complaint_id": complaint.complaint_id,
        "villager_name": complaint.villager_name,
        "village_id": str(complaint.village_id) if complaint.village_id else None,
        "village_name": complaint.village.name if complaint.village else "",
        "complaint_text": complaint.complaint_text or "",
        "complaint_type": complaint.complaint_type or "",
        "priority_level": complaint.priority_level or "medium",
        "status": complaint.status or "received_post",
        "location_details": "",
        "audio_url": complaint.audio_file.url if complaint.audio_file else None,
        "latitude": float(complaint.latitude) if complaint.latitude else None,
        "longitude": float(complaint.longitude) if complaint.longitude else None,
        "complaintee_photo_url": (
            complaint.complaintee_photo.url if complaint.complaintee_photo else None
        ),
        "submission_latitude": (
            float(complaint.submission_latitude)
            if complaint.submission_latitude is not None
            else None
        ),
        "submission_longitude": (
            float(complaint.submission_longitude)
            if complaint.submission_longitude is not None
            else None
        ),
        "closure_selfie_url": (
            complaint.closure_selfie.url if complaint.closure_selfie else None
        ),
        "closure_latitude": (
            float(complaint.closure_latitude)
            if complaint.closure_latitude is not None
            else None
        ),
        "closure_longitude": (
            float(complaint.closure_longitude)
            if complaint.closure_longitude is not None
            else None
        ),
        "closure_distance_m": complaint.closure_distance_m,
        "closure_selfie_match_score": complaint.closure_selfie_match_score,
        "resolution_letter_image_url": (
            complaint.resolution_letter_image.url
            if complaint.resolution_letter_image
            else None
        ),
        "created_at": complaint.created_at.isoformat() if complaint.created_at else None,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    db.collection("complaints").document(str(complaint.id)).set(data, merge=True)


def sync_user_to_firestore(user):
    """Sync a Django User + UserProfile to Firestore."""
    db = get_firestore_client()
    if not db:
        return

    role = "ground"
    try:
        if hasattr(user, "profile"):
            role = user.profile.role
    except Exception:
        pass

    data = {
        "django_id": user.id,
        "uid": str(user.id),
        "username": user.username,
        "email": user.email or "",
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "role": role,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    db.collection("users").document(str(user.id)).set(data, merge=True)


def sync_all_villages():
    """Sync all Django villages to Firestore."""
    from core.models import Village

    villages = Village.objects.all()
    count = 0
    for village in villages:
        sync_village_to_firestore(village)
        count += 1
    print(f"Synced {count} villages to Firestore")
    return count


def sync_all_gaps():
    """Sync all Django gaps to Firestore."""
    from core.models import Gap

    gaps = Gap.objects.select_related("village", "resolved_by").all()
    count = 0
    for gap in gaps:
        sync_gap_to_firestore(gap)
        count += 1
    print(f"Synced {count} gaps to Firestore")
    return count


def sync_all_complaints():
    """Sync all Django complaints to Firestore."""
    from core.models import Complaint

    complaints = Complaint.objects.select_related("village").all()
    count = 0
    for complaint in complaints:
        sync_complaint_to_firestore(complaint)
        count += 1
    print(f"Synced {count} complaints to Firestore")
    return count


def sync_all_users():
    """Sync all Django users to Firestore."""
    from django.contrib.auth.models import User

    users = User.objects.select_related("profile").all()
    count = 0
    for user in users:
        sync_user_to_firestore(user)
        count += 1
    print(f"Synced {count} users to Firestore")
    return count


def sync_everything():
    """Full sync of all data from Django to Firestore."""
    print("Starting full sync to Firebase Firestore...")
    v = sync_all_villages()
    g = sync_all_gaps()
    c = sync_all_complaints()
    u = sync_all_users()
    print(f"Full sync complete: {v} villages, {g} gaps, {c} complaints, {u} users")
    return {"villages": v, "gaps": g, "complaints": c, "users": u}


def import_gaps_from_firestore():
    """Import new gaps created via mobile app into Django."""
    from core.models import Gap, Village

    db = get_firestore_client()
    if not db:
        return 0

    gaps_ref = db.collection("gaps").where("django_id", "==", None).stream()

    count = 0
    for doc in gaps_ref:
        data = doc.to_dict()

        village = None
        if data.get("village_name"):
            village = Village.objects.filter(name__icontains=data["village_name"]).first()
        if not village and data.get("village_id"):
            try:
                village = Village.objects.get(id=int(data["village_id"]))
            except (Village.DoesNotExist, ValueError):
                pass

        if not village:
            village = Village.objects.create(name=data.get("village_name", "Unknown"))

        gap = Gap.objects.create(
            village=village,
            description=data.get("description", ""),
            gap_type=data.get("gap_type", "other"),
            severity=data.get("severity", "medium"),
            status=data.get("status", "open"),
            input_method=data.get("input_method", "text"),
            recommendations=data.get("recommendations", ""),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
        )

        db.collection("gaps").document(doc.id).update(
            {"django_id": gap.id, "updated_at": firestore.SERVER_TIMESTAMP}
        )
        count += 1

    print(f"Imported {count} new gaps from Firestore to Django")
    return count
