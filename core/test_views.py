from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import datetime


@csrf_exempt
@require_http_methods(["GET"])
def test_connection(request):
    """Simple endpoint to test connectivity"""
    from core.models import Gap, Village, Submission, VoiceVerificationLog
    from django.contrib.auth.models import User

    response = JsonResponse(
        {
            "status": "success",
            "message": "Django server is running",
            "server_time": str(datetime.datetime.now()),
            "method": request.method,
            "path": request.path,
            "data_counts": {
                "users": User.objects.count(),
                "villages": Village.objects.count(),
                "gaps": Gap.objects.count(),
                "submissions": Submission.objects.count(),
                "voice_logs": VoiceVerificationLog.objects.count(),
            },
        }
    )

    # Add CORS headers
    response["Access-Control-Allow-Origin"] = "*"

    return response
