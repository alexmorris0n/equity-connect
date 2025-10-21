# Test Nylas API with CORRECT format
# Uses proper query parameters and Unix timestamps

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
Write-Host "Testing Nylas API with CORRECT format..." -ForegroundColor Cyan
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

# Test 1: Create event with calendar_id as QUERY parameter
Write-Host "Test 1: Creating event with correct format..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/events?calendar_id=$calendar_id"
    
    # Convert to Unix timestamps
    $startTime = [DateTimeOffset]::new((Get-Date).AddHours(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddHours(2)).ToUnixTimeSeconds()
    
    $body = @{
        title = "Nylas API Test Event"
        busy = $true
        description = "Test event created via API"
        when = @{
            start_time = $startTime
            end_time = $endTime
            start_timezone = "America/New_York"
            end_timezone = "America/New_York"
        }
    } | ConvertTo-Json -Depth 3
    
    Write-Host "Request URL: $url"
    Write-Host "Request body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Test event created" -ForegroundColor Green
    Write-Host "Event ID: $($response.id)"
    Write-Host "Event Title: $($response.title)"
    
    # Clean up - delete the test event
    Write-Host "Cleaning up test event..."
    $deleteUrl = "https://api.us.nylas.com/v3/grants/$grant_id/events/$($response.id)"
    Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method Delete
    Write-Host "Test event deleted successfully" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: Check availability with CORRECT endpoint
Write-Host "Test 2: Testing availability with correct endpoint..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/availability"
    
    # Convert to Unix timestamps
    $startTime = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
    
    $body = @{
        participants = @(
            @{
                email = "alex@instaroute.com"
                calendar_ids = @($calendar_id)
            }
        )
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
    } | ConvertTo-Json -Depth 3
    
    Write-Host "Request URL: $url"
    Write-Host "Request body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Availability check works" -ForegroundColor Green
    Write-Host "Available slots: $($response.data.Count)"
    
    if ($response.data.Count -gt 0) {
        Write-Host "First available slot: $($response.data[0].start_time)"
    }
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Corrected API test complete!" -ForegroundColor Cyan
