@echo off
echo Starting SETU Mobile App...
echo.
echo Make sure you have:
echo   1. Node.js installed
echo   2. npm installed
echo   3. Expo Go app on your phone
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo Installing dependencies...
    npm install
    echo.
)

echo Starting Expo development server...
npx expo start

pause
