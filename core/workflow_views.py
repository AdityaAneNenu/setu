"""
Views for the PM-AJAY Post Office Workflow System
"""

from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.contrib import messages
from django.db.models import Count, Q
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_POST
from django.core.files.base import ContentFile
import json
import base64

from .models import (Complaint, PostOffice, PMAJAYOffice, Worker, 
                    WorkflowLog, SurveyAgent, SurveyVisit)
from .services import ComplaintProcessor

def workflow_dashboard(request):
    """Main workflow dashboard showing all complaints and their status"""
    
    # Get all complaints with related data
    complaints = Complaint.objects.select_related(
        'village', 'post_office', 'pmajay_office'
    ).prefetch_related('workflow_logs').order_by('-created_at')
    
    # Filter by status if requested
    status_filter = request.GET.get('status')
    if status_filter:
        complaints = complaints.filter(status=status_filter)
    
    # Filter by priority if requested  
    priority_filter = request.GET.get('priority')
    if priority_filter:
        complaints = complaints.filter(priority_level=priority_filter)
    
    # Get statistics
    stats = {
        'total_complaints': Complaint.objects.count(),
        'pending_complaints': Complaint.objects.filter(
            status__in=['received_post', 'sent_to_office', 'under_analysis', 'assigned_worker', 'work_in_progress']
        ).count(),
        'completed_complaints': Complaint.objects.filter(
            status__in=['villager_satisfied', 'case_closed']
        ).count(),
        'urgent_complaints': Complaint.objects.filter(priority_level='urgent').count(),
    }
    
    # Complaints by status for chart
    status_data = list(Complaint.objects.values('status').annotate(count=Count('id')))
    
    # Complaints by type for chart
    type_data = list(Complaint.objects.values('complaint_type').annotate(count=Count('id')))
    
    # Recent workflow activities
    recent_activities = WorkflowLog.objects.select_related(
        'complaint'
    ).order_by('-timestamp')[:10]
    
    context = {
        'complaints': complaints[:50],  # Limit for performance
        'stats': stats,
        'status_data': status_data,
        'type_data': type_data,
        'recent_activities': recent_activities,
        'status_choices': Complaint.COMPLAINT_STATUS,
        'priority_choices': [('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('urgent', 'Urgent')],
        'current_status_filter': status_filter,
        'current_priority_filter': priority_filter,
    }
    
    return render(request, 'core/workflow_dashboard.html', context)

def complaint_detail(request, complaint_id):
    """Detailed view of a specific complaint"""
    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
    
    # Get workflow history
    workflow_logs = complaint.workflow_logs.order_by('timestamp')
    
    # Get available workers for assignment
    available_workers = Worker.objects.filter(
        is_available=True,
        pmajay_office=complaint.pmajay_office
    )
    
    # Check if voice verification is completed for audio complaints
    voice_verified = False
    if complaint.audio_file:
        from .models import VoiceVerificationLog
        voice_verified = VoiceVerificationLog.objects.filter(
            complaint=complaint,
            is_match=True
        ).exists()
    
    context = {
        'complaint': complaint,
        'workflow_logs': workflow_logs,
        'available_workers': available_workers,
        'status_choices': Complaint.COMPLAINT_STATUS,
        'voice_verified': voice_verified,
    }
    
    return render(request, 'core/complaint_detail.html', context)

@require_POST
def update_complaint_status(request, complaint_id):
    """Update complaint status and log the change"""
    complaint = get_object_or_404(Complaint, complaint_id=complaint_id)
    
    new_status = request.POST.get('status')
    notes = request.POST.get('notes', '')
    
    # Check if trying to close case with audio complaint
    if new_status == 'case_closed' and complaint.audio_file:
        # Check if voice verification has been completed
        from .models import VoiceVerificationLog
        verified_logs = VoiceVerificationLog.objects.filter(
            complaint=complaint,
            is_match=True,
            used_for_closure=False
        ).order_by('-verification_date')
        
        if not verified_logs.exists():
            messages.error(
                request, 
                '❌ Cannot close complaint! Voice verification required. '
                f'Please verify the complainant\'s voice first at: '
                f'<a href="/voice-verification/{complaint_id}/" class="alert-link">Voice Verification Dashboard</a>'
            )
            return redirect('complaint_detail', complaint_id=complaint_id)
        
        # Mark the verification log as used for closure
        latest_verification = verified_logs.first()
        latest_verification.used_for_closure = True
        latest_verification.notes = f"Used for case closure. {latest_verification.notes or ''}"
        latest_verification.save()
    
    if new_status and new_status != complaint.status:
        # Log the status change
        WorkflowLog.objects.create(
            complaint=complaint,
            from_status=complaint.status,
            to_status=new_status,
            action_by=request.user.username if request.user.is_authenticated else 'System',
            action_type='status_update',
            notes=notes
        )
        
        # Update the complaint
        old_status = complaint.get_status_display()
        complaint.status = new_status
        complaint.save()
        
        messages.success(request, f'Status updated from "{old_status}" to "{complaint.get_status_display()}"')
    
    return redirect('complaint_detail', complaint_id=complaint_id)

def submit_complaint(request):
    """Interface for submitting new complaints (for agents/post office staff)"""
    if request.method == 'POST':
        processor = ComplaintProcessor()
        
        # Basic complaint data
        villager_name = request.POST.get('villager_name')
        village_id = request.POST.get('village')
        complaint_text = request.POST.get('complaint_text')
        post_office_id = request.POST.get('post_office')
        
        # Audio file handling
        audio_file = request.FILES.get('audio_file')
        language_code = request.POST.get('language_code', 'hi')
        recorded_by_agent = request.POST.get('recorded_by_agent') == 'on'
        agent_name = request.POST.get('agent_name', '')
        
        # Process audio if provided
        audio_transcription = ''
        detected_type = 'other'
        priority_level = 'medium'
        
        if audio_file:
            result = processor.process_audio_complaint(audio_file, language_code)
            if result['success']:
                audio_transcription = result['processed_text']
                detected_type = result['detected_type']
                priority_level = result['priority_level']
                # Use audio transcription as complaint text if text is empty
                if not complaint_text.strip():
                    complaint_text = audio_transcription
            else:
                messages.error(request, f"Audio processing failed: {result['error']}")
        else:
            # Analyze text complaint
            analysis = processor.analyze_complaint(complaint_text)
            detected_type = analysis['gap_type']
            priority_level = analysis['priority']
        
        # Create the complaint
        try:
            from .models import Village, PostOffice
            village = Village.objects.get(id=village_id)
            post_office = PostOffice.objects.get(id=post_office_id)
            
            # Auto-assign PM-AJAY office
            pmajay_office = post_office.pmajayoffice_set.first()
            
            complaint = Complaint.objects.create(
                villager_name=villager_name,
                village=village,
                post_office=post_office,
                pmajay_office=pmajay_office,
                complaint_text=complaint_text,
                complaint_type=detected_type,
                priority_level=priority_level,
                audio_transcription=audio_transcription,
                recorded_by_agent=recorded_by_agent,
                agent_name=agent_name,
                status='received_post',
                latitude=village.gap_set.first().latitude if village.gap_set.exists() else None,
                longitude=village.gap_set.first().longitude if village.gap_set.exists() else None,
            )
            
            # Save audio file if provided
            if audio_file:
                complaint.audio_file = audio_file
                complaint.save()
            
            # Log the initial creation
            WorkflowLog.objects.create(
                complaint=complaint,
                from_status='',
                to_status='received_post',
                action_by=agent_name if recorded_by_agent else 'Post Office',
                action_type='received',
                notes=f'Complaint submitted by {villager_name}'
            )
            
            messages.success(request, f'Complaint {complaint.complaint_id} submitted successfully!')
            return redirect('complaint_detail', complaint_id=complaint.complaint_id)
            
        except Exception as e:
            messages.error(request, f'Error creating complaint: {str(e)}')
    
    # GET request - show form
    from .models import Village, PostOffice
    context = {
        'villages': Village.objects.all().order_by('name'),
        'post_offices': PostOffice.objects.all().order_by('name'),
        'language_choices': [
            ('hi', 'Hindi'),
            ('en', 'English'),
            ('bn', 'Bengali'),
            ('te', 'Telugu'),
            ('mr', 'Marathi'),
            ('ta', 'Tamil'),
        ]
    }
    
    return render(request, 'core/submit_complaint.html', context)

def agent_dashboard(request):
    """Dashboard for survey agents to track their visits and complaints"""
    
    # This would be filtered by logged-in agent in production
    agents = SurveyAgent.objects.prefetch_related(
        'assigned_villages', 'assigned_post_offices'
    ).annotate(
        total_visits=Count('surveyvisit'),
        complaints_this_month=Count('surveyvisit__complaints_collected')
    )
    
    # Recent visits
    recent_visits = SurveyVisit.objects.select_related(
        'agent', 'village'
    ).order_by('-visit_date')[:10]
    
    context = {
        'agents': agents,
        'recent_visits': recent_visits,
    }
    
    return render(request, 'core/agent_dashboard.html', context)

@csrf_exempt
def api_complaint_status(request, complaint_id):
    """API endpoint to get complaint status (for SMS integration)"""
    try:
        complaint = Complaint.objects.get(complaint_id=complaint_id)
        return JsonResponse({
            'complaint_id': complaint.complaint_id,
            'status': complaint.status,
            'status_display': complaint.get_status_display(),
            'villager_name': complaint.villager_name,
            'created_at': complaint.created_at.isoformat(),
            'last_updated': complaint.updated_at.isoformat(),
        })
    except Complaint.DoesNotExist:
        return JsonResponse({'error': 'Complaint not found'}, status=404)

@csrf_exempt  
@require_POST
def api_update_via_sms(request):
    """API endpoint for SMS-based status updates"""
    try:
        data = json.loads(request.body)
        complaint_id = data.get('complaint_id')
        sms_command = data.get('command')
        sender_phone = data.get('phone')
        
        complaint = Complaint.objects.get(complaint_id=complaint_id)
        
        # Map SMS commands to status updates
        command_mapping = {
            'START': 'work_in_progress',
            'PROGRESS': 'work_in_progress', 
            'DONE': 'work_completed',
            'CHECKED': 'sent_to_villager',
            'SATISFIED': 'villager_satisfied',
            'UNSATISFIED': 'villager_unsatisfied',
        }
        
        if sms_command in command_mapping:
            new_status = command_mapping[sms_command]
            
            # Update complaint
            old_status = complaint.status
            complaint.status = new_status
            complaint.save()
            
            # Log the change
            WorkflowLog.objects.create(
                complaint=complaint,
                from_status=old_status,
                to_status=new_status,
                action_by=f'SMS from {sender_phone}',
                action_type='sms_update',
                notes=f'Updated via SMS command: {sms_command}'
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Status updated to {complaint.get_status_display()}'
            })
        else:
            return JsonResponse({'error': 'Invalid SMS command'}, status=400)
            
    except Complaint.DoesNotExist:
        return JsonResponse({'error': 'Complaint not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)