# Test Nylas API using the correct endpoints from MCP
# Tests calendar events and availability

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
Write-Host "Testing Nylas API with MCP endpoints..." -ForegroundColor Cyan
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

# Test 1: Get events (from MCP)
Write-Host "Test 1: Getting calendar events..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/grants/$grant_id/events"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "SUCCESS! Found $($response.data.Count) events" -ForegroundColor Green
    
    if ($response.data.Count -gt 0) {
        Write-Host "First event: $($response.data[0].title)"
    }
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Check availability (from MCP)
Write-Host "Test 2: Checking availability..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/calendars/availability"
    
    $startTime = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $endTime = (Get-Date).AddDays(8).ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    $body = @{
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
        grant_id = $grant_id
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
Write-Host "MCP test complete!" -ForegroundColor Cyan
