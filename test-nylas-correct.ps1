# Test Nylas API with correct parameters
# Uses proper calendar_id and headers as per Nylas v3 documentation

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
$calendar_id = "alex@instaroute.com"  # From our earlier calendar list

Write-Host ""
Write-Host "Testing Nylas API with correct parameters..." -ForegroundColor Cyan
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

# Test 1: Get events with calendar_id parameter
Write-Host "Test 1: Getting events with calendar_id..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/events?calendar_id=$calendar_id"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "SUCCESS! Found $($response.data.Count) events" -ForegroundColor Green
    
    if ($response.data.Count -gt 0) {
        Write-Host "First event: $($response.data[0].title)"
        Write-Host "Event ID: $($response.data[0].id)"
    } else {
        Write-Host "No events found in calendar"
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

# Test 2: Create a test event
Write-Host "Test 2: Creating test event..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/events"
    
    $startTime = (Get-Date).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $endTime = (Get-Date).AddHours(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    $body = @{
        title = "Nylas API Test Event"
        when = @{
            start_time = $startTime
            end_time = $endTime
        }
        calendar_id = $calendar_id
    } | ConvertTo-Json -Depth 3
    
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
Write-Host "Correct API test complete!" -ForegroundColor Cyan
