# Simple Nylas API Test
# Tests if the grant_id and API key work together

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
Write-Host "Testing Nylas API..." -ForegroundColor Cyan
Write-Host "Grant ID: $grant_id"
Write-Host ""

if (-Not $NYLAS_API_KEY) {
    Write-Host "ERROR: NYLAS_API_KEY not set in .env" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $NYLAS_API_KEY"
}

try {
    $url = "https://api.us.nylas.com/v3/grants/$grant_id/events?limit=5"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    
    Write-Host "SUCCESS! Got calendar events" -ForegroundColor Green
    Write-Host "Total events: $($response.data.Count)"
    
    if ($response.data.Count -gt 0) {
        Write-Host ""
        Write-Host "First event:"
        Write-Host "  Title: $($response.data[0].title)"
    }
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Next: Import n8n workflow and test webhooks!" -ForegroundColor Yellow
Write-Host ""

