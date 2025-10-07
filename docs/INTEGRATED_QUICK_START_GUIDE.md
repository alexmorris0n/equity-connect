# 🚀 Equity Connect - Integrated Quick Start Guide
## Production-Ready Lead Generation System in 90 Minutes

**Combining the best of both worlds:**
- ✅ **Comprehensive architecture** from your existing documentation
- ✅ **Operational infrastructure** from Claude's implementation
- ✅ **Production-ready security** and database schema
- ✅ **Real-time monitoring** and webhook handling

---

## 📋 Prerequisites Checklist

### Required Accounts & Services
- [ ] **Supabase Account** (free tier works for testing)
- [ ] **n8n Instance** (cloud or self-hosted)
- [ ] **Domain Name** configured with wildcard DNS
- [ ] **Vercel Account** (for microsite hosting)

### API Keys Required
- [ ] **Supabase** - URL and Service Key
- [ ] **Estated API Key** - Property data
- [ ] **Clay API Key** - Lead enrichment
- [ ] **Melissa API Key** - Address validation
- [ ] **Instantly API Key** - Email campaigns
- [ ] **VAPI API Key** - AI voice calls
- [ ] **Calendly API Key** - Appointment booking
- [ ] **Anthropic API Key** - Claude persona assignment
- [ ] **SignalWire API Key** - Phone number management

### Development Environment
- [ ] **Node.js 18+** and **npm 9+**
- [ ] **PostgreSQL** client tools (psql)
- [ ] **Git** for version control
- [ ] **VS Code** or preferred IDE

---

## 🎯 90-Minute Fast Track Setup

### Phase 1: Database Setup (15 minutes)

#### Step 1.1: Backup Existing Database ⚠️
```bash
# If you have existing data, create backup first
pg_dump $SUPABASE_URL > backup-$(date +%Y%m%d).sql
```

#### Step 1.2: Run Production Migration
```bash
# 1. Navigate to project directory
cd equity-connect

# 2. Run the comprehensive database migration
psql $SUPABASE_URL < config/supabase-production-migration.sql

# 3. Verify migration completed successfully
# Look for: "MIGRATION COMPLETED SUCCESSFULLY" message
```

**Expected Results:**
- ✅ 11+ new columns added to `leads` table
- ✅ 6 new tables created (consent_tokens, verification_code_map, etc.)
- ✅ All indexes and RLS policies implemented
- ✅ Triggers and helper functions installed

### Phase 2: Environment Configuration (10 minutes)

#### Step 2.1: Create Environment File
```bash
# Copy environment template
cp config/environment-template.txt .env

# Edit with your actual values
nano .env  # or use VS Code: code .env
```

#### Step 2.2: Generate Security Keys
```bash
# Generate HMAC secret (or use online tool)
openssl rand -hex 32

# Generate form link secret
openssl rand -hex 32

# Add both to your .env file
```

**Critical variables to configure:**
```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Security
HMAC_SECRET_KEY=your-64-char-hmac-key
FORM_LINK_SECRET=your-64-char-form-secret

# API Keys
ESTATED_API_KEY=your-estated-key
CLAY_API_KEY=your-clay-key
INSTANTLY_API_KEY=your-instantly-key
VAPI_API_KEY=your-vapi-key
CALENDLY_API_KEY=your-calendly-key
ANTHROPIC_API_KEY=your-anthropic-key
SIGNALWIRE_API_KEY=your-signalwire-key

# Webhooks
INSTANTLY_WEBHOOK_SECRET=your-instantly-webhook-secret
VAPI_WEBHOOK_SECRET=your-vapi-webhook-secret
CALENDLY_WEBHOOK_SECRET=your-calendly-webhook-secret

# Deployment
VERCEL_TOKEN=your-vercel-token
VERCEL_PROJECT_ID=your-vercel-project-id
```

### Phase 3: Install Dependencies (5 minutes)

```bash
# Install all production and operational dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Verify installation
npm run health:check
```

### Phase 4: Start Core Services (15 minutes)

#### Step 4.1: Start Webhook Server
```bash
# Option A: Development mode (with auto-reload)
npm run dev

# Option B: Production mode
npm start

# Expected output:
# Webhook server running on port 3000
# Health check: http://localhost:3000/health
```

