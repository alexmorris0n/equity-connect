# PropertyRadar List Creation - Quick Guide

## Automated Setup via n8n Helper Workflow

Use the one-time helper workflow to automatically:
1. Fetch broker's ZIP codes from Supabase
2. Create PropertyRadar dynamic list via API
3. Update broker record with list_id

---

## Steps:

### 1. Import Helper Workflow

Import `workflows/propertyradar-create-list-helper.json` to n8n

**What it does:**
- Fetches broker + territories from Supabase
- Creates PropertyRadar list with all 31 ZIPs + reverse mortgage criteria
- Updates broker record with the new list_id

### 2. Run the Helper

1. Click "Execute Workflow"
2. Watch the nodes execute:
   - ✅ Get Broker
   - ✅ Get Broker Territories (31 ZIPs)
   - ✅ Prepare List Data
   - ✅ **Create PropertyRadar List** ← API call
   - ✅ Extract List ID
   - ✅ Update Broker Record (in Supabase)
   - ✅ Final Confirmation

### 3. Verify

Check the final output - you'll see:
```json
{
  "status": "complete",
  "message": "Broker setup complete. Ready to run main workflow.",
  "list_id": "L7A8B9C0",
  "broker_name": "My Reverse Options"
}
```

### 4. Verify in Supabase

```sql
SELECT company_name, propertyradar_list_id
FROM brokers
WHERE id = '6a3c5ed5-664a-4e13-b019-99fe8db74174';
```

Should show:
```
company_name: My Reverse Options
propertyradar_list_id: L7A8B9C0
```

### 5. Run Main Workflow

Now run `PropertyRadar List Pull Worker (Production)` - it will work!

---

## List Criteria Created:

The helper creates a dynamic list with these filters:

**Location:**
- ZipFive: All 31 broker ZIPs (90001, 90002, ... 90506)

**Owner Details:**
- Age: >= 62
- Owner Occupied: Yes (isSameMailingOrExempt = 1)

**Property:**
- Property Type: SFR, DPX, TPX, FPX, CND (single-family to 4-plex, condos)

**Value & Equity:**
- AVM: $400,000 - $3,000,000
- Available Equity: >= $150,000
- Equity Percent: >= 40%
- CLTV: <= 60%

---

## For Additional Brokers:

To set up more brokers, edit the helper workflow:

**Node: "Get Broker"**
- Change filter: `keyValue` to the new broker's UUID

Then run again. Each broker gets their own list.

---

## Verify List in PropertyRadar

After creation, log in to PropertyRadar:
- Go to **Lists**
- Find `RM_My_Reverse_Options`
- Click to see property count
- Should show properties matching all criteria

---

## Troubleshooting

**Error: "List creation failed"**
- Check PropertyRadar API key is valid
- Verify you have list creation permissions
- Check error response from PropertyRadar

**Error: "No ZIPs found"**
- Verify broker has territories in `broker_territories` table
- Check `active = true` on territories

**List created but no properties**
- Criteria may be too restrictive
- Check PropertyRadar UI to adjust filters
- Try removing CLTV or equity % filters

---

## Cost Note

Creating a list is **FREE** - no PropertyRadar charges.  
Pulling properties from the list **costs** ~$0.75 per property.

---

**Ready to go!** Import helper workflow and run it once per broker.

