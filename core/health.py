# Simple health check endpoint for Railway monitoring

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["GET"])
def health_check(request):
    """
    Health check endpoint for Railway deployment monitoring
    Returns JSON with service status
    """
    try:
        # Check database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            db_status = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"
    
    try:
        # Check cache if configured
        cache.set("health_check", "ok", 30)
        cache_status = "healthy" if cache.get("health_check") == "ok" else "unhealthy"
    except Exception:
        cache_status = "not_configured"
    
    # ✅ NEW: Check Firebase retry queue
    try:
        retry_index = cache.get('firebase_retry_index', set())
        retry_count = len(retry_index)
        firebase_status = "healthy" if retry_count < 100 else "warning"  # Alert if >100 items queued
    except Exception:
        retry_count = 0
        firebase_status = "unknown"
    
    # Overall status
    overall_status = "healthy" if db_status == "healthy" else "unhealthy"
    
    health_data = {
        "status": overall_status,
        "database": db_status,
        "cache": cache_status,
        "firebase_sync": firebase_status,
        "firebase_retry_queue": retry_count,
        "service": "setu-pm-django"
    }
    
    status_code = 200 if overall_status == "healthy" else 503
    return JsonResponse(health_data, status=status_code)

@csrf_exempt  
@require_http_methods(["GET"])
def ready_check(request):
    """
    Readiness check - returns 200 if service is ready to handle requests
    """
    try:
        # Basic database query to verify readiness
        from core.models import Village
        Village.objects.exists()
        return JsonResponse({"status": "ready"})
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JsonResponse({"status": "not_ready", "error": str(e)}, status=503)