#### Step 4.2: Start Monitoring Dashboard
```bash
# In a new terminal
npm run monitor

# Expected output:
# Monitoring dashboard running on port 3001
# Dashboard: http://localhost:3001
```

#### Step 4.3: Start Frontend (Optional for testing)
```bash
# In a new terminal
npm run dev:frontend

# Expected output:
# Frontend running on http://localhost:5173
```

#### Step 4.4: All Services at Once
```bash
# Alternative: Start everything with one command
npm run dev:all
```

### Phase 5: Configure Webhooks (15 minutes)

#### Step 5.1: Instantly Webhook Configuration
1. Login to Instantly dashboard
2. Go to Settings → Webhooks
3. Add webhook URL: `https://your-domain.com/webhooks/instantly`
4. Select events: `email_sent`, `email_opened`, `email_clicked`, `email_replied`
5. Set secret: Copy from `.env` file (`INSTANTLY_WEBHOOK_SECRET`)

#### Step 5.2: VAPI Webhook Configuration
1. Login to VAPI dashboard
2. Go to Account → Webhooks
3. Add webhook URL: `https://your-domain.com/webhooks/vapi`
4. Select all events
5. Set secret: Copy from `.env` file (`VAPI_WEBHOOK_SECRET`)

#### Step 5.3: Calendly Webhook Configuration
1. Login to Calendly
2. Go to Account → Developer Settings → Webhooks
3. Add webhook URL: `https://your-domain.com/webhooks/calendly`
4. Select events: `invitee.created`, `invitee.canceled`
5. Set signing key: Copy from `.env` file (`CALENDLY_WEBHOOK_SECRET`)

#### Step 5.4: SignalWire Webhook Configuration
1. Login to SignalWire dashboard
2. Go to Phone Numbers → Configure each number
3. Set webhook URL: `https://your-domain.com/webhooks/signalwire`
4. Enable for voice and SMS

### Phase 6: Import n8n Workflows (10 minutes)

#### Step 6.1: Access n8n
```bash
# If running locally with Docker:
# Open: http://localhost:5678

# If using n8n cloud:
# Open your n8n instance URL
```

#### Step 6.2: Import Workflows
1. Click "Import from File"
2. Select workflow files from `/workflows/` directory:
   - `propstream-supabase-workflow.json` - Lead ingestion
   - `ai-voice-call-workflow.json` - VAPI integration
   - `consent-processing-workflow.json` - Consent management
   - `broker-acquisition-workflow.json` - Broker onboarding

#### Step 6.3: Configure Credentials
For each workflow, configure:
- **Supabase PostgreSQL**: Database connection
- **HTTP Request nodes**: API keys from `.env`
- **Webhook nodes**: Ensure URLs match your webhook server

#### Step 6.4: Activate Workflows
1. Test each workflow with sample data
2. Click "Activate" for all workflows
3. Verify in monitoring dashboard

### Phase 7: Test the System (20 minutes)

#### Step 7.1: Health Check All Services
```bash
# Test webhook server
curl http://localhost:3000/health

# Test monitoring dashboard
curl http://localhost:3001/health

# Check n8n status
curl http://localhost:5678/healthz  # if local
```

#### Step 7.2: Test Database Integration
```sql
-- Connect to Supabase and run:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should show all new tables:
-- consent_tokens, leads, pipeline_dlq, etc.
```

#### Step 7.3: Test Webhook Endpoints
```bash
# Test Instantly webhook (with mock data)
curl -X POST http://localhost:3000/webhooks/instantly \
  -H "Content-Type: application/json" \
  -H "X-Instantly-Signature: sha256=test" \
  -d '{"event_type":"test","lead_email":"test@example.com"}'

# Should return: {"success": true}
```

#### Step 7.4: Test Lead Upload Flow
```bash
# Use the sample CSV in /test-data/
# Upload through n8n PropStream workflow
# Check leads appear in database:

psql $SUPABASE_URL -c "SELECT COUNT(*) FROM leads;"
```

---

## 📊 Monitoring & Verification

### Access Your Dashboards

