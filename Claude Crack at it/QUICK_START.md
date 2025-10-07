# 🚀 EQUITY CONNECT - QUICK START GUIDE
## Get Your Automated Lead System Running in 60 Minutes

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Supabase Account** (free tier works for testing)
- [ ] **n8n Instance** (cloud or self-hosted)
- [ ] **Domain Name** configured with wildcard DNS
- [ ] **API Keys** for: Estated, Clay, Melissa, Instantly, VAPI, Calendly
- [ ] **Vercel Account** (for microsite hosting)
- [ ] **Anthropic API Key** (for Claude persona assignment)

---

## 🎯 30-Minute Fast Track Setup

### Step 1: Database Setup (5 minutes)

```bash
# 1. Create Supabase project at supabase.com
# 2. Copy your project URL and service key
# 3. Run the database schema

cd equity-connect-implementation
psql $SUPABASE_URL < database-setup.sql

# Or use Supabase SQL Editor:
# - Open Supabase Dashboard → SQL Editor
# - Copy/paste contents of database-setup.sql
# - Click "Run"
```

### Step 2: Environment Configuration (5 minutes)

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and add your actual API keys
nano .env  # or use any text editor
```

**Critical variables to configure:**
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- `ESTATED_API_KEY`
- `CLAY_API_KEY`
- `INSTANTLY_API_KEY`
- `VAPI_API_KEY`
- `VERCEL_TOKEN`
- `ANTHROPIC_API_KEY`

### Step 3: Start Services with Docker (10 minutes)

```bash
# Install dependencies
npm install

# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# equity-postgres    Up (healthy)
# equity-redis       Up (healthy)
# equity-n8n         Up
# equity-webhooks    Up
# equity-monitoring  Up
```

### Step 4: Import n8n Workflow (5 minutes)

1. Open n8n at `http://localhost:5678`
2. Login with credentials from `.env` (default: admin/admin)
3. Click "Import from File"
4. Select `n8n-daily-lead-workflow.json`
5. Configure credentials for each node:
   - Supabase PostgreSQL
   - Estated API
   - Clay API
   - Instantly API
   - Anthropic API
6. Click "Activate" workflow

### Step 5: Configure Webhooks (5 minutes)

**Instantly Webhook:**
```
URL: http://your-server.com:3000/webhooks/instantly
Events: email_sent, email_opened, email_clicked, email_replied
Secret: [copy from .env]
```

**VAPI Webhook:**
```
URL: http://your-server.com:3000/webhooks/vapi
Events: All events
Secret: [copy from .env]
```

**Calendly Webhook:**
```
URL: http://your-server.com:3000/webhooks/calendly
Events: invitee.created, invitee.canceled
Signing Key: [copy from .env]
```

### Step 6: Test the System (10 minutes)

```bash
# Test webhook server health
curl http://localhost:3000/health

# Test monitoring dashboard
open http://localhost:3001/dashboard

# Test n8n workflow (manual execution)
# In n8n, click "Execute Workflow" button

# Check logs
docker-compose logs -f webhook-server
```

---

## 📊 Monitoring & Verification

### Access Your Dashboards:

- **n8n Workflow:** http://localhost:5678
- **Monitoring Dashboard:** http://localhost:3001/dashboard
- **Database (pgAdmin):** http://localhost:5050
- **Email Testing (Mailhog):** http://localhost:8025

### Verify Data Flow:

```sql
-- Check leads in database
SELECT COUNT(*) FROM leads;

-- Check recent pipeline events
SELECT event_type, COUNT(*) 
FROM pipeline_events 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY event_type;

-- Check billing events
SELECT broker_id, SUM(amount) as total
FROM billing_events
WHERE status = 'pending'
GROUP BY broker_id;
```

---

## 🔥 Production Deployment

### Deploy to Cloud:

**Option A: Railway (Easiest)**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and initialize
railway login
railway init

# Deploy services
railway up
```

**Option B: AWS/GCP/Azure**
```bash
# Use docker-compose-production.yml
docker-compose -f docker-compose-production.yml up -d
```

### Configure DNS:

```
# Add these records to your domain:
Type: A
Name: @
Value: [Your Server IP]

Type: CNAME
Name: *
Value: cname.vercel-dns.com

Type: CNAME
Name: webhooks
Value: [Your Webhook Server]
```

### Security Checklist:

- [ ] Change all default passwords
- [ ] Enable HTTPS/SSL certificates
- [ ] Set up firewall rules
- [ ] Configure rate limiting
- [ ] Enable database backups
- [ ] Set up monitoring alerts
- [ ] Review Row Level Security policies

---

## 🎓 Daily Operations

### Morning Routine (5 minutes):

```bash
# Check monitoring dashboard
open http://your-server.com:3001/dashboard

