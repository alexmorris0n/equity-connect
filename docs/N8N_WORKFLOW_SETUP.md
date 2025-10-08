# 🔄 n8n Workflow Setup Guide

## ✅ Workflows Created

You now have 4 production-ready n8n workflows:

1. **`batchdata-pull-worker.json`** - Idempotent lead pulling from BatchData API
2. **`enrichment-pipeline-waterfall.json`** - 3-stage waterfall skip-trace (Melissa → BatchData → Verify)
3. **`campaign-feeder-daily.json`** - Daily campaign feeder to Instantly
4. **`error-handler-dlq-retry.json`** - DLQ monitoring with exponential backoff

---

## 📦 Import Workflows into n8n

### **Step 1: Access n8n**
```bash
# If running locally
npm install -g n8n
n8n start

# Or use Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

Visit: http://localhost:5678

### **Step 2: Import Each Workflow**
1. In n8n UI, click **"+"** → **"Import from File"**
2. Select each JSON file from `workflows/` directory
3. Click **"Import"**
4. Repeat for all 4 workflows

---

## 🔐 Configure Credentials

You'll need to set up these credentials in n8n:

### **1. Supabase Service Key** (Required for all workflows)

**Type**: HTTP Header Auth

**Configuration**:
- **Name**: `apikey`
- **Value**: Your Supabase service role key

**To get your Supabase key**:
1. Visit https://supabase.com/dashboard/project/mxnqfwuhvurajrgoefyg/settings/api
2. Copy the **`service_role`** key (not the anon key!)
3. Paste into n8n credential

---

### **2. BatchData API Key**

**Type**: HTTP Header Auth

**Configuration**:
- **Name**: `Authorization`
- **Value**: `Bearer YOUR_BATCHDATA_API_KEY`

**To get BatchData key**:
1. Sign up at https://batchdata.io
2. Go to API Keys section
3. Generate new key
4. Copy and paste into n8n

---

### **3. Melissa API Key**

**Type**: HTTP Header Auth (or Query Parameter)

**Configuration**:
- Can be passed as query parameter `id` in URL
- Or as header: `Authorization: YOUR_MELISSA_KEY`

**To get Melissa key**:
1. Sign up at https://www.melissa.com/developer
2. Subscribe to Personator API
3. Copy API key from dashboard

---

### **4. Instantly API Key**

**Type**: HTTP Header Auth

**Configuration**:
- **Name**: `Authorization`
- **Value**: `Bearer YOUR_INSTANTLY_API_KEY`

**To get Instantly key**:
1. Log into https://instantly.ai
2. Go to Settings → API
3. Generate API key
4. Copy and paste into n8n

---

### **5. SignalWire** (Optional - for phone verification)

**Type**: HTTP Header Auth

**Configuration**:
- **Username**: Your SignalWire Project ID
- **Password**: Your SignalWire Token
- Use Basic Auth encoding

---

## 🔧 Environment Variables

Set these in your n8n environment:

### **Required**:
```env
SUPABASE_URL=https://mxnqfwuhvurajrgoefyg.supabase.co
BATCHDATA_BASE_URL=https://api.batchdata.io
MELISSA_BASE_URL=https://personator.melissadata.net
INSTANTLY_CAMPAIGN_ID=your_campaign_id_here
```

### **Optional**:
```env
SIGNALWIRE_PROJECT=your_project_id
SIGNALWIRE_TOKEN=your_token
SIGNALWIRE_SPACE=your_space.signalwire.com
```

### **How to set in n8n:**
1. Settings → Environment Variables
2. Add each variable
3. Save and restart n8n if needed

---

## 🚀 Activate Workflows

### **Activation Order** (Important!):

1. ✅ **Error Handler** - Activate first (monitors DLQ)
2. ✅ **Enrichment Pipeline** - Activate second (processes queued leads)
3. ✅ **BatchData Pull Worker** - Activate third (starts pulling leads)
4. ✅ **Campaign Feeder** - Activate last (sends to Instantly)

### **To Activate**:
1. Open each workflow in n8n
2. Click toggle switch in top-right corner
3. Verify it shows "Active"

---

## 📊 Workflow Schedules

| Workflow | Schedule | Description |
|----------|----------|-------------|
| **BatchData Pull Worker** | Every 1 hour | Pulls new leads from BatchData |
| **Enrichment Pipeline** | Every 5 minutes | Processes pending enrichments |
| **Campaign Feeder** | Daily at 8am | Adds contactable leads to Instantly |
| **Error Handler** | Every 5 minutes | Retries failed operations |

---

## 🧪 Testing

### **Test Workflow 1: BatchData Pull Worker**

1. **Manual Test**:
   - Open workflow in n8n
   - Click "Execute Workflow" button
   - Check execution log

2. **Verify**:
   ```sql
   -- Check if leads were inserted
   SELECT COUNT(*) FROM leads WHERE source = 'batchdata';
   
   -- Check source events recorded
   SELECT * FROM lead_source_events ORDER BY created_at DESC LIMIT 5;
   
   -- Check bookmark updated
   SELECT * FROM source_bookmarks;
   ```

3. **Expected Result**:
   - Leads inserted/updated in `leads` table
   - `lead_source_events` row created
   - `source_bookmarks` updated with page number
   - `pipeline_events` created for each lead

---

### **Test Workflow 2: Enrichment Pipeline**

1. **Manual Test**:
   - Ensure you have pending enrichments:
     ```sql
     SELECT * FROM pipeline_events WHERE event_type = 'enrich' AND status = 'pending';
     ```
   - Execute workflow manually

2. **Verify**:
   ```sql
   -- Check if MAK was added
   SELECT id, mak FROM leads WHERE mak IS NOT NULL LIMIT 5;
   
   -- Check phones/emails merged
   SELECT id, phones, emails FROM leads WHERE jsonb_array_length(phones) > 0 LIMIT 5;
   
   -- Check quality scores computed
   SELECT id, quality_score, status FROM leads ORDER BY quality_score DESC LIMIT 10;
   ```

3. **Expected Result**:
   - MAK populated
   - Phones/emails arrays populated
   - Quality scores computed
   - Status updated to `contactable` or `enriched`

---

### **Test Workflow 3: Campaign Feeder**

1. **Manual Test**:
   - Ensure you have contactable leads:
     ```sql
     SELECT * FROM vw_campaign_ready_leads LIMIT 5;
     ```
   - Execute workflow manually

2. **Verify**:
   ```sql
   -- Check leads added to campaign
   SELECT COUNT(*) FROM leads WHERE added_to_campaign_at IS NOT NULL;
   
   -- Check microsites created
   SELECT id, lead_id, full_url FROM microsites ORDER BY created_at DESC LIMIT 5;
   
   -- Check interactions created
   SELECT * FROM interactions ORDER BY created_at DESC LIMIT 5;
   ```

3. **Check Instantly**:
   - Log into Instantly.ai
   - Check campaign for new contacts
   - Verify custom variables populated

---

### **Test Workflow 4: Error Handler**

1. **Create Test DLQ Item**:
   ```sql
   INSERT INTO dlq (stage, payload, error, retry_after, attempts) VALUES
   ('enrich', '{"lead_id": "test-uuid-here"}', 'Test error', NOW(), 0);
   ```

2. **Execute Workflow**:
   - Should detect DLQ item
   - Should requeue to `pipeline_events`
   - Should delete from DLQ on success

3. **Verify**:
   ```sql
   -- DLQ should be empty after success
   SELECT * FROM dlq;
   
   -- Pipeline event should be created
   SELECT * FROM pipeline_events WHERE event_data->>'retry_from_dlq' = 'true';
   ```

---

## 🔍 Monitoring & Debugging

### **Check Workflow Executions**:
1. In n8n: **Executions** tab
2. Filter by workflow name
3. Click execution to see detailed log

### **Check Database**:
```sql
-- Lead counts by source
SELECT source, COUNT(*) FROM leads GROUP BY source;

