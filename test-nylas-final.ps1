# Final Nylas API test
# Tests event creation with simpler format and availability

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
$calendar_id = "alex@instaroute.com"

Write-Host ""
Write-Host "Final Nylas API test..." -ForegroundColor Cyan
Write-Host "Grant ID: $grant_id"
Write-Host "Calendar ID: $calendar_id"
Write-Host ""

if (-Not $NYLAS_API_KEY) {
    Write-Host "ERROR: NYLAS_API_KEY not set in .env" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $NYLAS_API_KEY"
    "Accept" = "application/json, application/gzip"
    "Content-Type" = "application/json"
}

# Test 1: Simple event creation
Write-Host "Test 1: Creating simple test event..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/events"
    
    $startTime = (Get-Date).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $endTime = (Get-Date).AddHours(1).AddMinutes(30).ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    # Simpler event format
    $body = @{
        title = "Test Event"
        when = @{
            start_time = $startTime
            end_time = $endTime
        }
        calendar_id = $calendar_id
    } | ConvertTo-Json -Depth 2
    
    Write-Host "Request body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Test event created" -ForegroundColor Green
    Write-Host "Event ID: $($response.id)"
    
    # Clean up
    Write-Host "Cleaning up..."
    $deleteUrl = "https://api.us.nylas.com/v3/grants/$grant_id/events/$($response.id)"
    Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method Delete
    Write-Host "Test event deleted" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: Try availability endpoint
Write-Host "Test 2: Testing availability..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/calendars/availability"
    
    $startTime = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $endTime = (Get-Date).AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    $body = @{
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
        calendar_ids = @($calendar_id)
    } | ConvertTo-Json -Depth 2
    
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
Write-Host "Final test complete!" -ForegroundColor Cyan
