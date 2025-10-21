# Debug availability endpoint to see exact error
# Tests different availability request formats

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
Write-Host "Debugging availability endpoint..." -ForegroundColor Cyan
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

# Test 1: Minimal availability request
Write-Host "Test 1: Minimal availability request..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/availability"
    
    $body = @{
        participants = @(
            @{
                email = "alex@instaroute.com"
            }
        )
        start_time = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
        end_time = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
        duration_minutes = 30
    } | ConvertTo-Json -Depth 3
    
    Write-Host "Request: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Availability works" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: Try with different participant format
Write-Host "Test 2: Different participant format..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/availability"
    
    $body = @{
        participants = @(
            @{
                email = "alex@instaroute.com"
                calendar_ids = @("primary")
            }
        )
        start_time = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
        end_time = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
        duration_minutes = 30
    } | ConvertTo-Json -Depth 3
    
    Write-Host "Request: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Availability works" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Availability debug complete!" -ForegroundColor Cyan
