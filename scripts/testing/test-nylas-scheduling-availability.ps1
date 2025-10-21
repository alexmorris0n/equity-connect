# Test Nylas scheduling availability endpoint
# Uses the /v3/scheduling/availability endpoint with GET method

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
Write-Host "Testing Nylas scheduling availability..." -ForegroundColor Cyan
Write-Host "Grant ID: $grant_id"
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

# Test 1: Scheduling availability with GET method
Write-Host "Test 1: Scheduling availability (GET method)..." -ForegroundColor Yellow
try {
    $startTime = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
    
    $url = "https://api.us.nylas.com/v3/scheduling/availability?start_time=$startTime&end_time=$endTime&duration_minutes=30"
    
    Write-Host "URL: $url"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "SUCCESS! Scheduling availability works" -ForegroundColor Green
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

# Test 2: Try with grant_id parameter
Write-Host "Test 2: Scheduling availability with grant_id..." -ForegroundColor Yellow
try {
    $startTime = [DateTimeOffset]::new((Get-Date).AddDays(1)).ToUnixTimeSeconds()
    $endTime = [DateTimeOffset]::new((Get-Date).AddDays(2)).ToUnixTimeSeconds()
    
    $url = "https://api.us.nylas.com/v3/scheduling/availability?grant_id=$grant_id&start_time=$startTime&end_time=$endTime&duration_minutes=30"
    
    Write-Host "URL: $url"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Write-Host "SUCCESS! Scheduling availability with grant_id works" -ForegroundColor Green
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
Write-Host "Scheduling availability test complete!" -ForegroundColor Cyan
