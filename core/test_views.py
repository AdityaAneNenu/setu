from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
import datetime


@csrf_exempt
@require_http_methods(["GET"])
def test_connection(request):
    """Simple endpoint to test connectivity"""
    response = JsonResponse(
        {
            "status": "success",
            "message": "Django server is running",
            "server_time": str(datetime.datetime.now()),
            "method": request.method,
            "path": request.path,
        }
    )

    # Add CORS headers
    response["Access-Control-Allow-Origin"] = "*"

    return response
