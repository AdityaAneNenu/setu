# SETU Mobile App

React Native mobile application for the SETU (Smart Evaluation and Tracking Utility) platform.

## Features

- **Welcome Screen**: Clean onboarding with SETU branding
- **Login Screen**: Secure authentication
- **Home Screen**: Quick access to core features
- **Scan Document**: Camera-based document capture
- **Upload Audio**: Voice recording with language selection
- **Profile**: User profile management
- **Side Drawer**: Easy navigation with sign-out option

## Tech Stack

- **React Native** with Expo SDK 52
- **React Navigation** (Stack, Drawer, Bottom Tabs)
- **Expo Camera** for document scanning
- **Expo AV** for audio recording
- **Expo Image Picker** for photo uploads

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm or yarn
- Expo CLI
- Expo Go app on your mobile device

### Installation

1. Navigate to the mobile-app directory:
   ```bash
   cd mobile-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

4. Scan the QR code with Expo Go (Android) or Camera app (iOS)

### Running on Emulator

- **Android**: Press `a` in the terminal
- **iOS**: Press `i` in the terminal (macOS only)

## Project Structure

```
mobile-app/
├── App.js                    # Main app with navigation
├── app.json                  # Expo configuration
├── package.json              # Dependencies
├── babel.config.js           # Babel configuration
└── src/
    ├── components/
    │   └── CustomDrawer.js   # Side drawer component
    ├── config/
    │   └── index.js          # App configuration
    ├── context/
    │   └── AuthContext.js    # Authentication context
    ├── screens/
    │   ├── WelcomeScreen.js
    │   ├── LoginScreen.js
    │   ├── HomeScreen.js
    │   ├── ScanDocumentScreen.js
    │   ├── UploadAudioScreen.js
    │   ├── ProfileScreen.js
    │   ├── PrivacyPolicyScreen.js
    │   └── SecurityScreen.js
    └── services/
        ├── api.js            # API service
        └── storage.js        # Local storage service
```

## Configuration

Update the API base URL in `src/config/index.js`:

```javascript
export const API_BASE_URL = 'http://your-server-ip:8000';
```

## Screens Overview

### 1. Welcome Screen
- SETU logo and branding
- Illustrated welcome graphics
- "Get Started" button to proceed to login

### 2. Login Screen
- Email and password input
- "Forgot password" link
- Login button with loading state

### 3. Home Screen
- Greeting with user name
- Scan Document card
- Upload Audio card
- Bottom tab navigation

### 4. Scan Document Screen
- Camera preview area
- Capture document button
- Upload from gallery option

### 5. Upload Audio Screen
- Language selection (Telugu, Hindi, Tamil, Kannada)
- Audio waveform visualization
- Start/Stop recording button
- Upload audio file option

### 6. Profile Screen
- User avatar and info
- Edit profile, notifications, language, help options
- Sign out button

### 7. Side Drawer
- User profile section
- Navigation links
- Sign out option

## Supported Languages

- Telugu
- Hindi
- Tamil
- Kannada
- English
- Bengali
- Marathi

## Permissions Required

- **Camera**: For document scanning
- **Microphone**: For audio recording
- **Location**: For geo-tagging submissions (optional)

## Building for Production

### Android APK
```bash
npx expo build:android -t apk
```

### Android App Bundle
```bash
npx expo build:android -t app-bundle
```

### iOS
```bash
npx expo build:ios
```

## License

Part of the SETU project - Smart India Hackathon 2025
