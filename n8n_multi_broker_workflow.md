# Master n8n Workflow for Multi-Broker Lead Automation

This document describes how to build **one centralized n8n workflow** that pulls Net-New leads from PropStream, skip-traces them, fills daily quotas for multiple brokers, and pushes results to Supabase + Instantly.

---

## 🔑 High-Level Design

- **One workflow** (easy to maintain and tweak downstream logic).
- **Cron trigger** (daily).
- **Broker definitions** (saved searches, quotas, Instantly campaigns).
- **Loop per broker**:
  1. Call PropStream Net-New Export.
  2. Skip trace the batch.
  3. Filter contactable leads (phone/email).
  4. Accumulate until quota filled.
  5. Push to Supabase.
  6. Push to Instantly.

---

## 🚀 Tech Stack

- **Workflow Engine**: n8n
- **Data Source**: PropStream API (Net-New leads + Skip-trace)
- **Database**: Supabase (PostgreSQL)
- **Email Platform**: Instantly.ai
- **Frontend**: Vue.js/Next.js on Vercel
- **AI Services**: OpenAI GPT-4 (for persona assignment)
- **Data Enrichment**: People Data Labs (optional)

## 💰 Cost Structure

- **PropStream**: $97/month (includes 250k leads exported)
- **PropStream Skip-trace**: $27/month (unlimited, ~40% success rate)
- **Supabase**: $25/month (Pro plan)
- **Instantly**: $37/month (Starter plan)
- **Vercel**: $20/month (Pro plan)
- **SignalWire**: $15/month (call pool management)
- **People Data Labs**: $0-50/month (optional, pay-per-use)
- **Total**: ~$221-271/month vs $500+ with traditional CRM

## 🎯 Frontend Architecture

The Vue.js/Next.js frontend will be built on Vercel and will include:

1. **Broker Dashboard**: Real-time lead tracking, performance metrics
2. **Lead Management**: View, filter, and manage assigned leads
3. **Campaign Analytics**: Email performance, conversion rates
4. **Billing Portal**: Track costs, view invoices, payment history
5. **Admin Panel**: Manage brokers, quotas, and system settings

## 📊 Expected Performance

- **Daily Volume**: 100+ qualified leads per broker
- **Email Performance**: 25-35% open rates, 3-5% reply rates
- **Lead Quality**: Skip-traced with verified contact info
- **Revenue Projection**: $80,000+ monthly with 20-30x ROI

---

## ⚙️ Workflow Steps (n8n)

### 1. Cron
- Daily trigger (set to your preferred time).

### 2. Set Brokers (Static JSON or from Supabase)
```json
[
  {"broker":"smith","searchId":"Broker-Smith-95112,95113,95116","quota":100,"campaignId":"INST_Smith"},
  {"broker":"jones","searchId":"Broker-Jones-94085,94086","quota":250,"campaignId":"INST_Jones"},
  {"broker":"davis","searchId":"Broker-Davis-94501,94502","quota":50,"campaignId":"INST_Davis"}
]
```

### 3. Split In Batches
- Iterates brokers one at a time.

### 4. Initialize Accumulator
```json
{
  "usable": [],
  "attempts": 0
}
```

### 5. Loop Until Quota Filled
- **IF usable < quota AND attempts < 8 → run loop**:
  1. **PropStream Net-New Export**
     - `POST https://api.propstream.com/exports/net-new`
     - Body:
       ```json
       {"savedSearchId": "{{ $json.searchId }}", "limit": 200}
       ```
  2. **PropStream Skip Trace**
     - `POST https://api.propstream.com/skip-trace`
     - Body: `items: {{$json["data"].records}}`
  3. **Function: Filter Contactable**
     ```js
     const batch = items[0].json.results || [];
     const out = batch.filter(r => (r.phone?.length || r.email?.length));
     return out.map(r => ({json:r}));
     ```
  4. **Function: Accumulate**
     ```js
     const prev = $json.usable || [];
     const now = items.map(i=>i.json);
     const merged = prev.concat(now);
     return [{json:{
       usable: merged.slice(0, $json.quota),
       attempts: ($json.attempts||0)+1,
       quota: $json.quota
     }}];
     ```

### 6. Exit Loop
- When usable >= quota or attempts >= 8.

### 7. Write to Supabase
- Table: `leads`
- Dedup by `property_id` or address hash.
- Example fields:
  - `id`, `broker`, `first_name`, `last_name`, `address`, `zip`, `phones[]`, `emails[]`, `source`, `campaign_id`, `exported_at`.

### 8. Push to Instantly
- `POST https://api.instantly.ai/v1/campaigns/{{campaignId}}/leads/import`
- Body: `[{email, firstName, lastName, customFields...}]`

---

## 🔒 Best Practices

1. **Environment Variables**
   - `PROPSTREAM_API_KEY`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`
   - `INSTANTLY_API_KEY`

2. **Deduplication**
   - Even with Net-New, dedup by `property_id` or hash:  
     ```text
     hash = sha1(lower(address + zip + owner_lastname))
     ```

3. **Quota Control**
   - Daily quota per broker.
   - Max 8 loops per run to avoid infinite retries.
   - If shortfall, log it and push what you have.

4. **Validation**
   - Normalize phones (E.164).
   - Validate emails (regex or external service).
   - Require at least one phone OR email.

5. **Error Handling**
   - Wrap HTTP requests with Try/Catch.
   - Log errors to `campaign_logs`.
   - Optionally send Slack/Email alerts.

---

## 🛠️ n8n Snippets

### Accumulator (Function)
```js
const state = items[0].json;
const batch = items[1].json;
const incoming = Array.isArray(batch) ? batch : [batch];
const merged = (state.usable||[]).concat(incoming);

const seen = new Set();
const unique = merged.filter(it => {
  const key = it.property_id || (it.address + '|' + it.owner_lastname);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

return [{
  json: {
    ...state,
    usable: unique.slice(0, state.quota),
    attempts: (state.attempts||0)+1
  }
}];
```

### Contactable Filter
```js
const batch = items[0].json.data || [];
const out = batch.filter(r => {
  const hasPhone = Array.isArray(r.phone) ? r.phone.some(p=>!!p) : !!r.phone;
  const hasEmail = Array.isArray(r.email) ? r.email.some(e=>!!e) : !!r.email;
  return hasPhone || hasEmail;
});
return out.map(r => ({json:r}));
```

---

## ✅ Summary

- **One workflow** handles all brokers.  
- Each broker defined with: `searchId`, `quota`, `campaignId`.  
- Net-New + skip trace ensures **fresh, unique leads daily**.  
- Supabase + Instantly integration keeps data clean and campaigns fed.  
- Centralized maintenance: tweak once → applies to all brokers.

