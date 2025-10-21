# Test Nylas API based on MCP documentation
# Fixes event deletion and tests both availability endpoints

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
Write-Host "Testing Nylas API based on MCP documentation..." -ForegroundColor Cyan
Write-Host "Grant ID: $grant_id"
Write-Host "Calendar ID: $calendar_id"
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

# Test 1: Create event (we know this works)
Write-Host "Test 1: Creating event..." -ForegroundColor Yellow
$eventId = $null
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/events?calendar_id=$calendar_id"
    
    $startTime = [DateTimeOffset]::new((Get-Date).AddHours(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddHours(2)).ToUnixTimeSeconds()
    
    $body = @{
        title = "MCP Test Event"
        busy = $true
        description = "Test event for MCP comparison"
        when = @{
            start_time = $startTime
            end_time = $endTime
            start_timezone = "America/New_York"
            end_timezone = "America/New_York"
        }
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    $eventId = $response.id
    Write-Host "SUCCESS! Event created with ID: $eventId" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Delete event with CORRECT headers (from MCP)
Write-Host "Test 2: Deleting event with correct headers..." -ForegroundColor Yellow
try {
    $deleteUrl = "https://api.us.nylas.com/v3/grants/$grant_id/events/$eventId"
    Write-Host "Delete URL: $deleteUrl"
    
    # Use the exact headers from MCP
    $deleteHeaders = @{
        "Authorization" = "Bearer $NYLAS_API_KEY"
        "Content-Type" = "application/json"
    }
    
    Invoke-RestMethod -Uri $deleteUrl -Headers $deleteHeaders -Method Delete
    Write-Host "SUCCESS! Event deleted successfully" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 3: Availability endpoint from MCP search results
Write-Host "Test 3: Availability with grant-specific endpoint..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/calendars/availability"
    
    $startTime = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
    
    $body = @{
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
    } | ConvertTo-Json
    
    Write-Host "URL: $url"
    Write-Host "Body: $body"
    
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

# Test 4: Availability endpoint from MCP generate-endpoint-code
Write-Host "Test 4: Availability with general endpoint..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/availability"
    
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
    
    Write-Host "URL: $url"
    Write-Host "Body: $body"
    
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
Write-Host "MCP comparison test complete!" -ForegroundColor Cyan
