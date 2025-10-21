# Test Nylas Calendars and Availability
# Tests calendar permissions and availability checking

# Load .env
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#].+?)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

$NYLAS_API_KEY = $env:NYLAS_API_KEY
$grant_id = "c18c3f0f-2cb2-4b39-bc87-3a72ee4f10aa"

Write-Host ""
Write-Host "Testing Nylas Calendar Access..." -ForegroundColor Cyan
Write-Host "Grant ID: $grant_id"
Write-Host ""

if (-Not $NYLAS_API_KEY) {
    Write-Host "ERROR: NYLAS_API_KEY not set in .env" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $NYLAS_API_KEY"
    "Content-Type" = "application/json"
}

# Test 1: List calendars
Write-Host "Test 1: Listing calendars..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/calendars"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "SUCCESS! Found $($response.data.Count) calendars" -ForegroundColor Green
    
    foreach ($calendar in $response.data) {
        Write-Host "  - $($calendar.name) (ID: $($calendar.id))"
    }
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Check availability (this is what we need for booking)
Write-Host "Test 2: Checking availability..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/calendars/availability"
    
    # Check availability for next 7 days
    $startTime = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $endTime = (Get-Date).AddDays(8).ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    $body = @{
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Availability check works" -ForegroundColor Green
    Write-Host "Available slots: $($response.data.Count)"
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Calendar test complete!" -ForegroundColor Cyan