-- Quality score distribution
SELECT * FROM vw_lead_quality_summary;

-- Recent pipeline events
SELECT event_type, status, COUNT(*) 
FROM pipeline_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type, status;

-- DLQ items
SELECT stage, COUNT(*), AVG(attempts) 
FROM dlq 
GROUP BY stage;
```

### **Common Issues**:

| Issue | Solution |
|-------|----------|
| "Unauthorized" errors | Check Supabase service key is correct |
| "Function not found" | Run Phase 1 migration |
| No leads pulling | Check BatchData API key and query params |
| Enrichment stuck | Check Melissa API key and rate limits |
| DLQ filling up | Check error messages, may need API fix |

---

## 📈 Performance Tuning

### **BatchData Pull Worker**:
- Adjust `page_size` (50-200) based on API limits
- Change cron schedule (hourly, every 2 hours, etc.)
- Add rate limiting between requests

### **Enrichment Pipeline**:
- Adjust batch size (10-100 leads per run)
- Set quality threshold (60 is default)
- Enable/disable Stage 2 based on budget

### **Campaign Feeder**:
- Change daily cap (default 250)
- Adjust timing (8am local time)
- Add filters for better targeting

### **Error Handler**:
- Adjust backoff multiplier (currently 2x)
- Change max attempts (currently 3)
- Add alerting for persistent failures

---

## 🚨 Error Handling

### **All workflows include**:
- `continueOnFail: true` for API calls
- Failed items go to DLQ
- Exponential backoff retry
- Detailed error logging

### **To add alerting**:
1. Add **Email** or **Slack** node to each workflow
2. Connect to error paths
3. Configure with your notification details

---

## 📚 Additional Resources

- **n8n Docs**: https://docs.n8n.io
- **Supabase RPC**: https://supabase.com/docs/guides/database/functions
- **BatchData API**: https://docs.batchdata.io
- **Melissa API**: https://www.melissa.com/developer
- **Instantly API**: https://developer.instantly.ai

---

## ✅ Checklist

Before going to production:

- [ ] All 4 workflows imported
- [ ] All credentials configured
- [ ] Environment variables set
- [ ] Test run of each workflow successful
- [ ] Database functions verified
- [ ] Supabase RLS policies reviewed
- [ ] Error Handler active and monitoring
- [ ] Backup/rollback plan in place
- [ ] Rate limits understood and configured
- [ ] Monitoring/alerting set up

---

## 🎉 You're Ready!

Once all workflows are active, your lead generation pipeline will:

1. ✅ Pull leads from BatchData (idempotent)
2. ✅ Enrich with Melissa → BatchData waterfall
3. ✅ Score leads (0-100) and route by status
4. ✅ Feed contactable leads to Instantly daily
5. ✅ Retry failures automatically
6. ✅ Track everything in Supabase

**Next**: Monitor for 24-48 hours, then scale up!

