# Run this as Administrator to allow Django through Windows Firewall
Write-Host "Removing old firewall rules..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "Django Development Server" -ErrorAction SilentlyContinue

Write-Host "Adding new firewall rules..." -ForegroundColor Green
New-NetFirewallRule -DisplayName "Django Development Server" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Django Development Server Out" -Direction Outbound -LocalPort 8000 -Protocol TCP -Action Allow

Write-Host "Firewall rules added successfully!" -ForegroundColor Green
Write-Host "Django server on port 8000 is now accessible from other devices on your network." -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

