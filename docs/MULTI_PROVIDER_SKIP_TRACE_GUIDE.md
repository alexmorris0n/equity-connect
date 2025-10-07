# 🔍 Multi-Provider Skip Trace Router Guide

## 🎯 Overview

Your system now has **flexible, multi-provider skip tracing** that automatically routes requests across 6+ providers with intelligent fallback, cost tracking, and performance optimization.

---

## 🏗️ Architecture

### Supported Providers

| Provider | Priority | Cost/Record | Success Rate | Best For |
|----------|----------|-------------|--------------|----------|
| **Melissa Data** | 1 (Highest) | $0.085 | 85-95% | Address verification + contact |
| **TrueTrace** | 2 | $0.12 | 80-90% | Balance of cost/accuracy |
| **Spokeo** | 3 | $0.15 | 75-85% | Consumer data focus |
| **TLO** | 4 | $0.25 | 90-95% | Deep skip trace |
| **BeenVerified** | 5 | $0.18 | 70-80% | Background checks |
| **PropStream** | 6 (Fallback) | $0.09 | 40-60% | Bulk property data |

### How It Works

```
┌─────────────────┐
│  Lead Created   │
│  (BatchData)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auto-Enqueued   │
│  Skip Trace     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    Provider Router (Smart Logic)    │
│  • Checks priority                  │
│  • Avoids already-tried providers   │
│  • Considers success rates          │
│  • Tracks costs                     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Try Melissa     │ ──Success──> Update Lead
│    (Priority 1) │
└────────┬────────┘
         │ Failed
         ▼
┌─────────────────┐
│ Try TrueTrace   │ ──Success──> Update Lead
│    (Priority 2) │
└────────┬────────┘
         │ Failed
         ▼
┌─────────────────┐
│ Try Spokeo      │ ──Success──> Update Lead
│    (Priority 3) │
└────────┬────────┘
         │ Failed
         ▼
┌─────────────────┐
│  All Failed     │
│  → Send to DLQ  │
└─────────────────┘
```

---

## 🚀 Quick Start

### 1. Apply Database Migration

```bash
# Run the skip trace router migration
psql $SUPABASE_DB_URL < config/skip-trace-router-migration.sql
```

This creates:
- `skip_trace_providers` - Provider configuration
- `skip_trace_results` - All trace results with payloads
- `skip_trace_dlq` - Dead Letter Queue for failures
- Helper functions for routing and tracking

### 2. Configure API Keys

Add your provider API keys to `.env`:

```bash
# Melissa Data (Priority 1)
MELISSA_API_KEY=your_melissa_key_here

# TrueTrace (Priority 2)
TRUETRACE_API_KEY=your_truetrace_key_here

# Spokeo (Priority 3)
SPOKEO_API_KEY=your_spokeo_key_here

# TLO (Priority 4) - Optional
TLO_API_KEY=your_tlo_key_here

# BeenVerified (Priority 5) - Optional
BEENVERIFIED_API_KEY=your_beenverified_key_here

# PropStream (Fallback) - Already configured
PROPSTREAM_API_KEY=your_propstream_key_here
```

### 3. Import n8n Workflow

Import `workflows/skip-trace-router-workflow.json` into n8n. This workflow:
- Runs every 5 minutes
- Processes 10 leads per batch
- Automatically routes to best provider
- Retries with fallback providers on failure
- Updates leads with contact info

### 4. Test the System

```sql
-- Manually add a test lead to the queue
INSERT INTO skip_trace_queue (lead_id, priority, status)
SELECT id, 5, 'pending' 
FROM leads 
WHERE phone IS NULL OR email IS NULL
LIMIT 1;

-- Check queue status
SELECT * FROM skip_trace_queue WHERE status = 'pending';

-- View provider performance
SELECT * FROM skip_trace_provider_performance;
```

---

## ⚙️ Configuration

### Adjusting Provider Priority

```sql
-- Set Melissa as highest priority (already default)
UPDATE skip_trace_providers 
SET priority = 1, is_active = TRUE 
WHERE provider_name = 'Melissa Data';

-- Disable a provider
UPDATE skip_trace_providers 
SET is_active = FALSE 
WHERE provider_name = 'BeenVerified';

-- Adjust costs based on your actual pricing
UPDATE skip_trace_providers 
SET cost_per_record = 0.12 
WHERE provider_name = 'TrueTrace';
```

### Setting Fallback Chain

```sql
-- Configure fallback providers for a specific queue item
UPDATE skip_trace_queue
SET 
  primary_provider_id = (SELECT id FROM skip_trace_providers WHERE provider_name = 'Melissa Data'),
  fallback_provider_ids = ARRAY[
    (SELECT id FROM skip_trace_providers WHERE provider_name = 'TrueTrace'),
    (SELECT id FROM skip_trace_providers WHERE provider_name = 'Spokeo')
  ]
WHERE lead_id = 'your-lead-id';
```

---

## 📊 Monitoring & Analytics

### Check Provider Performance

```sql
-- Real-time provider stats
SELECT * FROM skip_trace_provider_performance
ORDER BY actual_success_rate DESC;

-- View recent results
SELECT 
  provider_name,
  status,
  confidence_score,
  response_time_ms,
  cost,
  created_at
FROM skip_trace_results
ORDER BY created_at DESC
LIMIT 20;

-- Cost analysis
SELECT 
  provider_name,
  COUNT(*) as total_traces,
  SUM(cost) as total_spent,
  AVG(cost) as avg_cost
FROM skip_trace_results
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY provider_name
ORDER BY total_spent DESC;
```

### Dead Letter Queue (Failed Traces)

