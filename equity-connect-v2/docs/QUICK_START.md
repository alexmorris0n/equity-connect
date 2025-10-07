# 🚀 Equity Connect v2 - Quick Start Guide
## Simplified Vercel + Supabase Setup in 30 Minutes

**Modern serverless architecture** - No servers to manage, automatic scaling, pay-per-use pricing.

---

## 📋 Prerequisites (5 minutes)

### Required Accounts:
- [ ] **GitHub** account (free)
- [ ] **Vercel** account (free - connect with GitHub)
- [ ] **Supabase** account (free tier available)

### Optional but Recommended:
- [ ] **n8n** cloud account (for workflow automation)
- [ ] Domain name (for custom URLs)

---

## 🎯 30-Minute Setup

### Step 1: Fork & Clone Repository (3 minutes)

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/equity-connect-v2.git
cd equity-connect-v2

# Install dependencies
npm install
```

### Step 2: Create Supabase Project (5 minutes)

1. **Go to [supabase.com](https://supabase.com)**
2. **Click "New Project"**
3. **Choose organization and name** (e.g., "equity-connect-v2")
4. **Set database password** (save this!)
5. **Wait for project creation** (~2 minutes)

### Step 3: Initialize Database (3 minutes)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

**You'll see:** ✅ Tables created, RLS enabled, views created

### Step 4: Deploy to Vercel (8 minutes)

1. **Go to [vercel.com](https://vercel.com)**
2. **Click "New Project"**
3. **Import from GitHub** - select your forked repository
4. **Configure Environment Variables:**

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
INSTANTLY_API_KEY=your-instantly-key
INSTANTLY_WEBHOOK_SECRET=generate-random-string
VAPI_API_KEY=your-vapi-key
VAPI_WEBHOOK_SECRET=generate-random-string
CALENDLY_API_KEY=your-calendly-key
CALENDLY_WEBHOOK_SECRET=generate-random-string
```

5. **Click Deploy** (takes ~2 minutes)

### Step 5: Configure Webhooks (8 minutes)

Your webhook endpoints are automatically deployed at:

#### Instantly Webhook:
- **URL:** `https://your-project.vercel.app/api/webhooks/instantly`
- **Events:** email_sent, email_opened, email_clicked, email_replied
- **Secret:** Use `INSTANTLY_WEBHOOK_SECRET` from Step 4

#### VAPI Webhook:
- **URL:** `https://your-project.vercel.app/api/webhooks/vapi`
- **Events:** All events
- **Secret:** Use `VAPI_WEBHOOK_SECRET` from Step 4

#### Calendly Webhook:
- **URL:** `https://your-project.vercel.app/api/webhooks/calendly`
- **Events:** invitee.created, invitee.canceled
- **Secret:** Use `CALENDLY_WEBHOOK_SECRET` from Step 4

### Step 6: Test Everything (3 minutes)

```bash
# Test health endpoint
curl https://your-project.vercel.app/api/health

# Test webhook endpoints (should return 405 Method Not Allowed)
curl https://your-project.vercel.app/api/webhooks/instantly

# Check Supabase connection
# Go to your Supabase dashboard → Table Editor
# You should see: brokers, leads, interactions, billing_events, etc.
```

---

## ✅ What You Now Have

### **Automatic Infrastructure:**
- ✅ **Serverless Functions** - Handle 1000s of webhooks per day
- ✅ **Auto-scaling Database** - Grows with your lead volume
- ✅ **CI/CD Pipeline** - Deploy with every git push
- ✅ **Monitoring Built-in** - Vercel Analytics + Supabase logs

### **Cost Structure:**
- **Free Tier:** 0-1000 leads/month
- **Paid Tier:** ~$20-50/month for 10k leads/month
- **Enterprise:** Scales automatically

---

## 🔧 Configuration Options

### Environment Variables Reference:

| Variable | Purpose | Required |
|----------|---------|----------|
| `SUPABASE_URL` | Database connection | ✅ |
| `SUPABASE_ANON_KEY` | Public API access | ✅ |
| `SUPABASE_SERVICE_KEY` | Admin API access | ✅ |
| `INSTANTLY_API_KEY` | Email automation | ✅ |
| `INSTANTLY_WEBHOOK_SECRET` | Webhook security | ✅ |
| `VAPI_API_KEY` | AI voice calls | ⚠️ Optional |
| `VAPI_WEBHOOK_SECRET` | Voice webhook security | ⚠️ Optional |
| `CALENDLY_API_KEY` | Appointment booking | ⚠️ Optional |
| `CALENDLY_WEBHOOK_SECRET` | Calendar webhook security | ⚠️ Optional |

