# Nylas Calendar Integration - Deployment Script for Windows PowerShell
# Run this script to deploy the Nylas calendar integration

Write-Host "🚀 Nylas Calendar Integration - Deployment Script" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-Not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Creating .env from template..." -ForegroundColor Yellow
    Copy-Item "env.template" ".env"
    Write-Host "✅ .env file created from template" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Edit .env and add your Nylas credentials" -ForegroundColor Yellow
    Write-Host "   - NYLAS_CLIENT_ID" -ForegroundColor Yellow
    Write-Host "   - NYLAS_CLIENT_SECRET" -ForegroundColor Yellow
    Write-Host "   - NYLAS_API_KEY" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to open .env file for editing..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    notepad ".env"
    Write-Host ""
    Write-Host "After editing .env, run this script again." -ForegroundColor Cyan
    exit
}

# Load environment variables from .env
Write-Host "📋 Loading environment variables..." -ForegroundColor Cyan
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#].+?)=(.+)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Item -Path "env:$name" -Value $value
    }
}

# Check for required Nylas credentials
Write-Host "🔍 Checking Nylas credentials..." -ForegroundColor Cyan

$nylas_client_id = $env:NYLAS_CLIENT_ID
$nylas_client_secret = $env:NYLAS_CLIENT_SECRET
$nylas_api_key = $env:NYLAS_API_KEY

if (-Not $nylas_client_id -or $nylas_client_id -eq "your_nylas_client_id_here") {
    Write-Host "❌ NYLAS_CLIENT_ID not set in .env" -ForegroundColor Red
    Write-Host "   Get it from: https://dashboard.nylas.com" -ForegroundColor Yellow
    exit 1
}

if (-Not $nylas_client_secret -or $nylas_client_secret -eq "your_nylas_client_secret_here") {
    Write-Host "❌ NYLAS_CLIENT_SECRET not set in .env" -ForegroundColor Red
    Write-Host "   Get it from: https://dashboard.nylas.com" -ForegroundColor Yellow
    exit 1
}

