# AI Processing Setup Guide

## Overview
The AI processing feature has been added to automatically analyze photos and audio recordings to generate descriptions and categorize gaps.

## What Was Fixed
- ❌ **Before**: Media uploads created gaps without AI processing
- ✅ **After**: Photos/audio are analyzed by Gemini AI to auto-fill description, gap type, and severity

## Architecture
1. **Mobile App** → Captures photo/audio
2. **Mobile App** → Uploads to Cloudinary (free CDN)
3. **Mobile App** → Calls Django AI endpoint with media URL
4. **Django Backend** → Downloads media → Analyzes with Gemini AI
5. **Django Backend** → Returns suggestions (description, gap_type, severity)
6. **Mobile App** → Auto-fills form → User can edit → Submit to Firestore

## Setup Steps

### 1. Install Python Dependencies
```bash
cd e:\setu-pm-ajay-main\setu-pm-ajay-main
pip install -r requirements.txt
```

This will install:
- `google-generativeai==0.8.3` - For Gemini AI image/text analysis
- `assemblyai==0.48.1` - For audio transcription (already installed)
- Other dependencies

### 2. Get API Keys

#### Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key

#### AssemblyAI API Key
1. Go to [AssemblyAI](https://www.assemblyai.com/)
2. Sign up for a free account
3. Go to Dashboard → API Keys
4. Copy your API key

### 3. Configure Environment Variables

Create a `.env` file in the project root (if it doesn't exist):

```bash
# Copy from example
copy .env.example .env
```

Edit `.env` and add your API keys:

```env
# Google Gemini AI for image/text analysis
GEMINI_API_KEY=your-gemini-api-key-here

# AssemblyAI for speech-to-text
ASSEMBLYAI_API_KEY=your-assemblyai-api-key-here

# Firebase (keep your existing values)
FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json
FIREBASE_STORAGE_BUCKET=setu-pm.firebasestorage.app
```

### 4. Start Django Server

```bash
python manage.py runserver
```

The server should start on `http://localhost:8000` or `http://127.0.0.1:8000`

### 5. Configure Mobile App for Django Connection

The mobile app is configured to connect to Django backend for AI processing:

- **Android Emulator**: Uses `http://10.0.2.2:8000` (already configured)
- **iOS Simulator**: Uses `http://localhost:8000` (already configured)
- **Physical Device**: You need to update the URL

#### For Physical Device Testing:

1. Find your computer's IP address:
   ```bash
   # Windows
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

2. Edit `mobile-app/src/config/api.js`:
   ```javascript
   // Change this line for physical device testing
   return 'http://YOUR-COMPUTER-IP:8000';
   // Example: 'http://192.168.1.100:8000'
   ```

3. Make sure your phone and computer are on the same WiFi network

### 6. Test the Flow

1. **Start Django server**: `python manage.py runserver`
2. **Start mobile app**: Run from Expo Go or emulator
3. **Login** with Firebase Auth credentials:
   - Username: `ground1` (or `admin1`, `manager1`)
   - Password: `setu1234`
4. **Navigate to "Report Gap"**
5. **Capture photo or audio**
6. **Watch for AI processing**:
   - Banner shows "✨ AI Processing..."
   - After 3-10 seconds, form auto-fills
   - Alert shows: "AI Analysis Complete"
7. **Review AI suggestions**:
   - Description (auto-generated)
   - Gap Type (auto-detected)
   - Severity (auto-assessed)
8. **Edit if needed** and submit

## Troubleshooting

### "GEMINI_API_KEY not configured" error
- Check `.env` file exists in project root
- Verify `GEMINI_API_KEY=your-key` is present
- Restart Django server after adding the key

### "AI Processing Failed" in mobile app
- Check Django server is running (`http://localhost:8000`)
- For Android emulator, verify URL is `http://10.0.2.2:8000`
- Check Django terminal for detailed error messages
- Verify Cloudinary URLs are publicly accessible (they are by default)

### "Failed to download image/audio from URL"
- Cloudinary files are publicly readable by default
- Ensure the uploaded file URL is valid
- Check network connectivity

### Network connection issues
- Android emulator: Must use `10.0.2.2` not `localhost`
- Physical device: Must use computer's LAN IP, not `localhost`
- Firewall: Ensure port 8000 is not blocked

## Testing Checklist

- [ ] Django server runs without errors
- [ ] Gemini AI key is configured
- [ ] AssemblyAI key is configured
- [ ] Mobile app connects to Django (check terminal logs)
- [ ] Photo upload → AI processes → form auto-fills
- [ ] Audio upload → AI processes → form auto-fills
- [ ] Can edit AI suggestions before submitting
- [ ] Gap is saved to Firestore with correct data

## What the AI Does

### For Images (Photos)
1. Downloads image from Cloudinary CDN
2. Uploads to Gemini Vision API
3. Analyzes: "What infrastructure problem is shown?"
4. Returns:
   - Description: "Pothole on main road causing traffic issues"
   - Gap Type: "road"
   - Severity: "high"
   - Confidence: 0.85

### For Audio (Voice)
1. Downloads audio from Cloudinary CDN
2. Transcribes using AssemblyAI (supports Hindi, English, and 10+ Indian languages)
3. Analyzes transcription with Gemini AI
4. Returns:
   - Transcription: "सड़क पर गड्ढा है..."
   - Description: "Road has potholes causing problems"
   - Gap Type: "road"
   - Severity: "medium"
   - Confidence: 0.78

## Cost Considerations

### Google Gemini API
- **Free Tier**: 60 requests per minute
- **Cost**: $0.00 for free tier
- Sufficient for development and small-scale testing

### AssemblyAI
- **Free Tier**: First 100 hours/month free
- **Cost**: $0.00 for free tier
- Sufficient for development and testing

## Next Steps

1. Get API keys and configure `.env`
2. Test with sample photos/audio
3. Monitor Django terminal for any errors
4. Fine-tune AI prompts if needed (in `core/api_views.py`)
5. Consider caching AI results to reduce API calls

## Support

If you encounter issues:
1. Check Django terminal for detailed error messages
2. Check mobile app console logs (Metro bundler)
3. Verify all environment variables are set
4. Test with simple images/audio first