| Service | URL | Purpose |
|---------|-----|---------|
| **Webhook Server** | http://localhost:3000/health | API endpoint health |
| **Monitoring Dashboard** | http://localhost:3001 | Real-time metrics |
| **n8n Workflows** | http://localhost:5678 | Automation workflows |
| **Frontend Dashboard** | http://localhost:5173 | Lead management UI |

### Verify Data Flow

```sql
-- Check leads are being processed
SELECT COUNT(*) as total_leads FROM leads;

-- Check recent pipeline activity
SELECT event_type, COUNT(*) 
FROM pipeline_events 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY event_type;

-- Check webhook processing
SELECT 
  event_type,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM pipeline_events 
GROUP BY event_type
ORDER BY latest DESC;

-- Check broker billing
SELECT 
  b.company_name,
  SUM(be.amount) as pending_amount
FROM billing_events be
JOIN brokers b ON b.id = be.broker_id
WHERE be.status = 'pending'
GROUP BY b.id, b.company_name;
```

### Performance Monitoring

The monitoring dashboard at `http://localhost:3001` provides:

- **Real-time Metrics**: Leads, emails, calls, appointments
- **Conversion Funnel**: Status progression tracking
- **Broker Performance**: Individual broker statistics
- **System Alerts**: Error detection and notifications
- **Activity Charts**: 24-hour trend visualization

---

## 🎓 Daily Operations

### Morning Routine (5 minutes)
```bash
# Check system health
npm run health:check

# Review monitoring dashboard
open http://localhost:3001

# Check for failed items in DLQ
psql $SUPABASE_URL -c "SELECT COUNT(*) FROM pipeline_dlq WHERE status = 'failed';"

# Review logs for errors
npm run logs:webhook
```

### Weekly Tasks (30 minutes)
- Review broker performance metrics in dashboard
- Analyze conversion funnel for optimization opportunities
- Clear resolved DLQ items
- Update persona templates based on performance
- Review and approve pending invoices

### Monthly Tasks (2 hours)
- Generate comprehensive billing reports
- Audit security logs and access patterns
- Optimize API usage and costs
- Review and update lead scoring algorithms
- A/B test email sequences and call scripts

---

## 🚨 Troubleshooting Guide

### Common Issues & Solutions

#### Issue: Database Migration Fails
```bash
# Check error message carefully
# Most common: missing permissions

# Fix: Ensure service key has proper permissions
# Retry with verbose output:
psql $SUPABASE_URL < config/supabase-production-migration.sql -v ON_ERROR_STOP=1
```

#### Issue: Webhook Server Won't Start
```bash
# Check port availability
netstat -tulpn | grep :3000

# Check environment variables
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"

# Check logs for detailed error
DEBUG=* npm run dev
```

#### Issue: n8n Workflows Failing
```bash
# Check n8n logs
docker logs n8n  # if using Docker

# Common fixes:
# 1. Update API credentials
# 2. Check webhook URLs
# 3. Verify database connection
# 4. Test API endpoints individually
```

#### Issue: Monitoring Dashboard Shows No Data
```bash
# Check database connection
psql $SUPABASE_URL -c "SELECT 1;"

# Check if pipeline_events table exists and has data
psql $SUPABASE_URL -c "SELECT COUNT(*) FROM pipeline_events;"

# Restart monitoring service
npm run monitor
```

---

## 🔥 Production Deployment

### Option A: Simple VPS Deployment

```bash
# 1. Provision VPS (2GB RAM minimum)
# 2. Install Node.js, PostgreSQL client, nginx
# 3. Clone repository and install dependencies
# 4. Set production environment variables
# 5. Use PM2 for process management

npm install -g pm2
pm2 start scripts/webhook-server.js --name webhook-server
pm2 start scripts/monitoring-dashboard.js --name monitoring
pm2 startup
pm2 save
```

### Option B: Railway Deployment (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Deploy all services
railway up

