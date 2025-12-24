@echo off
echo ========================================
echo PM-AJAY Mobile App - Quick Start
echo ========================================
echo.
echo Starting Expo development server...
echo.
echo Make sure:
echo 1. Django server is running on port 8000
echo 2. Your phone has Expo Go installed
echo 3. Phone is on same WiFi network
echo.
echo ========================================
echo.
cd /d "%~dp0"
npx expo start
