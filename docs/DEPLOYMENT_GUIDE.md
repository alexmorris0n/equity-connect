# Equity Connect Deployment Guide

## 🎯 Overview
This guide walks you through deploying the complete Equity Connect system with the new PropStream + Supabase + Vue.js architecture.

---

## 🏗 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PropStream    │    │      n8n        │    │    Supabase     │
│   (Lead Data)   │───▶│  (Workflows)    │───▶│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Instantly     │    │  Vue.js Frontend│
                       │  (Email CRM)    │    │   (Vercel)      │
                       └─────────────────┘    └─────────────────┘
```

---

## 🚀 Deployment Steps

### 1. Supabase Setup

#### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create new project:
   - **Name**: `equity-connect-leads`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Pro ($25/month)

#### 1.2 Get API Credentials
1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL**: `https://your-project.supabase.co`
   - **anon public key**: For frontend use
   - **service_role key**: For n8n workflows (keep secret!)

#### 1.3 Import Database Schema
1. Go to **SQL Editor** in Supabase dashboard
2. Copy the SQL from `config/supabase-database-schema.json`
3. Run the SQL to create all tables and relationships

#### 1.4 Configure Row Level Security
```sql
-- Enable RLS on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Brokers can view their leads" ON leads
FOR SELECT USING (assigned_broker_id = auth.uid());
```

### 2. PropStream Setup