# Review overnight pipeline
docker-compose logs --tail=100 webhook-server

# Check DLQ for failed items
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pipeline_dlq WHERE retry_after IS NULL;"
```

### Weekly Tasks (30 minutes):

- Review broker performance metrics
- Analyze conversion funnel
- Clear resolved DLQ items
- Update persona templates if needed
- Review and approve invoices

### Monthly Tasks (2 hours):

- Generate billing reports
- Audit security logs
- Optimize API usage/costs
- Review and update lead scoring
- A/B test email sequences

---

## 🚨 Troubleshooting

### Common Issues:

**Issue: Leads not enriching**
```bash
# Check Clay API status
curl -H "Authorization: Bearer $CLAY_API_KEY" \
  https://api.clay.com/v1/health

# Check logs
docker-compose logs clay-enrichment
```

**Issue: Webhooks not receiving data**
```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/webhooks/instantly \
  -H "Content-Type: application/json" \
  -d '{"event_type":"test","lead_email":"test@example.com"}'

# Check webhook server logs
docker-compose logs -f webhook-server
```

**Issue: Microsites not deploying**
```bash
# Verify Vercel token
vercel whoami

# Check DNS propagation
dig test.equityconnect.com

# Redeploy manually
node microsite-deployment.js
```

**Issue: n8n workflow failing**
```bash
# Check n8n logs
docker-compose logs n8n

# Verify credentials
# n8n UI → Credentials → Test each connection

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"
```

---

## 📈 Scaling Up

### From 100 to 1,000 leads/day:

1. **Upgrade Database:**
   ```bash
   # Supabase: Pro plan ($25/mo)
   # Or dedicated PostgreSQL instance
   ```

2. **Add Queue System:**
   ```bash
   # Install BullMQ
   npm install bullmq
   
   # Configure Redis queues
   # See docs/scaling/queue-setup.md
   ```

3. **Enable Caching:**
   ```bash
   # Redis caching layer
   # Cache neighborhood data
   # Cache persona templates
   ```

4. **Deploy Multiple Regions:**
   ```bash
   # Use Vercel Edge Functions
   # Deploy webhooks to multiple regions
   # Implement CDN for microsites
   ```

---

## 💡 Pro Tips

### Optimization Tips:

1. **Batch API calls** to reduce costs
2. **Cache enrichment data** for 7 days
3. **Use materialized views** for reporting
4. **Enable connection pooling** for database
5. **Implement retry logic** with exponential backoff
6. **Monitor API rate limits** proactively

### Cost Savings:

- **Batch Clay enrichments:** $200/1000 → $150/1000
- **Cache Vercel deployments:** Reuse per neighborhood
- **Optimize n8n executions:** Combine nodes
- **Use webhook retries:** Reduce failed operations

### Performance Gains:

```javascript
// Before: Sequential enrichment (60s)
for (const lead of leads) {
  await enrich(lead);
}

// After: Parallel enrichment (10s)
await Promise.all(leads.map(lead => enrich(lead)));
```

---

## 📚 Resources

### Documentation:
- [Full Implementation Guide](IMPLEMENTATION_GUIDE.md)
- [API Reference](docs/api-reference.md)
- [Troubleshooting Guide](docs/troubleshooting.md)
- [Scaling Guide](docs/scaling.md)

### Community:
- Discord: [Join our server]
- GitHub: [Report issues]
- Email: support@equityconnect.com

### Training Materials:
- Video walkthrough: [YouTube playlist]
- Sample workflows: [n8n.io/workflows]
- Best practices: [docs/best-practices.md]

---

## ✅ Success Metrics

After 30 days, you should see:

- **100+ qualified leads/day** entering the pipeline
- **20-30% email open rates**
- **5-10% reply rates**
- **2-5% appointment booking rate**
- **1-2% funding rate**

**Average ROI:** $50,000 revenue per 1,000 leads processed

---

## 🎉 You're Ready!

Your automated reverse mortgage lead system is now operational.

**Next Steps:**
1. ✅ Run your first test batch of leads
2. ✅ Monitor the dashboard for 24 hours
3. ✅ Adjust persona templates based on results
4. ✅ Scale up to production volume

**Need Help?** Contact us at support@equityconnect.com

---

*Last Updated: October 2024 | Version 1.0.0*
