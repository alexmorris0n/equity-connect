# Get detailed error message from availability endpoint
# Captures the full response body to see what's wrong

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
Write-Host "Getting detailed availability error..." -ForegroundColor Cyan
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

# Test availability with detailed error capture
Write-Host "Testing availability with error details..." -ForegroundColor Yellow
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
    
    Write-Host "Request body: $body"
    
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $body
    Write-Host "SUCCESS! Availability works" -ForegroundColor Green
    
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    
    # Capture the full error response
    if ($_.Exception.Response) {
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            Write-Host ""
            Write-Host "=== DETAILED ERROR RESPONSE ===" -ForegroundColor Red
            Write-Host $responseBody -ForegroundColor Red
            Write-Host "=== END ERROR RESPONSE ===" -ForegroundColor Red
            Write-Host ""
            
            # Try to parse as JSON for structured error
            try {
                $errorJson = $responseBody | ConvertFrom-Json
                Write-Host "Parsed error:" -ForegroundColor Yellow
                Write-Host "Type: $($errorJson.type)" -ForegroundColor Yellow
                Write-Host "Message: $($errorJson.message)" -ForegroundColor Yellow
                if ($errorJson.details) {
                    Write-Host "Details: $($errorJson.details)" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "Could not parse error as JSON" -ForegroundColor Yellow
            }
            
        } catch {
            Write-Host "Could not read error response" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Availability error analysis complete!" -ForegroundColor Cyan