#### 2.1 Create PropStream Account
1. Go to [propstream.com](https://propstream.com)
2. Sign up for Pro plan ($97/month)
3. Get API key from dashboard

#### 2.2 Create Saved Searches
1. Create saved searches for each broker:
   - **Search Name**: `Broker-Smith-95112,95113,95116`
   - **Criteria**: Age 62+, Owner-occupied, Equity $200k+
   - **ZIP Codes**: Broker-specific territories

#### 2.3 Test API Connection
```bash
curl -X POST "https://api.propstream.com/v1/exports/net-new" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"savedSearchId": "your-search-id", "limit": 10}'
```

### 3. Instantly Setup

#### 3.1 Create Instantly Account
1. Go to [instantly.ai](https://instantly.ai)
2. Sign up for Starter plan ($37/month)
3. Get API key from dashboard

#### 3.2 Create Email Campaigns
1. Create campaigns for each broker:
   - **Campaign Name**: `INST_Smith`
   - **Email Sequence**: 4-step reverse mortgage sequence
   - **Templates**: Personalized for each persona

#### 3.3 Test API Connection
```bash
curl -X GET "https://api.instantly.ai/api/v1/campaigns" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 4. SignalWire Setup

#### 4.1 Create SignalWire Account
1. Go to [signalwire.com](https://signalwire.com)
2. Sign up for free account
3. Verify your phone number
4. Complete account setup

#### 4.2 Get API Credentials
1. Go to **API** section in SignalWire dashboard
2. Create new API token with permissions:
   - Phone Numbers: Read, Write
   - Calls: Read, Write
   - Messages: Read, Write
3. Copy Project ID, API Token, and Space URL

#### 4.3 Purchase Phone Numbers
1. Go to **Phone Numbers** in SignalWire dashboard
2. Purchase 10-15 local phone numbers for call pool
3. Choose numbers from your target markets
4. Enable call recording and transcription

#### 4.4 Test API Connection
```bash
curl -X GET "https://your-space.signalwire.com/api/relay/rest/phone_numbers" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### 5. n8n Workflow Setup

#### 5.1 Install n8n
```bash
# Using npm
npm install -g n8n

# Or using Docker
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
```

#### 5.2 Import Workflow
1. Open n8n at `http://localhost:5678`
2. Go to **Workflows** → **Import from File**
3. Import `workflows/propstream-supabase-workflow.json`

#### 5.3 Configure Credentials
1. Go to **Credentials** in n8n
2. Add the following credentials:
   - **PropStream API**: Your PropStream API key
   - **Supabase API**: Your Supabase URL and service role key
   - **Instantly API**: Your Instantly API key
   - **SignalWire API**: Your SignalWire Project ID, API Token, and Space URL

#### 5.4 Test Workflow
1. Click **Execute Workflow** to test
2. Check Supabase for new leads
3. Verify Instantly campaign receives leads

### 6. Frontend Deployment (Vercel)

#### 6.1 Prepare Frontend
```bash
cd frontend
npm install
```

#### 6.2 Create Environment Variables
Create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### 6.3 Deploy to Vercel
1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel --prod
   ```

3. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### 6. Production Configuration

#### 6.1 n8n Production Setup
1. **Use n8n Cloud** (recommended):
   - Go to [n8n.cloud](https://n8n.cloud)
   - Create account and workspace
   - Import your workflow
   - Configure credentials

2. **Or self-host with Docker**:
   ```yaml
   version: '3.8'
   services:
     n8n:
       image: n8nio/n8n
       ports:
         - "5678:5678"
       environment:
         - N8N_BASIC_AUTH_ACTIVE=true
         - N8N_BASIC_AUTH_USER=admin
         - N8N_BASIC_AUTH_PASSWORD=your-password
       volumes:
         - n8n_data:/home/node/.n8n
   ```

#### 6.2 Domain Configuration
1. **Custom Domain for Frontend**:
   - Add domain in Vercel dashboard
   - Update DNS records
   - Enable SSL

2. **Custom Domain for n8n** (if self-hosting):
   - Configure reverse proxy (nginx)
   - Set up SSL certificate
   - Update webhook URLs

#### 6.3 Monitoring Setup
1. **Supabase Monitoring**:
   - Enable database monitoring
   - Set up alerts for errors
   - Monitor API usage

2. **n8n Monitoring**:
   - Enable execution logging
   - Set up error notifications
   - Monitor workflow performance

---

## 🔧 Configuration Files

### Environment Variables
Copy `config/environment-template.txt` to `.env` and fill in:

```env
# PropStream
PROPSTREAM_API_KEY=your_propstream_api_key_here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Instantly
INSTANTLY_API_KEY=your_instantly_api_key_here

# Frontend
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Broker Configuration
Update broker settings in n8n workflow:

```json
[
  {
    "broker": "smith",
    "searchId": "Broker-Smith-95112,95113,95116",
    "quota": 100,
    "campaignId": "INST_Smith"
  }
]
```

---

## 🧪 Testing

### 1. Test Lead Generation
1. Run n8n workflow manually
2. Check Supabase for new leads
3. Verify lead data quality
4. Check Instantly for imported leads

### 2. Test Frontend
1. Open frontend URL
2. Login with broker credentials
3. Verify dashboard loads
4. Check real-time updates

### 3. Test Email Campaigns
1. Check Instantly dashboard
2. Verify campaigns are active
3. Test email delivery
4. Monitor open/click rates

---

## 📊 Monitoring & Maintenance

### 1. Daily Checks
- [ ] Check n8n workflow executions
- [ ] Monitor Supabase database health
- [ ] Review lead generation metrics
- [ ] Check email campaign performance

### 2. Weekly Tasks
- [ ] Review broker performance
- [ ] Update lead quotas if needed
- [ ] Check API usage limits
- [ ] Review error logs

### 3. Monthly Tasks
- [ ] Update PropStream saved searches
- [ ] Review and optimize email templates
- [ ] Check Supabase storage usage
- [ ] Review costs and billing

---

## 🚨 Troubleshooting

### Common Issues

#### 1. n8n Workflow Errors
- **Check credentials**: Verify all API keys are correct
- **Check rate limits**: Ensure you're not exceeding API limits
- **Check logs**: Review execution logs for specific errors

#### 2. Supabase Connection Issues
- **Check URL format**: Ensure URL includes `https://`
- **Check API keys**: Verify service role key has correct permissions
- **Check RLS policies**: Ensure policies allow your operations

#### 3. Frontend Issues
- **Check environment variables**: Verify all VITE_ variables are set
- **Check Supabase connection**: Test connection in browser console
- **Check build errors**: Review Vercel build logs

#### 4. PropStream Issues
- **Check API key**: Verify key is active and has correct permissions
- **Check search IDs**: Ensure saved search IDs are correct
- **Check rate limits**: Monitor API usage

---

## 💰 Cost Optimization

### Monthly Costs
- **PropStream**: $97 (unlimited leads)
- **PropStream Skip-trace**: $51 (average for 300 leads)
- **Supabase**: $25 (Pro plan)
- **Instantly**: $37 (Starter plan)
- **Vercel**: $20 (Pro plan)
- **SignalWire**: $15 (call pool management)
- **n8n Cloud**: $20 (Starter plan)
- **Total**: ~$265/month

### Cost Savings Tips
1. **Monitor API usage**: Track and optimize API calls
2. **Use Supabase efficiently**: Optimize queries and storage
3. **Scale Instantly**: Adjust plan based on email volume
4. **Optimize n8n**: Use efficient workflows and scheduling

---

## 🔒 Security Best Practices

### 1. API Security
- **Rotate API keys**: Regularly update API keys
- **Use environment variables**: Never hardcode secrets
- **Monitor access**: Track API key usage

### 2. Database Security
- **Enable RLS**: Use Row Level Security policies
- **Limit access**: Use service role key only for n8n
- **Monitor queries**: Track database access patterns

### 3. Frontend Security
- **Use HTTPS**: Ensure all connections are encrypted
- **Validate inputs**: Sanitize user inputs
- **Update dependencies**: Keep packages updated

---

## 📈 Scaling

### 1. Lead Volume Scaling
- **Increase quotas**: Adjust broker quotas as needed
- **Add brokers**: Onboard new brokers to the system
- **Optimize searches**: Refine PropStream search criteria

### 2. Performance Scaling
- **Database optimization**: Add indexes and optimize queries
- **Caching**: Implement caching for frequently accessed data
- **CDN**: Use CDN for frontend assets

### 3. Feature Scaling
- **Add integrations**: Connect additional services
- **Custom workflows**: Create specialized n8n workflows
- **Advanced analytics**: Implement detailed reporting

---

## 🎯 Success Metrics

### Key Performance Indicators
- **Lead Generation**: 100+ leads per broker per day
- **Conversion Rate**: 15-20% lead to appointment rate
- **Email Performance**: 25-35% open rates, 3-5% reply rates
- **System Uptime**: 99.9% availability
- **Cost Efficiency**: <$2 per qualified lead

### Monitoring Dashboard
Create a monitoring dashboard to track:
- Daily lead generation
- Broker performance
- Email campaign metrics
- System health
- Cost tracking

---

## 🚀 Next Steps

1. **Deploy the system** following this guide
2. **Test all integrations** thoroughly
3. **Onboard your first broker** and test the full flow
4. **Monitor performance** and optimize as needed
5. **Scale up** by adding more brokers and features

---

**Ready to deploy?** Follow this guide step-by-step and you'll have a fully functional lead generation system in under 2 hours! 🚀
