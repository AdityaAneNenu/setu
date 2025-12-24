"""
PM-AJAY Speech-to-Text Service
Handles multi-language audio transcription for illiterate villagers
"""

import assemblyai as aai
from django.conf import settings
from django.core.files.base import ContentFile
import os
import tempfile

class SpeechToTextService:
    def __init__(self):
        # AssemblyAI API key from environment variable
        aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY", "")
        if not aai.settings.api_key:
            raise ValueError("ASSEMBLYAI_API_KEY environment variable is not set")
        
        # Supported languages for rural India
        self.supported_languages = {
            'hi': 'Hindi',
            'en': 'English', 
            'bn': 'Bengali',
            'te': 'Telugu',
            'mr': 'Marathi',
            'ta': 'Tamil',
            'ur': 'Urdu',
            'gu': 'Gujarati',
            'kn': 'Kannada',
            'or': 'Odia',
            'pa': 'Punjabi',
            'as': 'Assamese',
        }
    
    def transcribe_audio(self, audio_file_path, language_code='hi'):
        """
        Transcribe audio file to text
        
        Args:
            audio_file_path: Path to audio file
            language_code: Language code (default: Hindi)
            
        Returns:
            dict: {
                'text': transcribed_text,
                'confidence': confidence_score,
                'language': detected_language,
                'success': True/False,
                'error': error_message if any
            }
        """
        try:
            # Validate and sanitize language code
            if not language_code or language_code not in self.supported_languages:
                language_code = 'hi'  # Default to Hindi
            
            # Configuration for multilingual transcription
            config = aai.TranscriptionConfig(
                language_code=language_code,
                punctuate=True,
                format_text=True,
                speaker_labels=True,  # Identify different speakers
                auto_chapters=False,  # Don't break into chapters
            )
            
            transcriber = aai.Transcriber()
            transcript = transcriber.transcribe(audio_file_path, config=config)
            
            if transcript.status == aai.TranscriptStatus.error:
                return {
                    'success': False,
                    'error': f"Transcription failed: {transcript.error}",
                    'text': '',
                    'confidence': 0,
                    'language': language_code
                }
            
            return {
                'success': True,
                'text': transcript.text,
                'confidence': transcript.confidence if hasattr(transcript, 'confidence') else 0.8,
                'language': language_code,
                'error': None,
                'word_count': len(transcript.text.split()) if transcript.text else 0
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'text': '',
                'confidence': 0,
                'language': language_code
            }
    
    def transcribe_from_django_file(self, django_file, language_code='hi'):
        """
        Transcribe audio from Django FileField/InMemoryUploadedFile
        
        Args:
            django_file: Django file object
            language_code: Language code
            
        Returns:
            dict: Transcription result
        """
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                for chunk in django_file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name
            
            # Transcribe
            result = self.transcribe_audio(temp_file_path, language_code)
            
            # Cleanup
            os.unlink(temp_file_path)
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': f"File processing error: {str(e)}",
                'text': '',
                'confidence': 0,
                'language': language_code
            }
    
    def detect_language(self, audio_file_path):
        """
        Auto-detect language from audio file
        Currently uses Hindi as default, can be enhanced with language detection
        """
        # For now, return Hindi as most common rural language
        # This can be enhanced with actual language detection
        return 'hi'
    
    def get_language_name(self, language_code):
        """Get human readable language name"""
        return self.supported_languages.get(language_code, 'Unknown')

