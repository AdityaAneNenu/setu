from django.shortcuts import render
from django.http import HttpResponse
import os
from django.conf import settings

def mobile_app_view(request):
    """Serve the mobile QR scanning app"""
    mobile_app_path = os.path.join(settings.BASE_DIR, 'mobile_app', 'mobile_qr_app.html')
    
    try:
        with open(mobile_app_path, 'r', encoding='utf-8') as file:
            content = file.read()
        return HttpResponse(content, content_type='text/html')
    except FileNotFoundError:
        return HttpResponse("Mobile app not found", status=404)

def mobile_real_camera_view(request):
    """Serve the real camera mobile QR scanning app"""
    return render(request, 'core/mobile_real_camera.html')