```sql
-- View items needing manual review
SELECT 
  d.id,
  l.first_name,
  l.last_name,
  l.property_address,
  d.failed_providers,
  d.total_attempts,
  d.total_cost,
  d.last_error
FROM skip_trace_dlq d
JOIN leads l ON d.lead_id = l.id
WHERE requires_manual_review = TRUE
ORDER BY d.created_at DESC;

-- Mark as reviewed
UPDATE skip_trace_dlq
SET 
  requires_manual_review = FALSE,
  reviewed_at = NOW(),
  reviewed_by = 'admin',
  resolution = 'Manually traced via phone'
WHERE id = 'dlq-id-here';
```

---

## 🧪 Testing Providers

### Test Individual Provider

```sql
-- Test Melissa Data
SELECT * FROM route_skip_trace_request(
  'queue-id-here',
  'Melissa Data'  -- Force specific provider
);

-- Test with mock data
INSERT INTO skip_trace_queue (lead_id, status, priority)
VALUES ('test-lead-id', 'pending', 10);
```

### Compare Provider Results

```sql
-- Compare results for same address across providers
SELECT 
  provider_name,
  status,
  confidence_score,
  phones,
  emails,
  cost,
  response_time_ms
FROM skip_trace_results
WHERE input_address = '123 Main St'
  AND input_city = 'San Francisco'
ORDER BY created_at DESC;
```

---

## 🔧 Advanced Features

### Auto-Retry Logic

The system automatically:
- Tries primary provider first
- Falls back to configured alternatives
- Tracks attempts per provider
- Moves to DLQ after max retries (default: 3)

### Cost Optimization

```sql
-- Set daily cost limits per provider
UPDATE skip_trace_providers
SET metadata = metadata || jsonb_build_object('daily_budget', 50.00)
WHERE provider_name = 'TLO';

-- Monitor daily spend
SELECT 
  provider_name,
  DATE(created_at) as date,
  COUNT(*) as traces,
  SUM(cost) as daily_spend
FROM skip_trace_results
WHERE created_at >= CURRENT_DATE
GROUP BY provider_name, DATE(created_at);
```

### Performance Updates

```sql
-- Update provider stats (run daily via cron)
SELECT update_provider_stats();

-- Manually refresh statistics
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_new_leads_daily;
```

---

## 🎯 Best Practices

### 1. **Start with Free Trials**
- Sign up for free trials with each provider
- Test accuracy and API reliability
- Compare results for your specific use case

### 2. **Optimize Priority Order**
- Put most accurate provider first
- Consider cost vs. success rate
- Monitor actual performance weekly

### 3. **Set Budget Alerts**
```sql
-- Create daily spend alert view
CREATE VIEW daily_skip_trace_spend AS
SELECT 
  DATE(created_at) as date,
  SUM(cost) as total_spend,
  COUNT(*) as total_traces
FROM skip_trace_results
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 4. **Monitor Queue Health**
```sql
-- Check for stuck items
SELECT 
  id,
  lead_id,
  status,
  retry_count,
  AGE(NOW(), created_at) as age
FROM skip_trace_queue
WHERE status = 'pending'
  AND started_at < NOW() - INTERVAL '1 hour';
```

---

## 🆘 Troubleshooting

### Queue Not Processing

```sql
-- Check for stuck items
UPDATE skip_trace_queue
SET status = 'pending', started_at = NULL
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '10 minutes';
```

### Provider Failing

```sql
-- Disable problematic provider
UPDATE skip_trace_providers
SET is_active = FALSE
WHERE provider_name = 'ProviderName';

-- Check error patterns
SELECT 
  provider_name,
  error_message,
  COUNT(*) as occurrences
FROM skip_trace_queue
WHERE status = 'failed'
  AND error_message IS NOT NULL
GROUP BY provider_name, error_message
ORDER BY occurrences DESC;
```

### High Costs

```sql
-- Identify expensive providers
SELECT 
  provider_name,
  COUNT(*) as uses,
  AVG(cost) as avg_cost,
  SUM(cost) as total_cost,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 2) as success_rate
FROM skip_trace_results
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY provider_name
ORDER BY total_cost DESC;
```

---

## 🔄 Integration with BatchData Pipeline

The skip-trace router is **automatically integrated** with your BatchData dedup pipeline:

1. BatchData pulls new leads
2. Dedup logic identifies unique properties
3. New leads auto-enqueued to `skip_trace_queue`
4. Router processes queue every 5 minutes
5. Results update lead records with contact info
6. Leads ready for email campaigns

```sql
-- View pipeline status
SELECT 
  (SELECT COUNT(*) FROM leads WHERE source = 'BatchData') as total_batchdata_leads,
  (SELECT COUNT(*) FROM skip_trace_queue WHERE status = 'pending') as pending_traces,
  (SELECT COUNT(*) FROM skip_trace_queue WHERE status = 'completed') as completed_traces,
  (SELECT COUNT(*) FROM skip_trace_dlq WHERE requires_manual_review = TRUE) as dlq_items;
```

---

## 📈 Expected Results

With multi-provider routing:
- **Success Rate**: 85-95% (vs 40% with PropStream alone)
- **Cost**: $0.09-$0.15 per successful trace
- **Speed**: 2-5 seconds per provider attempt
- **Fallback**: Max 3 provider attempts per lead

---

## ✅ Summary

You now have **enterprise-grade skip tracing** with:
- ✅ 6 provider integrations (Melissa, TrueTrace, Spokeo, TLO, BeenVerified, PropStream)
- ✅ Automatic fallback on failure
- ✅ Cost tracking and optimization
- ✅ Performance monitoring
- ✅ Dead Letter Queue for manual review
- ✅ Seamless integration with BatchData pipeline

**Next Steps:**
1. Sign up for provider trials
2. Configure API keys
3. Run migration
4. Import workflow
5. Monitor performance
6. Adjust priorities based on results