if (-Not $nylas_api_key -or $nylas_api_key -eq "your_nylas_api_key_here") {
    Write-Host "❌ NYLAS_API_KEY not set in .env" -ForegroundColor Red
    Write-Host "   Get it from: https://dashboard.nylas.com" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Nylas credentials found" -ForegroundColor Green
Write-Host "   Client ID: $($nylas_client_id.Substring(0, 15))..." -ForegroundColor Gray
Write-Host "   API Key: $($nylas_api_key.Substring(0, 15))..." -ForegroundColor Gray
Write-Host ""

# Menu
Write-Host "What would you like to do?" -ForegroundColor Cyan
Write-Host "1. Run Database Migration" -ForegroundColor White
Write-Host "2. Deploy Supabase Edge Functions" -ForegroundColor White
Write-Host "3. Show n8n Import Instructions" -ForegroundColor White
Write-Host "4. Test Nylas API Connection" -ForegroundColor White
Write-Host "5. View Deployment Status" -ForegroundColor White
Write-Host "6. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-6)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "📊 Database Migration" -ForegroundColor Cyan
        Write-Host "=====================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Migration file: database/migrations/20251020_nylas_calendar.sql" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Choose migration method:" -ForegroundColor Yellow
        Write-Host "1. Supabase CLI (recommended)" -ForegroundColor White
        Write-Host "2. Manual SQL (copy to Supabase dashboard)" -ForegroundColor White
        Write-Host ""
        
        $method = Read-Host "Enter choice (1-2)"
        
        if ($method -eq "1") {
            Write-Host ""
            Write-Host "Checking for Supabase CLI..." -ForegroundColor Cyan
            
            $supabase = Get-Command supabase -ErrorAction SilentlyContinue
            
            if (-Not $supabase) {
                Write-Host "❌ Supabase CLI not found" -ForegroundColor Red
                Write-Host ""
                Write-Host "Install with:" -ForegroundColor Yellow
                Write-Host "  npm install -g supabase" -ForegroundColor White
                Write-Host ""
                exit 1
            }
            
            Write-Host "✅ Supabase CLI found" -ForegroundColor Green
            Write-Host ""
            Write-Host "Running migration..." -ForegroundColor Cyan
            
            # Run migration
            Get-Content "database/migrations/20251020_nylas_calendar.sql" | supabase db execute
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Database migration completed successfully!" -ForegroundColor Green
            } else {
                Write-Host "❌ Migration failed. Check errors above." -ForegroundColor Red
            }
        }
        elseif ($method -eq "2") {
            Write-Host ""
            Write-Host "📋 Manual Migration Instructions" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "1. Open Supabase Dashboard: https://supabase.com/dashboard" -ForegroundColor White
            Write-Host "2. Go to: SQL Editor" -ForegroundColor White
            Write-Host "3. Copy contents of: database/migrations/20251020_nylas_calendar.sql" -ForegroundColor White
            Write-Host "4. Paste into SQL Editor and Run" -ForegroundColor White
            Write-Host ""
            Write-Host "Opening migration file..." -ForegroundColor Cyan
            notepad "database\migrations\20251020_nylas_calendar.sql"
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "☁️  Deploy Supabase Edge Functions" -ForegroundColor Cyan
        Write-Host "===================================" -ForegroundColor Cyan
        Write-Host ""
        
        # Check for Supabase CLI
        $supabase = Get-Command supabase -ErrorAction SilentlyContinue
        
        if (-Not $supabase) {
            Write-Host "❌ Supabase CLI not found" -ForegroundColor Red
            Write-Host ""
            Write-Host "Install with:" -ForegroundColor Yellow
            Write-Host "  npm install -g supabase" -ForegroundColor White
            Write-Host ""
            exit 1
        }
        
        Write-Host "✅ Supabase CLI found" -ForegroundColor Green
        Write-Host ""
        
        # Deploy functions
        Write-Host "Deploying nylas-auth-url function..." -ForegroundColor Cyan
        supabase functions deploy nylas-auth-url
        
        Write-Host ""
        Write-Host "Deploying nylas-callback function..." -ForegroundColor Cyan
        supabase functions deploy nylas-callback
        
        Write-Host ""
        Write-Host "Setting environment secrets..." -ForegroundColor Cyan
        
        supabase secrets set NYLAS_CLIENT_ID=$env:NYLAS_CLIENT_ID
        supabase secrets set NYLAS_CLIENT_SECRET=$env:NYLAS_CLIENT_SECRET
        supabase secrets set NYLAS_API_KEY=$env:NYLAS_API_KEY
        supabase secrets set NYLAS_REDIRECT_URI=$env:NYLAS_REDIRECT_URI
        
        Write-Host ""
        Write-Host "✅ Supabase Edge Functions deployed!" -ForegroundColor Green
    }
    
    "3" {
        Write-Host ""
        Write-Host "📥 n8n Workflow Import Instructions" -ForegroundColor Cyan
        Write-Host "====================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Open n8n Dashboard:" -ForegroundColor White
        Write-Host "   https://n8n.instaroute.com" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "2. Import Workflow:" -ForegroundColor White
        Write-Host "   - Click '+ Add workflow'" -ForegroundColor Gray
        Write-Host "   - Click '⋮' menu → 'Import from File'" -ForegroundColor Gray
        Write-Host "   - Select: workflows/broker-calendar-nylas.json" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "3. Create Nylas API Credential:" -ForegroundColor White
        Write-Host "   - Go to: Credentials → '+ Add Credential'" -ForegroundColor Gray
        Write-Host "   - Type: 'HTTP Header Auth'" -ForegroundColor Gray
        Write-Host "   - Name: 'Nylas API Key'" -ForegroundColor Gray
        Write-Host "   - Header Name: Authorization" -ForegroundColor Gray
        Write-Host "   - Header Value: Bearer $env:NYLAS_API_KEY" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "4. Update Nodes:" -ForegroundColor White
        Write-Host "   - Select 'Nylas: Get Calendar Events' node" -ForegroundColor Gray
        Write-Host "   - Set credential: 'Nylas API Key'" -ForegroundColor Gray
        Write-Host "   - Select 'Nylas: Create Calendar Event' node" -ForegroundColor Gray
        Write-Host "   - Set credential: 'Nylas API Key'" -ForegroundColor Gray
        Write-Host ""
        Write-Host "5. Activate Workflow" -ForegroundColor White
        Write-Host "   - Toggle 'Inactive' → 'Active'" -ForegroundColor Gray
        Write-Host ""
        Write-Host "6. Copy Webhook URLs and update .env:" -ForegroundColor White
        Write-Host "   N8N_AVAILABILITY_WEBHOOK=https://n8n.instaroute.com/webhook/broker-availability-nylas" -ForegroundColor Cyan
        Write-Host "   N8N_BOOKING_WEBHOOK=https://n8n.instaroute.com/webhook/broker-book-appointment-nylas" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "Press Enter to open workflow file location..." -ForegroundColor Yellow
        Read-Host
        explorer /select,"workflows\broker-calendar-nylas.json"
    }
    
    "4" {
        Write-Host ""
        Write-Host "🔌 Testing Nylas API Connection" -ForegroundColor Cyan
        Write-Host "================================" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "Testing API Key..." -ForegroundColor Cyan
        
        # Test API connection
        $headers = @{
            "Authorization" = "Bearer $env:NYLAS_API_KEY"
            "Content-Type" = "application/json"
        }
        
        try {
            $response = Invoke-RestMethod -Uri "https://api.us.nylas.com/v3/grants" -Headers $headers -Method Get -ErrorAction Stop
            Write-Host "✅ Nylas API connection successful!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Connected grants: $($response.data.Count)" -ForegroundColor White
        }
        catch {
            Write-Host "❌ Nylas API connection failed" -ForegroundColor Red
            Write-Host ""
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
            Write-Host "Check your NYLAS_API_KEY in .env file" -ForegroundColor Yellow
        }
    }
    
    "5" {
        Write-Host ""
        Write-Host "📊 Deployment Status" -ForegroundColor Cyan
        Write-Host "====================" -ForegroundColor Cyan
        Write-Host ""
        
        # Check .env
        Write-Host "✅ .env file: Exists" -ForegroundColor Green
        
        # Check credentials
        if ($nylas_api_key -and $nylas_api_key -ne "your_nylas_api_key_here") {
            Write-Host "✅ Nylas credentials: Configured" -ForegroundColor Green
        } else {
            Write-Host "❌ Nylas credentials: Not configured" -ForegroundColor Red
        }
        
        # Check files
        if (Test-Path "database\migrations\20251020_nylas_calendar.sql") {
            Write-Host "✅ Database migration file: Ready" -ForegroundColor Green
        }
        
        if (Test-Path "supabase\functions\nylas-auth-url\index.ts") {
            Write-Host "✅ Supabase auth-url function: Ready" -ForegroundColor Green
        }
        
        if (Test-Path "supabase\functions\nylas-callback\index.ts") {
            Write-Host "✅ Supabase callback function: Ready" -ForegroundColor Green
        }
        
        if (Test-Path "workflows\broker-calendar-nylas.json") {
            Write-Host "✅ n8n workflow file: Ready" -ForegroundColor Green
        }
        
        if (Test-Path "portal\src\components\CalendarSync.vue") {
            Write-Host "✅ Vue component: Ready" -ForegroundColor Green
        }
        
        # Check bridge integration
        $toolsContent = Get-Content "bridge\tools.js" -Raw
        if ($toolsContent -match "checkBrokerAvailability" -and $toolsContent -match "NYLAS_API_KEY") {
            Write-Host "✅ Bridge Nylas integration: Complete" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Run database migration (Option 1)" -ForegroundColor White
        Write-Host "2. Deploy Supabase functions (Option 2)" -ForegroundColor White
        Write-Host "3. Import n8n workflow (Option 3)" -ForegroundColor White
    }
    
    "6" {
        Write-Host "Goodbye! 👋" -ForegroundColor Cyan
        exit
    }
    
    default {
        Write-Host "Invalid choice. Please run the script again." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

