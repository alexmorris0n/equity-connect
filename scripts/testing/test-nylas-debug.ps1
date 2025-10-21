# Debug Nylas API Test
# Tests different endpoints and shows detailed error info

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
Write-Host "🔍 Debugging Nylas API..." -ForegroundColor Cyan
Write-Host "Grant ID: $grant_id"
Write-Host "API Key: $($NYLAS_API_KEY.Substring(0,10))..."
Write-Host ""

if (-Not $NYLAS_API_KEY) {
    Write-Host "ERROR: NYLAS_API_KEY not set in .env" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $NYLAS_API_KEY"
    "Content-Type" = "application/json"
}

# Test 1: Get grant info
Write-Host "Test 1: Getting grant info..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "✅ Grant info retrieved successfully!" -ForegroundColor Green
    Write-Host "Grant email: $($response.email)"
    Write-Host "Grant provider: $($response.provider)"
} catch {
    Write-Host "❌ Grant info failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: Get calendar events
Write-Host "Test 2: Getting calendar events..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/events?limit=3"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "✅ Calendar events retrieved successfully!" -ForegroundColor Green
    Write-Host "Total events: $($response.data.Count)"
    
    if ($response.data.Count -gt 0) {
        Write-Host ""
        Write-Host "First event:"
        Write-Host "  Title: $($response.data[0].title)"
        Write-Host "  Start: $($response.data[0].when.start_time)"
    }
} catch {
    Write-Host "❌ Calendar events failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Cyan