class ComplaintProcessor:
    """Process complaints with AI analysis"""
    
    def __init__(self):
        self.speech_service = SpeechToTextService()
        
        # Gap type keywords for AI classification
        self.gap_type_keywords = {
            'healthcare': ['doctor', 'medicine', 'hospital', 'health', 'clinic', 'treatment', 'डॉक्टर', 'अस्पताल', 'दवा'],
            'education': ['school', 'teacher', 'books', 'study', 'education', 'स्कूल', 'शिक्षक', 'पढ़ाई'],
            'infrastructure': ['road', 'bridge', 'water', 'electricity', 'construction', 'सड़क', 'पुल', 'पानी', 'बिजली'],
            'agriculture': ['farming', 'crops', 'seeds', 'irrigation', 'fertilizer', 'किसान', 'फसल', 'खेती'],
            'welfare': ['pension', 'subsidy', 'ration', 'benefits', 'welfare', 'पेंशन', 'राशन', 'लाभ'],
            'connectivity': ['internet', 'mobile', 'network', 'communication', 'phone', 'इंटरनेट', 'फोन'],
            'load_transport': ['transport', 'bus', 'vehicle', 'loading', 'goods', 'परिवहन', 'बस', 'सामान'],
            'livelihood_skill': ['job', 'employment', 'skill', 'training', 'work', 'नौकरी', 'काम', 'प्रशिक्षण']
        }
    
    def analyze_complaint(self, complaint_text):
        """
        Analyze complaint text and classify gap type, priority
        
        Args:
            complaint_text: Text to analyze
            
        Returns:
            dict: Analysis results
        """
        text_lower = complaint_text.lower()
        
        # Detect gap type
        detected_type = 'other'
        max_matches = 0
        
        for gap_type, keywords in self.gap_type_keywords.items():
            matches = sum(1 for keyword in keywords if keyword.lower() in text_lower)
            if matches > max_matches:
                max_matches = matches
                detected_type = gap_type
        
        # Determine priority based on urgency keywords
        priority = 'medium'
        urgent_keywords = ['urgent', 'emergency', 'immediate', 'critical', 'जरूरी', 'आपातकाल']
        high_keywords = ['important', 'serious', 'problem', 'issue', 'महत्वपूर्ण', 'समस्या']
        
        if any(keyword in text_lower for keyword in urgent_keywords):
            priority = 'urgent'
        elif any(keyword in text_lower for keyword in high_keywords):
            priority = 'high'
        elif len(complaint_text) < 50:  # Very short complaints might be low priority
            priority = 'low'
        
        return {
            'gap_type': detected_type,
            'priority': priority,
            'keywords_found': max_matches,
            'analysis_confidence': min(max_matches * 0.2 + 0.3, 1.0)  # Confidence score
        }
    
    def process_audio_complaint(self, audio_file, language_code='hi'):
        """
        Complete processing of audio complaint
        
        Args:
            audio_file: Django audio file
            language_code: Language code
            
        Returns:
            dict: Complete processing result
        """
        # Validate and sanitize language code
        if not language_code or language_code == "":
            language_code = 'hi'
        
        # Ensure language code is supported
        supported_langs = ['hi', 'en', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'or', 'pa', 'as']
        if language_code not in supported_langs:
            language_code = 'hi'
        
        # Transcribe audio
        transcription_result = self.speech_service.transcribe_from_django_file(
            audio_file, language_code
        )
        
        if not transcription_result['success']:
            return {
                'success': False,
                'error': transcription_result['error'],
                'transcription': None,
                'analysis': None
            }
        
        # Analyze transcribed text
        analysis = self.analyze_complaint(transcription_result['text'])
        
        return {
            'success': True,
            'error': None,
            'transcription': transcription_result,
            'analysis': analysis,
            'processed_text': transcription_result['text'],
            'detected_type': analysis['gap_type'],
            'priority_level': analysis['priority']
        }

# Usage example:
"""
# In views.py or management commands:

from .services import ComplaintProcessor

processor = ComplaintProcessor()

# For audio complaints
result = processor.process_audio_complaint(audio_file, 'hi')
if result['success']:
    complaint = Complaint.objects.create(
        complaint_text=result['processed_text'],
        audio_transcription=result['processed_text'],
        complaint_type=result['detected_type'],
        priority_level=result['priority_level'],
        # ... other fields
    )
"""