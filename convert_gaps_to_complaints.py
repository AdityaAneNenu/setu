#!/usr/bin/env python
"""
Data Migration Script: Convert all Gap records to Complaint records
This script preserves all data from the Gap model while converting to Complaints.
"""
import os
import django
import sys
from datetime import datetime

# Setup Django
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Gap, Complaint, Village, PostOffice, PMAJAYOffice
from django.db import transaction

def map_status(gap_status):
    """Map Gap status to Complaint status"""
    status_mapping = {
        'open': 'received_post',
        'in_progress': 'work_in_progress',
        'resolved': 'work_completed',
    }
    return status_mapping.get(gap_status, 'received_post')

def map_priority(severity):
    """Map Gap severity to Complaint priority"""
    priority_mapping = {
        'low': 'low',
        'medium': 'medium',
        'high': 'high',
    }
    return priority_mapping.get(severity, 'medium')

def create_complaint_text(gap):
    """Create comprehensive complaint text from Gap data"""
    text_parts = [
        f"[CONVERTED FROM INFRASTRUCTURE GAP]",
        f"\nGap Type: {gap.gap_type}",
        f"\nDescription: {gap.description}",
    ]
    
    if gap.recommendations and gap.recommendations != "None":
        text_parts.append(f"\nRecommendations: {gap.recommendations}")
    
    if gap.input_method:
        text_parts.append(f"\nInput Method: {gap.get_input_method_display()}")
    
    if gap.start_date:
        text_parts.append(f"\nStart Date: {gap.start_date}")
    
    if gap.expected_completion:
        text_parts.append(f"\nExpected Completion: {gap.expected_completion}")
    
    if gap.actual_completion:
        text_parts.append(f"\nActual Completion: {gap.actual_completion}")
    
    if gap.budget_allocated:
        text_parts.append(f"\nBudget Allocated: ₹{gap.budget_allocated:,.2f}")
    
    if gap.budget_spent:
        text_parts.append(f"\nBudget Spent: ₹{gap.budget_spent:,.2f}")
    
    return "\n".join(text_parts)

@transaction.atomic
def convert_gaps_to_complaints():
    """Main conversion function"""
    print("=" * 80)
    print("CONVERTING GAPS TO COMPLAINTS")
    print("=" * 80)
    
    # Get required references
    try:
        default_post_office = PostOffice.objects.first()
        if not default_post_office:
            print("❌ ERROR: No PostOffice found. Please create at least one PostOffice first.")
            return False
        
        default_pmajay_office = PMAJAYOffice.objects.first()
        if not default_pmajay_office:
            print("❌ ERROR: No PMAJAYOffice found. Please create at least one PMAJAYOffice first.")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
    
    # Get all gaps
    gaps = Gap.objects.all().order_by('id')
    total_gaps = gaps.count()
    
    print(f"\n📊 Found {total_gaps} Gap records to convert")
    print(f"📍 Default Post Office: {default_post_office}")
    print(f"🏢 Default PM-AJAY Office: {default_pmajay_office}")
    print("\n" + "-" * 80)
    
    converted_count = 0
    skipped_count = 0
    
    for gap in gaps:
        try:
            # Generate unique complaint ID
            complaint_id = f"PMC-GAP-{gap.id}"
            
            # Check if already converted
            if Complaint.objects.filter(complaint_id=complaint_id).exists():
                print(f"⏭️  Skipping GAP-{gap.id} - Already converted to {complaint_id}")
                skipped_count += 1
                continue
            
            # Create complaint text
            complaint_text = create_complaint_text(gap)
            
            # Create new Complaint
            complaint = Complaint(
                complaint_id=complaint_id,
                villager_name=f"Infrastructure Gap Report (GAP-{gap.id})",
                village=gap.village,
                post_office=default_post_office,
                pmajay_office=default_pmajay_office,
                complaint_text=complaint_text,
                complaint_type=gap.gap_type,
                priority_level=map_priority(gap.severity),
                status=map_status(gap.status),
                created_at=gap.created_at,
                latitude=gap.latitude,
                longitude=gap.longitude,
            )
            
            # Save without generating QR code yet
            complaint.save()
            
            # Generate new QR code with complaint_id
            complaint.generate_qr_code()
            complaint.save(update_fields=['qr_code'])
            
            print(f"✅ Converted GAP-{gap.id} → {complaint_id} ({gap.village.name})")
            converted_count += 1
            
        except Exception as e:
            print(f"❌ ERROR converting GAP-{gap.id}: {e}")
            continue
    
    print("\n" + "=" * 80)
    print(f"✅ Conversion Complete!")
    print(f"   Converted: {converted_count}")
    print(f"   Skipped: {skipped_count}")
    print(f"   Total: {total_gaps}")
    print("=" * 80)
    
    return True

if __name__ == "__main__":
    print("\n⚠️  WARNING: This will convert all Gap records to Complaint records.")
    print("   The original Gap records will remain in the database.")
    response = input("\nDo you want to proceed? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        success = convert_gaps_to_complaints()
        if success:
            print("\n✅ Migration completed successfully!")
            print("\n📝 Next steps:")
            print("   1. Verify the converted complaints in Django admin")
            print("   2. Test the mobile app with new QR codes")
            print("   3. If everything works, you can delete Gap model and run migrations")
        else:
            print("\n❌ Migration failed. Please fix errors and try again.")
    else:
        print("\n❌ Migration cancelled.")

