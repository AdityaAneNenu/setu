"""
Management command to create sample data for the post office workflow system
"""

from django.core.management.base import BaseCommand
from core.models import (Village, PostOffice, PMAJAYOffice, Complaint, 
                        SurveyAgent, Worker, Gap)
from decimal import Decimal
import random
from datetime import date, datetime, timedelta

class Command(BaseCommand):
    help = 'Create sample data for post office workflow system'

    def handle(self, *args, **options):
        self.stdout.write("Creating sample data for post office workflow...")
        
        # Create Post Offices
        post_offices_data = [
            {"name": "Rajpur Post Office", "pincode": "110001", "district": "Delhi", "state": "Delhi", 
             "postmaster_name": "Mr. Rajesh Kumar", "contact_number": "9876543210",
             "latitude": Decimal("28.6139"), "longitude": Decimal("77.2090")},
            {"name": "Khandsa Post Office", "pincode": "122001", "district": "Gurugram", "state": "Haryana",
             "postmaster_name": "Ms. Priya Sharma", "contact_number": "9876543211", 
             "latitude": Decimal("28.4595"), "longitude": Decimal("77.0266")},
            {"name": "Badarpur Post Office", "pincode": "110044", "district": "Delhi", "state": "Delhi",
             "postmaster_name": "Mr. Suresh Singh", "contact_number": "9876543212",
             "latitude": Decimal("28.4957"), "longitude": Decimal("77.3086")},
            {"name": "Bhiwandi Post Office", "pincode": "421302", "district": "Thane", "state": "Maharashtra",
             "postmaster_name": "Mrs. Sunita Patil", "contact_number": "9876543213",
             "latitude": Decimal("19.2952"), "longitude": Decimal("73.0634")},
            {"name": "Ballabhgarh Post Office", "pincode": "121004", "district": "Faridabad", "state": "Haryana",
             "postmaster_name": "Mr. Dinesh Yadav", "contact_number": "9876543214",
             "latitude": Decimal("28.3406"), "longitude": Decimal("77.3267")},
        ]
        
        post_offices = []
        for po_data in post_offices_data:
            po, created = PostOffice.objects.get_or_create(
                name=po_data["name"],
                defaults=po_data
            )
            post_offices.append(po)
            if created:
                self.stdout.write(f"✓ Created post office: {po.name}")
            else:
                self.stdout.write(f"• Post office already exists: {po.name}")
        
        # Create PM-AJAY Offices
        pmajay_offices_data = [
            {"name": "PM-AJAY Delhi Regional Office", "district": "Delhi", "state": "Delhi",
             "officer_name": "Dr. Amit Verma", "contact_number": "9876540001", "email": "delhi@pmajay.gov.in"},
            {"name": "PM-AJAY Haryana Regional Office", "district": "Gurugram", "state": "Haryana",
             "officer_name": "Mrs. Kavita Jain", "contact_number": "9876540002", "email": "haryana@pmajay.gov.in"},
            {"name": "PM-AJAY Maharashtra Regional Office", "district": "Thane", "state": "Maharashtra",
             "officer_name": "Mr. Ravi Desai", "contact_number": "9876540003", "email": "maharashtra@pmajay.gov.in"},
        ]
        
        pmajay_offices = []
        for office_data in pmajay_offices_data:
            office, created = PMAJAYOffice.objects.get_or_create(
                name=office_data["name"],
                defaults=office_data
            )
            pmajay_offices.append(office)
            if created:
                self.stdout.write(f"✓ Created PM-AJAY office: {office.name}")
                
                # Assign post offices to PM-AJAY offices
                if "Delhi" in office.name:
                    office.serves_post_offices.set([po for po in post_offices if po.state == "Delhi"])
                elif "Haryana" in office.name:
                    office.serves_post_offices.set([po for po in post_offices if po.state == "Haryana"])
                elif "Maharashtra" in office.name:
                    office.serves_post_offices.set([po for po in post_offices if po.state == "Maharashtra"])
            else:
                self.stdout.write(f"• PM-AJAY office already exists: {office.name}")
        
        # Create Workers
        worker_types = ['electrician', 'plumber', 'road_contractor', 'mason', 'healthcare', 'agriculture', 'general']
        worker_names = ["Rajesh Kumar", "Sita Devi", "Mohammed Ali", "Priya Sharma", "Suresh Singh", 
                       "Anita Gupta", "Ravi Kumar", "Sunita Patil", "Dinesh Yadav", "Kavita Jain",
                       "Amit Verma", "Pooja Singh", "Rakesh Sharma", "Meera Devi", "Ajay Kumar"]
        
        workers = []
        for i, name in enumerate(worker_names):
            worker_type = random.choice(worker_types)
            pmajay_office = random.choice(pmajay_offices)
            
            worker, created = Worker.objects.get_or_create(
                name=name,
                defaults={
                    'worker_type': worker_type,
                    'phone_number': f"987654{i:04d}",
                    'pmajay_office': pmajay_office,
                    'is_available': random.choice([True, True, False]),  # Most are available
                    'current_location_lat': Decimal("28.4595") + Decimal(random.uniform(-0.1, 0.1)),
                    'current_location_lng': Decimal("77.0266") + Decimal(random.uniform(-0.1, 0.1)),
                }
            )
            workers.append(worker)
            if created:
                self.stdout.write(f"✓ Created worker: {name} ({worker_type})")
        
        # Create Survey Agents
        agent_names = ["Agent Rajiv Kumar", "Agent Sunita Devi", "Agent Mohammad Khan", "Agent Priya Patel"]
        villages = list(Village.objects.all())
        
        agents = []
        for i, name in enumerate(agent_names):
            agent, created = SurveyAgent.objects.get_or_create(
                name=name,
                defaults={
                    'employee_id': f"SA{1000+i}",
                    'phone_number': f"987650{i:04d}",
                }
            )
            if created:
                # Assign villages and post offices
                assigned_villages = random.sample(villages, min(3, len(villages)))
                agent.assigned_villages.set(assigned_villages)
                
                assigned_pos = random.sample(post_offices, min(2, len(post_offices)))
                agent.assigned_post_offices.set(assigned_pos)
                
                self.stdout.write(f"✓ Created survey agent: {name}")
            agents.append(agent)
        
        # Create Sample Complaints with Audio Support
        complaint_scenarios = [
            {
                "villager_name": "Ram Prasad",
                "complaint_text": "हमारे गाँव में बिजली की समस्या है। रोज 8-10 घंटे बिजली कटी रहती है। बच्चों की पढ़ाई में दिक्कत हो रही है।",
                "complaint_type": "infrastructure",
                "priority_level": "high",
                "audio_transcription": "Hamre gaon mein bijli ki samasya hai. Roj 8-10 ghante bijli kati rehti hai. Bacho ki padhai mein dikkat ho rahi hai.",
                "recorded_by_agent": True,
                "agent_name": "Agent Rajiv Kumar"
            },
            {
                "villager_name": "Sita Devi", 
                "complaint_text": "गाँव में डॉक्टर नहीं आते हैं। प्राथमिक स्वास्थ्य केंद्र में दवाई भी नहीं है। बीमार पड़ने पर शहर जाना पड़ता है।",
                "complaint_type": "healthcare",
                "priority_level": "urgent",
                "audio_transcription": "Gaon mein doctor nahin aate hain. Prathamik swasthya kendra mein dawai bhi nahin hai. Bimar padne par sheher jana padta hai.",
                "recorded_by_agent": True,
                "agent_name": "Agent Sunita Devi"
            },
            {
                "villager_name": "Mohan Singh",
                "complaint_text": "मुख्य सड़क में बड़े गड्ढे हैं। बारिश में पानी भर जाता है। गाड़ी से आना-जाना मुश्किल है।",
                "complaint_type": "infrastructure", 
                "priority_level": "medium",
                "audio_transcription": "Mukhya sadak mein bade gaddhe hain. Barish mein pani bhar jata hai. Gadi se aana-jana mushkil hai.",
                "recorded_by_agent": False,
                "agent_name": ""
            },
            {
                "villager_name": "Krishna Devi",
                "complaint_text": "बच्चों के स्कूल में शिक्षक नहीं आते। किताबें भी समय पर नहीं मिलतीं। बच्चों की शिक्षा पर बुरा असर हो रहा है।",
                "complaint_type": "education",
                "priority_level": "high", 
                "audio_transcription": "Bacho ke school mein shikshak nahin aate. Kitaben bhi samay par nahin miltin. Bacho ki shiksha par bura asar ho raha hai.",
                "recorded_by_agent": True,
                "agent_name": "Agent Mohammad Khan"
            },
            {
                "villager_name": "Ravi Kumar",
                "complaint_text": "किसानों को बीज और खाद समय पर नहीं मिल रहा। फसल की गुणवत्ता गिर रही है। सरकारी योजनाओं की जानकारी भी नहीं मिलती।",
                "complaint_type": "agriculture",
                "priority_level": "high",
                "audio_transcription": "Kisano ko beej aur khad samay par nahin mil raha. Fasal ki gunvatta gir rahi hai. Sarkari yojanaon ki jankari bhi nahin milti.",
                "recorded_by_agent": True,
                "agent_name": "Agent Priya Patel"
            }
        ]
        
        complaints = []
        for i, scenario in enumerate(complaint_scenarios):
            village = random.choice(villages)
            post_office = random.choice([po for po in post_offices if po.state in ["Delhi", "Haryana", "Maharashtra"]])
            pmajay_office = random.choice([office for office in pmajay_offices if post_office in office.serves_post_offices.all()])
            
            complaint, created = Complaint.objects.get_or_create(
                complaint_id=f"PMC2024{1001+i:03d}",
                defaults={
                    **scenario,
                    'village': village,
                    'post_office': post_office,
                    'pmajay_office': pmajay_office,
                    'status': random.choice(['received_post', 'sent_to_office', 'under_analysis', 'assigned_worker']),
                    'latitude': village.gap_set.first().latitude if village.gap_set.exists() else Decimal("28.4595"),
                    'longitude': village.gap_set.first().longitude if village.gap_set.exists() else Decimal("77.0266"),
                    'geotagged_photos': [f"complaint_photos/photo_{i+1}.jpg", f"complaint_photos/location_{i+1}.jpg"]
                }
            )
            complaints.append(complaint)
            if created:
                self.stdout.write(f"✓ Created complaint: {complaint.complaint_id} from {complaint.villager_name}")
        
        # Update requirements.txt
        requirements_content = """Django==4.2.27
Pillow==11.0.0
assemblyai==0.48.1
httpx==0.28.1
websockets==15.0.1
"""
        
        with open("requirements.txt", "w") as f:
            f.write(requirements_content)
        
        self.stdout.write(self.style.SUCCESS("\\n🎉 Sample workflow data created successfully!"))
        self.stdout.write("\\n📊 Summary:")
        self.stdout.write(f"• Post Offices: {len(post_offices)}")
        self.stdout.write(f"• PM-AJAY Offices: {len(pmajay_offices)}")
        self.stdout.write(f"• Workers: {len(workers)}")
        self.stdout.write(f"• Survey Agents: {len(agents)}")
        self.stdout.write(f"• Sample Complaints: {len(complaints)}")
        
        self.stdout.write("\\n📱 Features included:")
        self.stdout.write("• Multi-language audio transcription (Hindi/English)")
        self.stdout.write("• Geotagged complaint photos")
        self.stdout.write("• Agent-assisted complaint recording for illiterate villagers")
        self.stdout.write("• Complete post office to PM-AJAY workflow tracking")
        self.stdout.write("• Twice-monthly survey agent visits")
        
        self.stdout.write("\\n🔧 Next steps:")
        self.stdout.write("• Create complaint submission interface")
        self.stdout.write("• Build workflow tracking dashboard")
        self.stdout.write("• Add SMS integration for rural areas")
        self.stdout.write("• Implement signature capture for case closure")