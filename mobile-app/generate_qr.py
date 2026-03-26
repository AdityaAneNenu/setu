#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import qrcode

# Generate QR code for Expo connection
expo_url = "exp://192.168.1.114:8081"
qr = qrcode.QRCode(version=1, box_size=10, border=4)
qr.add_data(expo_url)
qr.make(fit=True)

# Save as image
qr_path = "qr_code.png"
img = qr.make_image(fill_color="black", back_color="white")
img.save(qr_path)

print("QR Code generated: " + qr_path)
print("Expo URL: " + expo_url)
print("\nQR Code (ASCII art):\n")
qr_ascii = qrcode.QRCode(version=1, box_size=1, border=2)
qr_ascii.add_data(expo_url)
qr_ascii.make(fit=True)
qr_ascii.print_ascii()
