# Test Nylas availability with CORRECT payload format
# Uses RFC3339 time strings and proper participant structure

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
$email = "alex@instaroute.com"

Write-Host ""
Write-Host "Testing Nylas availability with CORRECT format..." -ForegroundColor Cyan
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

# Test 1: /v3/calendars/availability with RFC3339 time strings
Write-Host "Test 1: /v3/calendars/availability with RFC3339 times..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/calendars/availability"
    
    # Use RFC3339 format for times
    $startTime = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $endTime = (Get-Date).AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    $body = @{
        participants = @(
            @{
                email = $email
                calendar_ids = @("primary")
            }
        )
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
    } | ConvertTo-Json -Depth 3
    
    Write-Host "URL: $url"
    Write-Host "Body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! /v3/calendars/availability works" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: /v3/scheduling/availability with RFC3339 time strings
Write-Host "Test 2: /v3/scheduling/availability with RFC3339 times..." -ForegroundColor Yellow
try {
    $url = "https://api.us.nylas.com/v3/scheduling/availability"
    
    # Use RFC3339 format for times
    $startTime = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $endTime = (Get-Date).AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    $body = @{
        participants = @(
            @{
                email = $email
                calendar_ids = @("primary")
            }
        )
        start_time = $startTime
        end_time = $endTime
        duration_minutes = 30
    } | ConvertTo-Json -Depth 3
    
    Write-Host "URL: $url"
    Write-Host "Body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! /v3/scheduling/availability works" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Correct format availability test complete!" -ForegroundColor Cyan
