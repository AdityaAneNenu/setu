#!/bin/bash

echo "Starting SETU Mobile App..."
echo ""
echo "Make sure you have:"
echo "  1. Node.js installed"
echo "  2. npm installed"
echo "  3. Expo Go app on your phone"
echo ""

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Starting Expo development server..."
npx expo start
