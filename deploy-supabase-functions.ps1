# Deploy Nylas Supabase Edge Functions
# Run this in PowerShell

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Deploy Nylas Edge Functions" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabase = Get-Command supabase -ErrorAction SilentlyContinue

if (-Not $supabase) {
    Write-Host "❌ Supabase CLI not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install with: npm install -g supabase" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ Supabase CLI found" -ForegroundColor Green
Write-Host ""

# Load .env file
if (Test-Path ".env") {
    Write-Host "📋 Loading environment variables from .env..." -ForegroundColor Cyan
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#].+?)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
    Write-Host "✅ Environment loaded" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env file not found - using existing environment" -ForegroundColor Yellow
}

Write-Host ""

# Deploy functions
Write-Host "🚀 Deploying nylas-auth-url function..." -ForegroundColor Cyan
supabase functions deploy nylas-auth-url

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Failed to deploy nylas-auth-url" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running: supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🚀 Deploying nylas-callback function..." -ForegroundColor Cyan
supabase functions deploy nylas-callback

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Failed to deploy nylas-callback" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Both functions deployed successfully!" -ForegroundColor Green
Write-Host ""

# Set secrets
Write-Host "🔐 Setting environment secrets..." -ForegroundColor Cyan

if ($env:NYLAS_CLIENT_ID -and $env:NYLAS_CLIENT_ID -ne "your_nylas_client_id_here") {
    Write-Host "  Setting NYLAS_CLIENT_ID..." -ForegroundColor Gray
    supabase secrets set NYLAS_CLIENT_ID=$env:NYLAS_CLIENT_ID
}

if ($env:NYLAS_CLIENT_SECRET -and $env:NYLAS_CLIENT_SECRET -ne "your_nylas_client_secret_here") {
    Write-Host "  Setting NYLAS_CLIENT_SECRET..." -ForegroundColor Gray
    supabase secrets set NYLAS_CLIENT_SECRET=$env:NYLAS_CLIENT_SECRET
}

if ($env:NYLAS_API_KEY -and $env:NYLAS_API_KEY -ne "your_nylas_api_key_here") {
    Write-Host "  Setting NYLAS_API_KEY..." -ForegroundColor Gray
    supabase secrets set NYLAS_API_KEY=$env:NYLAS_API_KEY
}

if ($env:NYLAS_REDIRECT_URI) {
    Write-Host "  Setting NYLAS_REDIRECT_URI..." -ForegroundColor Gray
    supabase secrets set NYLAS_REDIRECT_URI=$env:NYLAS_REDIRECT_URI
}

Write-Host ""
Write-Host "✅ Secrets configured!" -ForegroundColor Green
Write-Host ""

# List functions to verify
Write-Host "📋 Verifying deployment..." -ForegroundColor Cyan
supabase functions list

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Supabase Functions Deployed!      ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Import n8n workflow (see RUN_THIS_NOW.md)" -ForegroundColor White
Write-Host "  2. Test OAuth flow with a broker" -ForegroundColor White
Write-Host ""

