from django.urls import path
from . import api_views
from .test_views import test_connection

# Simple API URLs for mobile app integration
urlpatterns = [
    # Main QR submission endpoint that mobile app uses
    path('api/qr-submissions/', api_views.QRSubmissionAPIView.as_view(), name='qr_submissions'),
    # Test endpoint for connectivity checking
    path('api/test/', test_connection, name='test_connection'),
]