### Webhook Configuration:

```javascript
// Example webhook test
const testWebhook = async () => {
  const response = await fetch('https://your-project.vercel.app/api/webhooks/instantly', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Instantly-Signature': 'sha256=your-signature'
    },
    body: JSON.stringify({
      event_type: 'email_sent',
      lead_email: 'test@example.com',
      campaign_id: 'test-campaign'
    })
  });
  
  console.log(await response.json());
};
```

---

## 📊 Using the System

### Lead Management:

```sql
-- View all leads (in Supabase SQL Editor)
SELECT * FROM leads ORDER BY created_at DESC LIMIT 10;

-- Check lead status distribution
SELECT status, COUNT(*) FROM leads GROUP BY status;

-- View recent interactions
SELECT * FROM interactions ORDER BY created_at DESC LIMIT 20;
```

### API Endpoints:

```bash
# Health check
GET /api/health

# Webhook endpoints
POST /api/webhooks/instantly
POST /api/webhooks/vapi
POST /api/webhooks/calendly

# Future: Lead management API
GET /api/leads
POST /api/leads
PUT /api/leads/:id
```

---

## 🎓 Next Steps

### Immediate (Today):
1. **Test webhook endpoints** with sample data
2. **Import test leads** into Supabase
3. **Configure your first email campaign** in Instantly
4. **Set up appointment booking** in Calendly

### This Week:
1. **Connect n8n workflows** to your webhook endpoints
2. **Import real lead data** from PropStream
3. **Configure email sequences** with personas
4. **Set up VAPI** for automated calls

### Production Ready:
1. **Custom domain** setup in Vercel
2. **SSL certificates** (automatic with Vercel)
3. **Monitoring alerts** setup
4. **Backup procedures** established

---

## 🚨 Troubleshooting

### Common Issues:

#### Database Connection Failed
```bash
# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Test connection
curl "$SUPABASE_URL/rest/v1/leads" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

#### Webhook Not Receiving Data
```bash
# Check webhook URL is accessible
curl https://your-project.vercel.app/api/webhooks/instantly

# Check Vercel function logs
# Go to Vercel Dashboard → Functions → View logs
```

#### Environment Variables Not Working
```bash
# In Vercel dashboard:
# 1. Go to Settings → Environment Variables
# 2. Make sure all variables are set
# 3. Redeploy project after changes
```

---

## 📈 Scaling & Performance

### Auto-scaling Features:
- **Vercel Functions** - Scale to 1000s of concurrent requests
- **Supabase** - Handles millions of rows with automatic optimization
- **CDN** - Global edge network for fast response times

### Performance Monitoring:
- **Vercel Analytics** - Built-in performance metrics
- **Supabase Metrics** - Database performance insights
- **Real-time Logs** - Monitor all webhook activity

### Cost Optimization:
- **Pay-per-use** - Only pay for actual usage
- **Connection pooling** - Efficient database connections
- **Edge functions** - Reduced latency and costs

---

## 💡 Pro Tips

### Development Workflow:
```bash
# Local development
npm run dev

# Test locally with ngrok for webhooks
npx ngrok http 3000

# Deploy preview branch
git push origin feature-branch
# Automatic preview deployment created!
```

### Database Best Practices:
```sql
-- Use indexes for common queries
CREATE INDEX idx_leads_email ON leads(email);

-- Use RLS for security
-- Already configured in migration!

-- Monitor performance
SELECT * FROM pg_stat_activity;
```

### Webhook Security:
```typescript
// Always verify signatures
import crypto from 'crypto';

const verifySignature = (body: string, signature: string, secret: string) => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`),
    Buffer.from(signature)
  );
};
```

---

## 🎉 You're Ready!

Your modern, serverless lead generation system is now live with:

✅ **Automatic deployment** from GitHub  
✅ **Scalable webhook handling** via Vercel Functions  
✅ **Production database** with Supabase  
✅ **Real-time monitoring** built-in  
✅ **Security best practices** implemented  

### Production URLs:
- **Main Application:** `https://your-project.vercel.app`
- **Webhook Endpoints:** `https://your-project.vercel.app/api/webhooks/*`
- **Database Dashboard:** `https://app.supabase.com/project/your-project`

### Support Resources:
- **GitHub Issues:** Report bugs and request features
- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)

---

*Start processing leads in minutes, not months! 🚀*