# Configure custom domain
railway domain add your-domain.com
```

### SSL Configuration

```nginx
# nginx configuration
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /webhooks/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /dashboard/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }
}
```

---

## 📈 Scaling Up

### From 100 to 1,000+ leads/day:

1. **Database Optimization**
   ```sql
   -- Add additional indexes for high-volume queries
   CREATE INDEX CONCURRENTLY idx_leads_campaign_status_created 
   ON leads(campaign_status, created_at) 
   WHERE campaign_status IN ('active', 'queued');
   ```

2. **Queue System Implementation**
   ```bash
   # Install Redis for queue management
   # Configure Bull queues for email/call processing
   # See /scripts/queue-setup.js (coming soon)
   ```

3. **Load Balancing**
   ```bash
   # Deploy multiple webhook server instances
   # Use nginx or HAProxy for load balancing
   # Implement session affinity if needed
   ```

4. **Monitoring Enhancements**
   ```bash
   # Add Prometheus metrics
   # Configure Grafana dashboards
   # Set up PagerDuty alerts
   ```

---

## 💡 Pro Tips & Optimizations

### Performance Optimizations

1. **Batch API Calls**: Reduce costs by batching enrichment requests
2. **Cache Frequently Used Data**: Implement Redis caching for persona templates
3. **Database Connection Pooling**: Configure pgBouncer for high concurrency
4. **CDN for Microsites**: Use Vercel Edge Network for global performance

### Cost Savings

- **Clay API**: Batch enrichments save ~25% on per-request pricing
- **Vercel Deployments**: Cache and reuse microsite templates per neighborhood
- **n8n Executions**: Combine multiple operations into single workflow runs
- **Database Queries**: Use materialized views for reporting data

### Security Best Practices

```bash
# Regular security updates
npm audit fix

# Database backup automation
0 2 * * * pg_dump $DATABASE_URL > /backups/daily-$(date +\%Y\%m\%d).sql

# Log rotation
# Configure logrotate for webhook and monitoring logs

# SSL certificate renewal
# Use Let's Encrypt with auto-renewal
```

---

## ✅ Success Metrics

After 30 days of operation, you should see:

| Metric | Target | Notes |
|--------|--------|-------|
| **Daily Lead Volume** | 100+ qualified leads | Depends on PropStream feed configuration |
| **Email Performance** | 20-30% open rate | Industry average for mortgage leads |
| **Email Reply Rate** | 5-10% | Persona-targeted emails perform better |
| **Appointment Booking** | 2-5% of replies | Quality indicator for lead scoring |
| **Show Rate** | 70%+ | Proper qualification improves shows |
| **Funding Rate** | 1-2% of total leads | Industry standard for reverse mortgages |

**Revenue Projection**: $50,000-100,000 per 1,000 qualified leads processed

---

## 🎉 You're Ready for Production!

Your comprehensive automated reverse mortgage lead system is now operational with:

✅ **Production-grade database** with security and compliance  
✅ **Real-time webhook processing** for all integrations  
✅ **Monitoring dashboard** with alerts and metrics  
✅ **Scalable architecture** ready for growth  
✅ **Complete documentation** for operations and troubleshooting  

### Next Steps:
1. **Run your first production batch** of 50-100 leads
2. **Monitor the dashboard** for 48 hours to ensure stability
3. **Optimize persona assignments** based on initial results
4. **Scale up to full production volume** (1000+ leads/day)
5. **Implement advanced features** (A/B testing, advanced analytics)

---

## 📞 Support & Resources

### Documentation
- [Architecture Visual Guide](ARCHITECTURE_VISUAL_GUIDE.md)
- [Security Implementation](HMAC_VERIFICATION_GUIDE.md)
- [Production Implementation Checklist](PRODUCTION_IMPLEMENTATION_CHECKLIST.md)
- [Compliance Framework](COMPLIANCE_FRAMEWORK.md)

### Getting Help
- **Technical Issues**: Create GitHub issue with error logs
- **Configuration Help**: Check troubleshooting section above
- **Performance Questions**: Review monitoring dashboard metrics
- **Integration Support**: Verify webhook configurations and API keys

### Community
- **Discord**: [Join our community](https://discord.gg/equity-connect)
- **GitHub**: [Report bugs and request features](https://github.com/equity-connect/equity-connect)
- **Email**: support@equityconnect.com

---

*Last Updated: October 2024 | Version 2.0.0*  
*Integrated Guide combining comprehensive architecture with operational infrastructure*
