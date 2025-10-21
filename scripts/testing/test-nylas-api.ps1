# Test Nylas API with Grant ID
# Quick test to verify the grant_id works

Write-Host ""
Write-Host "🧪 Testing Nylas API Connection" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

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

if (-Not $NYLAS_API_KEY -or $NYLAS_API_KEY -eq "your_nylas_api_key_here") {
    Write-Host "❌ NYLAS_API_KEY not set in .env" -ForegroundColor Red
    exit 1
}

Write-Host "✅ API Key found: $($NYLAS_API_KEY.Substring(0,15))..." -ForegroundColor Green
Write-Host "✅ Grant ID: $grant_id" -ForegroundColor Green
Write-Host ""

# Test 1: Get calendar events
Write-Host "📅 Test 1: Fetching calendar events..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $NYLAS_API_KEY"
    "Content-Type" = "application/json"
}

try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/events?limit=5"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    
    Write-Host "✅ Success! Got calendar events:" -ForegroundColor Green
    Write-Host ""
    Write-Host "Total events: $($response.data.Count)" -ForegroundColor White
    
    if ($response.data.Count -gt 0) {
        Write-Host ""
        Write-Host "First event:" -ForegroundColor Yellow
        $event = $response.data[0]
        Write-Host "  Title: $($event.title)" -ForegroundColor White
        Write-Host "  Start: $($event.when.start_time)" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Failed to get events" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Nylas API Test: PASSED" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Import n8n workflow (see N8N_IMPORT_INSTRUCTIONS.md)" -ForegroundColor White
Write-Host "  2. Test availability webhook" -ForegroundColor White
Write-Host "  3. Test booking webhook" -ForegroundColor White
Write-Host ""

