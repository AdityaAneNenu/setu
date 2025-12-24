import requests
import os
import json

# Test the photo upload API
url = "http://192.168.61.128:8000/api/upload-photo/"

# Use an existing QR code image as test photo
photo_path = "media/qr_codes/qr_PMC-GAP-12.png"

if not os.path.exists(photo_path):
    print(f"Error: Photo file not found at {photo_path}")
    exit(1)

# Prepare the data
data = {
    'complaint_id': 'PMC-GAP-12',
    'latitude': '28.4595',
    'longitude': '77.0266',
}

# Prepare the file
with open(photo_path, 'rb') as photo_file:
    files = {
        'photo': ('test_photo.png', photo_file, 'image/png')
    }
    
    print(f"Uploading photo to {url}")
    print(f"Data: {data}")
    
    response = requests.post(url, data=data, files=files)
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 400:
        print("\n❌ 400 Bad Request Error!")
        try:
            error_data = response.json()
            print(f"Error details: {error_data}")
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Raw response: {response.text}")
    elif response.status_code == 201:
        print("\n✅ Photo uploaded successfully!")
    else:
        print(f"\n⚠️ Unexpected status code: {response.status_code}")

