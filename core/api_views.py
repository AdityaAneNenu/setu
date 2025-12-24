from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from datetime import datetime
import os
import json

from .models import Complaint, Village, PostOffice
from .serializers import (
    ComplaintSerializer, VillageSerializer, PostOfficeSerializer,
    PhotoUploadSerializer, OfflineDataSyncSerializer
)


class ComplaintViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing complaints
    GET /api/complaints/ - List all complaints
    GET /api/complaints/{id}/ - Get specific complaint
    GET /api/complaints/by_complaint_id/{complaint_id}/ - Get by complaint ID
    """
    queryset = Complaint.objects.all().order_by('-created_at')
    serializer_class = ComplaintSerializer
    permission_classes = [AllowAny]  # Change to appropriate permissions in production
    
    @action(detail=False, methods=['get'], url_path='by_complaint_id/(?P<complaint_id>[^/.]+)')
    def by_complaint_id(self, request, complaint_id=None):
        """Get complaint by complaint_id (e.g., PMC2024001)"""
        complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
        serializer = self.get_serializer(complaint)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search complaints by various parameters"""
        query = request.query_params.get('q', '')
        status_filter = request.query_params.get('status', '')
        
        queryset = self.queryset
        
        if query:
            queryset = queryset.filter(
                complaint_id__icontains=query
            ) | queryset.filter(
                villager_name__icontains=query
            )
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class VillageViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for viewing villages"""
    queryset = Village.objects.all().order_by('name')
    serializer_class = VillageSerializer
    permission_classes = [AllowAny]


class PostOfficeViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for viewing post offices"""
    queryset = PostOffice.objects.all().order_by('name')
    serializer_class = PostOfficeSerializer
    permission_classes = [AllowAny]


@api_view(['POST'])
def upload_photo(request):
    """
    Upload a photo for a specific complaint
    POST /api/upload-photo/
    Body: {
        "complaint_id": "PMC2024001",
        "photo": <file>,
        "latitude": 28.4595,
        "longitude": 77.0266,
        "timestamp": "2024-01-15T10:30:00Z"
    }
    """
    # Log request data for debugging
    print(f"Upload photo request - Data: {request.data.keys()}")
    print(f"Files: {request.FILES.keys()}")
    print(f"Complaint ID: {request.data.get('complaint_id')}")

    serializer = PhotoUploadSerializer(data=request.data)

    if serializer.is_valid():
        complaint_id = serializer.validated_data['complaint_id']
        photo = serializer.validated_data['photo']
        latitude = serializer.validated_data.get('latitude')
        longitude = serializer.validated_data.get('longitude')

        try:
            complaint = Complaint.objects.get(complaint_id=complaint_id)
        except Complaint.DoesNotExist:
            return Response(
                {'error': f'Complaint {complaint_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Save photo to media directory
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"complaint_photos/{complaint_id}_{timestamp}_{photo.name}"
        path = default_storage.save(filename, ContentFile(photo.read()))

        # Update complaint's geotagged_photos list
        if complaint.geotagged_photos is None:
            complaint.geotagged_photos = []

        photo_data = {
            'path': path,
            'url': default_storage.url(path),
            'uploaded_at': datetime.now().isoformat(),
        }

        if latitude and longitude:
            photo_data['latitude'] = str(latitude)
            photo_data['longitude'] = str(longitude)

        complaint.geotagged_photos.append(photo_data)
        complaint.save()

        print(f"Photo uploaded successfully: {path}")

        return Response({
            'success': True,
            'message': 'Photo uploaded successfully',
            'complaint_id': complaint_id,
            'photo_url': default_storage.url(path)
        }, status=status.HTTP_201_CREATED)

    print(f"Validation errors: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def sync_offline_data(request):
    """
    Sync offline collected data (multiple photos and notes)
    POST /api/sync-offline/
    Body: {
        "complaint_id": "PMC2024001",
        "photos": [<file1>, <file2>, ...],
        "notes": "Additional notes",
        "latitude": 28.4595,
        "longitude": 77.0266,
        "collected_at": "2024-01-15T10:30:00Z"
    }
    """
    complaint_id = request.data.get('complaint_id')

    if not complaint_id:
        return Response({'error': 'complaint_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        complaint = Complaint.objects.get(complaint_id=complaint_id)
    except Complaint.DoesNotExist:
        return Response({'error': f'Complaint {complaint_id} not found'}, status=status.HTTP_404_NOT_FOUND)

    # Process multiple photos
    uploaded_photos = []
    photos = request.FILES.getlist('photos')

    for photo in photos:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        filename = f"complaint_photos/{complaint_id}_{timestamp}_{photo.name}"
        path = default_storage.save(filename, ContentFile(photo.read()))
        uploaded_photos.append(default_storage.url(path))

    return Response({
        'success': True,
        'message': f'Synced {len(uploaded_photos)} photos for complaint {complaint_id}',
        'complaint_id': complaint_id,
        'photos_uploaded': len(uploaded_photos)
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def test_upload(request):
    """
    Test endpoint to debug photo uploads
    """
    print("=" * 50)
    print("TEST UPLOAD ENDPOINT")
    print("=" * 50)
    print(f"Request method: {request.method}")
    print(f"Content-Type: {request.content_type}")
    print(f"POST data keys: {list(request.POST.keys())}")
    print(f"FILES keys: {list(request.FILES.keys())}")
    print(f"Data keys: {list(request.data.keys())}")

    for key in request.POST.keys():
        print(f"POST[{key}] = {request.POST[key]}")

    for key in request.FILES.keys():
        file = request.FILES[key]
        print(f"FILE[{key}] = {file.name}, size={file.size}, content_type={file.content_type}")

    return Response({
        'success': True,
        'message': 'Test successful',
        'received_post': list(request.POST.keys()),
        'received_files': list(request.FILES.keys()),
    })


@api_view(['POST'])
def upload_gap_photo(request):
    """
    Upload a photo for a gap and optionally update its status
    POST /api/upload-gap-photo/
    Body: {
        "gap_id": 12,
        "photo": <file>,
        "status": "resolved" (optional)
    }
    """
    from .models import Gap

    gap_id = request.data.get('gap_id')
    new_status = request.data.get('status')

    if not gap_id:
        return Response({'error': 'gap_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        gap = Gap.objects.get(id=gap_id)
    except Gap.DoesNotExist:
        return Response({'error': f'Gap {gap_id} not found'}, status=status.HTTP_404_NOT_FOUND)

    # Process photo if provided
    photo_url = None
    if 'photo' in request.FILES:
        photo = request.FILES['photo']
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"gap_photos/gap_{gap_id}_{timestamp}_{photo.name}"
        path = default_storage.save(filename, ContentFile(photo.read()))
        photo_url = default_storage.url(path)

    # Update status if provided
    if new_status and new_status in ['open', 'in_progress', 'resolved']:
        gap.status = new_status
        gap.save()

    return Response({
        'success': True,
        'message': 'Gap updated successfully',
        'gap_id': gap_id,
        'photo_url': photo_url,
        'status': gap.status
    }, status=status.HTTP_200_OK)

