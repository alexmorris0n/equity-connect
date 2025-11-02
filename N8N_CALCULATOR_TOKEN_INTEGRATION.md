# n8n Workflow Integration - Calculator Tokens

## Current Setup: ✅ Auto-Tokens via Database Trigger

Your n8n workflow at https://n8n.instaroute.com/workflow/GuJfO1moAZQBLzvf **doesn't need any changes** for tokens to be created.

### How It Works

```
┌─────────────────────┐
│  n8n AI Agent       │
│  Uploads Lead       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Supabase:          │
│  INSERT INTO leads  │
└──────┬──────────────┘
       │
       ▼ (trigger fires automatically)
┌─────────────────────┐
│  Supabase Trigger:  │
│  auto_create_       │
│  calculator_token() │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Token Created!     │
│  calculator_tokens  │
└─────────────────────┘
```

---

## Option 1: No Changes (Recommended)

**When to use:** If you're sending calculator links later (not immediately)

**What happens:**
- Lead gets uploaded
- Token auto-generates in background
- You can query tokens anytime later

**n8n nodes needed:** None! Your workflow works as-is.

---

## Option 2: Get Token Immediately (For Instant Emails)

**When to use:** If you want to send a calculator link right after lead creation

### Add These Nodes After "Insert Lead":

#### Node 1: Supabase Query - Get Token
**Type:** Supabase  
**Operation:** Execute SQL  
**SQL:**
```sql
SELECT token 
FROM calculator_tokens 
WHERE lead_id = '{{ $json.id }}'
LIMIT 1;
```

**Output:** `{{ $json.token }}`

#### Node 2: Build Calculator URL
**Type:** Set  
**Fields:**
- `calculator_url`: `https://your-domain.com/calculator?t={{ $json.token }}`

#### Node 3: Send Email with Link
**Type:** Email / HTTP Request  
**Body:**
```
Hi {{ $('Insert Lead').item.json.first_name }},

We've created a personalized equity calculator for your property at {{ $('Insert Lead').item.json.property_address }}.

View your options here:
{{ $json.calculator_url }}

Best regards,
Equity Connect
```

---

## Example n8n Workflow JSON (Add After Lead Insert)

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT token FROM calculator_tokens WHERE lead_id = '{{ $json.id }}' LIMIT 1"
      },
      "name": "Get Calculator Token",
      "type": "n8n-nodes-base.supabase",
      "position": [800, 300]
    },
    {
      "parameters": {
        "values": {
          "string": [
            {
              "name": "calculator_url",
              "value": "=https://equityconnect.com/calculator?t={{ $json.token }}"
            }
          ]
        }
      },
      "name": "Build Calculator URL",
      "type": "n8n-nodes-base.set",
      "position": [1000, 300]
    }
  ]
}
```

---

## Testing the Integration

### 1. Test Token Creation (After Lead Upload)

Run this query in Supabase to verify token was created:

```sql
SELECT 
  l.first_name,
  l.last_name,
  l.property_address,
  ct.token,
  ct.created_at
FROM leads l
LEFT JOIN calculator_tokens ct ON l.id = ct.lead_id
ORDER BY l.created_at DESC
LIMIT 10;
```

**Expected result:** Every lead should have a token

### 2. Test in n8n

1. Upload a test lead via your workflow
2. Check Supabase - token should exist
3. Build URL: `https://your-domain.com/calculator?t=[token]`
4. Visit URL - should show personalized calculator

---

## Troubleshooting

### ❓ Lead Created but No Token?

**Check if trigger is active:**
```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'trigger_auto_create_calculator_token';
```

Expected: `tgenabled = 'O'` (enabled)

### ❓ Need to Regenerate Token?

```sql
UPDATE calculator_tokens 
SET token = generate_random_token(12),
    expires_at = NOW() + INTERVAL '90 days'
WHERE lead_id = '[lead_id]';
```

### ❓ Token Not Showing in n8n Query?

Add a small delay (500ms) between inserting lead and querying token to ensure trigger completes.

---

## Database Trigger Details

**Function:** `auto_create_calculator_token()`  
**Trigger:** `trigger_auto_create_calculator_token`  
**Fires:** AFTER INSERT on `leads` table  
**Action:** Creates random 12-character token  
**Expiration:** 90 days from creation  

**View the trigger code:**
```sql
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'auto_create_calculator_token';
```

---

## Summary

✅ **Nothing required** - Tokens auto-generate when leads are inserted  
✅ **Optional** - Add nodes to fetch token for immediate use  
✅ **Scalable** - Works for unlimited leads  
✅ **Automatic** - No manual token management needed  

Your n8n workflow will continue to work exactly as it does now, with tokens being created automatically in the background!
