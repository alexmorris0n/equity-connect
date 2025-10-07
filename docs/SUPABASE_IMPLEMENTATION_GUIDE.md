# Supabase Implementation Guide

## 🎯 Overview
This guide walks you through setting up Supabase as the database backend for the Equity Connect lead automation system, replacing the previous Softr integration.

---

## 🚀 Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub
4. Create new project:
   - **Name**: `equity-connect-leads`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Pro ($25/month)

### 2. Get API Credentials

1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL**: `https://your-project.supabase.co`
   - **anon public key**: For frontend use
   - **service_role key**: For n8n workflows (keep secret!)

### 3. Import Database Schema

1. Go to **SQL Editor** in Supabase dashboard
2. Copy the SQL from `config/supabase-database-schema.json`
3. Run the SQL to create all tables and relationships

---

## 📊 Database Schema

### Core Tables

#### `leads` Table
- **Primary Key**: `id` (UUID)
- **Key Fields**: `first_name`, `last_name`, `email`, `phone`, `property_address`
- **Broker Assignment**: `assigned_broker_id` (FK to brokers)
- **Status Tracking**: `status`, `lead_score`, `interaction_count`
- **Timestamps**: `created_at`, `last_contact`, `last_engagement`

#### `brokers` Table
- **Primary Key**: `id` (UUID)
- **Key Fields**: `company_name`, `contact_name`, `email`, `nmls_number`
- **Billing**: `pricing_model`, `current_balance`, `invoice_threshold`
- **Performance**: `conversion_rate`, `show_rate`, `weekly_revenue`

#### `interactions` Table
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: `lead_id`, `broker_id`
- **Tracking**: `type`, `direction`, `outcome`, `duration_seconds`
- **Content**: `subject`, `content`, `metadata` (JSONB)

#### `billing_events` Table
- **Primary Key**: `id` (UUID)
- **Event Types**: `qualified_lead`, `appointment_set`, `appointment_showed`, `application_submitted`, `deal_funded`
- **Financial**: `amount`, `status`, `invoice_id`

---

## 🔒 Row Level Security (RLS)

### Enable RLS
```sql
-- Enable RLS on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
```

### Create Policies

#### Brokers can only see their assigned leads
```sql
CREATE POLICY "Brokers can view their leads" ON leads
FOR SELECT USING (assigned_broker_id = auth.uid());
```

#### Brokers can only see their own data
```sql
CREATE POLICY "Brokers can view own data" ON brokers
FOR SELECT USING (id = auth.uid());
```

#### Brokers can only see interactions for their leads
```sql
CREATE POLICY "Brokers can view their interactions" ON interactions
FOR SELECT USING (
  broker_id = auth.uid() OR 
  lead_id IN (SELECT id FROM leads WHERE assigned_broker_id = auth.uid())
);
```

---

## 🔄 Real-time Subscriptions

### Enable Real-time
1. Go to **Database** → **Replication**
2. Enable real-time for all tables
3. Configure publication settings

### Frontend Integration
```javascript
// Subscribe to new leads for a broker
const { data, error } = await supabase
  .from('leads')
  .select('*')
  .eq('assigned_broker_id', brokerId)
  .on('INSERT', (payload) => {
    console.log('New lead:', payload.new);
  });
```

---

## 🛠 n8n Integration

### 1. Add Supabase Credentials
1. Go to n8n **Credentials**
2. Add new credential: **Supabase**
3. Enter:
   - **API URL**: Your project URL
   - **Service Role Key**: Your service role key

### 2. Configure HTTP Request Nodes
```json
{
  "url": "https://your-project.supabase.co/rest/v1/leads",
  "headers": {
    "apikey": "{{$credentials.supabaseApi.apiKey}}",
    "Authorization": "Bearer {{$credentials.supabaseApi.serviceRoleKey}}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  }
}
```

### 3. Insert Lead Data
```json
{
  "first_name": "{{$json.first_name}}",
  "last_name": "{{$json.last_name}}",
  "email": "{{$json.email}}",
  "phone": "{{$json.phone}}",
  "property_address": "{{$json.address}}",
  "assigned_broker_id": "{{$json.broker_id}}",
  "source": "PropStream API",
  "status": "new"
}
```

---

## 📈 Performance Optimization

### Indexes
```sql
-- Create indexes for common queries
CREATE INDEX idx_leads_broker_status ON leads(assigned_broker_id, status);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_interactions_lead_id ON interactions(lead_id);
CREATE INDEX idx_billing_events_broker_id ON billing_events(broker_id);
```

### Connection Pooling
- Use Supabase's built-in connection pooling
- Configure pool size based on expected load
- Monitor connection usage in dashboard

---

## 🔍 Monitoring & Analytics

### 1. Database Metrics
- Go to **Database** → **Logs**
- Monitor query performance
- Set up alerts for slow queries

### 2. Real-time Monitoring
```sql
-- Monitor lead generation rate
SELECT 
  DATE(created_at) as date,
  COUNT(*) as leads_generated,
  COUNT(DISTINCT assigned_broker_id) as active_brokers
FROM leads 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 3. Broker Performance
```sql
-- Broker performance metrics
SELECT 
  b.company_name,
  COUNT(l.id) as total_leads,
  COUNT(CASE WHEN l.status = 'funded' THEN 1 END) as funded_leads,
  ROUND(COUNT(CASE WHEN l.status = 'funded' THEN 1 END)::numeric / COUNT(l.id) * 100, 2) as conversion_rate
FROM brokers b
LEFT JOIN leads l ON b.id = l.assigned_broker_id
WHERE l.created_at >= NOW() - INTERVAL '30 days'
GROUP BY b.id, b.company_name
ORDER BY conversion_rate DESC;
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. RLS Policy Errors
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('leads', 'brokers', 'interactions');
```

#### 2. Connection Issues
- Verify API URL format: `https://your-project.supabase.co`
- Check service role key permissions
- Ensure proper headers in requests

#### 3. Real-time Not Working
- Verify table is enabled for real-time
- Check publication settings
- Ensure proper authentication

### Debug Queries
```sql
-- Check recent leads
SELECT * FROM leads ORDER BY created_at DESC LIMIT 10;

-- Check broker assignments
SELECT b.company_name, COUNT(l.id) as lead_count
FROM brokers b
LEFT JOIN leads l ON b.id = l.assigned_broker_id
GROUP BY b.id, b.company_name;

-- Check interaction counts
SELECT 
  l.id,
  l.first_name,
  l.last_name,
  COUNT(i.id) as interaction_count
FROM leads l
LEFT JOIN interactions i ON l.id = i.lead_id
GROUP BY l.id, l.first_name, l.last_name
ORDER BY interaction_count DESC;
```

---

## 📚 Next Steps

1. **Set up the database schema** using the provided SQL
2. **Configure RLS policies** for security
3. **Import the n8n workflow** and add credentials
4. **Test the integration** with sample data
5. **Set up monitoring** and alerts
6. **Deploy the frontend** to Vercel

---

## 🔗 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [n8n Supabase Node](https://docs.n8n.io/integrations/builtin/cluster-nodes/n8n-nodes-base.supabase/)
- [Real-time Subscriptions](https://supabase.com/docs/guides/realtime)

---

**Ready to launch?** Follow this guide step-by-step and you'll have a fully functional Supabase backend in under 30 minutes! 🚀
