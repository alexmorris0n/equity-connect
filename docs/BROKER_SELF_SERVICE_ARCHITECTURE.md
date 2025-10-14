# Broker Self-Service Architecture - Complete Integration

## Vision: Broker Onboarding in Vercel UI

Admin creates a broker in your Vercel Next.js UI:
- Enter company details
- Select/paste ZIP codes
- Set daily lead capacity
- Click "Save"

**→ Automatically creates PropertyRadar list + starts pulling leads next day at 6am**

---

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ VERCEL NEXT.JS UI (Admin Panel)                             │
│                                                              │
│  [Broker Setup Form]                                        │
│   - Company Name: "My Reverse Options"                      │
│   - Email: wrichards@myreverseoptions.com                   │
│   - Daily Capacity: 250                                     │
│   - ZIPs: 90016, 90018, 90019... (31 total)                │
│   [Save Button] ────────────────────┐                       │
│                                      │                       │
└──────────────────────────────────────┼───────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────┐
│ VERCEL API ROUTE: /api/brokers/setup                        │
│                                                              │
│  1. Insert broker → Supabase                                │
│  2. Insert territories → Supabase                           │
│  3. Trigger n8n webhook →                                   │
└──────────────────────────────────────┼───────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────┐
│ N8N WEBHOOK: PropertyRadar Broker Setup                     │
│                                                              │
│  1. Validate payload                                        │
│  2. Create PropertyRadar dynamic list (API)                 │
│     → Name: RM_My_Reverse_Options                          │
│     → Criteria: 31 ZIPs + reverse mortgage filters         │
│  3. Extract list_id from response                          │
│  4. Update broker.propertyradar_list_id → Supabase         │
│  5. Return { success, list_id } → Vercel                   │
└──────────────────────────────────────┼───────────────────────┘
                                       ↓
┌─────────────────────────────────────────────────────────────┐
│ VERCEL UI: Success Screen                                   │
│                                                              │
│  ✅ Broker Created Successfully!                            │
│  📋 PropertyRadar List ID: L7A8B9C0                         │
│  📍 31 ZIP codes configured                                │
│  🚀 Daily pulls start tomorrow at 6am                      │
│                                                              │
│  [View Broker Dashboard] [Configure More Settings]         │
└─────────────────────────────────────────────────────────────┘
```

---

## Daily Lead Pulling (Automatic)

```
6:00 AM Daily (n8n Schedule Trigger)
  ↓
PropertyRadar List Pull Worker
  ↓
1. Fetch active brokers → Supabase
2. Get RadarIDs from list → PropertyRadar API
3. Filter duplicates → Supabase RPC
4. Check capacity → Supabase RPC
5. Purchase properties → PropertyRadar API ($187.50)
6. Parse & hash → Code
7. Upsert leads → Supabase
  ↓
250 new leads in database → Ready for enrichment
```

---

## Files Created

### n8n Workflows:

1. ✅ **`workflows/propertyradar-list-pull-worker.json`**
   - **Daily pull workflow** (13 nodes)
   - Runs at 6am daily
   - Pulls leads from PropertyRadar lists

2. ✅ **`workflows/propertyradar-broker-setup-webhook.json`**
   - **Webhook for creating brokers** (7 nodes)
   - Called from Vercel UI on "Save"
   - Creates PropertyRadar list + updates Supabase

3. ✅ **`workflows/propertyradar-update-list-webhook.json`**
   - **Webhook for updating territories** (5 nodes)
   - Called when admin edits ZIP codes
   - Updates PropertyRadar list criteria

4. ✅ **`workflows/propertyradar-create-list-helper.json`**
   - **One-time manual helper** (8 nodes)
   - For testing or one-off setups
   - Not needed once webhooks are in place

### Vercel Templates (for your Next.js app):

5. **`app/api/brokers/setup/route.ts`** (template provided)
   - Creates broker in Supabase
   - Triggers n8n setup webhook
   - Returns list_id to UI

6. **`app/api/brokers/[id]/territories/route.ts`** (template provided)
   - Updates ZIP codes in Supabase
   - Triggers n8n update webhook

7. **`components/BrokerSetupForm.tsx`** (template provided)
   - React form for broker creation
   - Calls API route on submit

### Database:

8. ✅ **Supabase functions** (already created):
   - `update_broker_list_id(p_broker_id, p_list_id)`
   - `filter_new_radar_ids(ids[])`
   - `broker_leads_today(p_broker)`
   - `upsert_lead_from_radar(p jsonb)`

### Documentation:

9. ✅ **`docs/VERCEL_BROKER_SETUP_INTEGRATION.md`**
   - Complete integration guide
   - API route templates
   - React component examples
   - Testing instructions

10. ✅ **`docs/PROPERTYRADAR_LIST_CREATION_GUIDE.md`**
    - Manual setup guide
    - Criteria explanation

---

## Implementation Checklist

### Phase 1: n8n Setup (Do This First)

- [ ] Import `propertyradar-broker-setup-webhook.json` to n8n
- [ ] Import `propertyradar-update-list-webhook.json` to n8n
- [ ] Activate both webhooks
- [ ] Copy webhook URLs:
  - Setup: `https://n8n.instaroute.com/webhook/propertyradar-setup`
  - Update: `https://n8n.instaroute.com/webhook/propertyradar-update`
- [ ] Test webhooks with curl

### Phase 2: Vercel Integration (Build UI)

- [ ] Add webhook URLs to `.env.local`
- [ ] Create `app/api/brokers/setup/route.ts`
- [ ] Create `app/api/brokers/[id]/territories/route.ts`
- [ ] Create `components/BrokerSetupForm.tsx`
- [ ] Add broker setup page to admin panel
- [ ] Test end-to-end

### Phase 3: Testing

- [ ] Create test broker via UI
- [ ] Verify PropertyRadar list created
- [ ] Verify Supabase updated with list_id
- [ ] Run daily pull workflow manually
- [ ] Verify leads inserted
- [ ] Edit broker ZIPs
- [ ] Verify PropertyRadar list updated

### Phase 4: Production

- [ ] Enable daily trigger (6am)
- [ ] Monitor first week
- [ ] Check costs vs estimates
- [ ] Optimize based on results

---

## Key Benefits of This Architecture

✅ **Zero manual PropertyRadar work** - List creation automated  
✅ **Self-service broker onboarding** - Admins do it in UI  
✅ **Territory flexibility** - Easy to add/remove ZIPs  
✅ **Audit trail** - All changes tracked in Supabase  
✅ **Cost controlled** - Daily capacity limits enforced  
✅ **Dedup safe** - Triple-layer protection  

---

**You now have everything to build the full self-service broker system!** 

Import the n8n webhooks first, then I can help build the Vercel UI components when you're ready.
