// Mobile App Security Configuration Guide
// ===============================================
// 
// CRITICAL: This file shows how to properly configure
// environment variables for React Native/Expo apps
// 
// BEFORE: Credentials were hardcoded in source (SECURITY RISK)
// AFTER: Use this pattern for secure credential management

// 1. Install expo-constants
// npm install expo-constants

// 2. Update your app.config.js:
export default {
  expo: {
    name: "SETU PM-AJAY",
    slug: "setu-pm-ajay",
    // ... other config
    extra: {
      // Firebase Configuration
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID,
      
      // Cloudinary Configuration
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
      cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
      
      // Environment
      eas: {
        projectId: "your-eas-project-id"
      }
    }
  }
};

// 3. Set EAS Secrets (for production builds):
// eas secret:create --scope project --name FIREBASE_API_KEY --value your-actual-key
// eas secret:create --scope project --name FIREBASE_PROJECT_ID --value your-project-id
// eas secret:create --scope project --name CLOUDINARY_CLOUD_NAME --value your-cloud-name
// ... etc for all credentials

// 4. For local development, create .env:
// FIREBASE_API_KEY=your-dev-key
// FIREBASE_PROJECT_ID=your-dev-project
// CLOUDINARY_CLOUD_NAME=your-dev-cloud

// 5. Your source code will now use Constants.expoConfig.extra instead of hardcoded values
// This is already implemented in firebase.js and cloudinaryService.js