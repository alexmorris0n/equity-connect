# Debug event deletion issue
# Tests event creation and immediate deletion to avoid provider sync issues

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
Write-Host "Debugging event deletion..." -ForegroundColor Cyan
Write-Host ""

if (-Not $NYLAS_API_KEY) {
    Write-Host "ERROR: NYLAS_API_KEY not set in .env" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $NYLAS_API_KEY"
    "Content-Type" = "application/json"
    "Accept" = "application/json, application/gzip"
}

# Step 1: Create event and get full response
Write-Host "Step 1: Creating event..." -ForegroundColor Yellow
$eventId = $null
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/events?calendar_id=$calendar_id"
    
    $startTime = [DateTimeOffset]::new((Get-Date).AddHours(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddHours(2)).ToUnixTimeSeconds()
    
    $body = @{
        title = "Deletion Test Event"
        busy = $true
        description = "Test event for deletion debugging"
        when = @{
            start_time = $startTime
            end_time = $endTime
            start_timezone = "America/New_York"
            end_timezone = "America/New_York"
        }
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    $eventId = $response.id
    Write-Host "SUCCESS! Event created" -ForegroundColor Green
    Write-Host "Event ID: $eventId"
    Write-Host "Full response: $($response | ConvertTo-Json -Depth 3)"
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Immediately verify event exists
Write-Host "Step 2: Verifying event exists..." -ForegroundColor Yellow
try {
    $getUrl = "https://api.us.nylas.com/v3/grants/$grant_id/events/$eventId"
    $getResponse = Invoke-RestMethod -Uri $getUrl -Headers $headers -Method Get
    Write-Host "SUCCESS! Event exists and is accessible" -ForegroundColor Green
    Write-Host "Event title: $($getResponse.title)"
    
} catch {
    Write-Host "FAILED: Event not found immediately after creation" -ForegroundColor Red
    Write-Host "This suggests provider sync issues" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Try deletion with correct headers
Write-Host "Step 3: Attempting deletion..." -ForegroundColor Yellow
try {
    $deleteUrl = "https://api.us.nylas.com/v3/grants/$grant_id/events/$eventId"
    Write-Host "Delete URL: $deleteUrl"
    
    # Use minimal headers as per MCP documentation
    $deleteHeaders = @{
        "Authorization" = "Bearer $NYLAS_API_KEY"
        "Content-Type" = "application/json"
    }
    
    Invoke-RestMethod -Uri $deleteUrl -Headers $deleteHeaders -Method Delete
    Write-Host "SUCCESS! Event deleted" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Deletion debug complete!" -ForegroundColor Cyan
