# PromptLayer Setup Guide

## ✅ Integration Complete!

PromptLayer is now integrated into your bridge. Here's how to enable it:

---

## Step 1: Sign Up for PromptLayer (5 minutes)

1. Go to **https://promptlayer.com**
2. Click "Sign Up" (free account)
3. Verify email
4. Go to **Settings → API Keys**
5. Copy your API key (starts with `pl_`)

---

## Step 2: Add API Key to Environment (1 minute)

### **Local Development**
Add to `bridge/.env`:
```bash
PROMPTLAYER_API_KEY=pl_xxxxxxxxxxxxxxxxxxxxxxxx
```

### **Production (Northflank)**
1. Go to Northflank dashboard
2. Select your bridge service
3. Go to **Environment Variables**
4. Add: `PROMPTLAYER_API_KEY` = `pl_xxxxx...`
5. Redeploy

---

## Step 3: That's It! (0 minutes)

**The integration is already done.**

Every call Barbara makes will now be logged to PromptLayer with:
- Full conversation transcript
- All metadata (purpose, objections, questions)
- Tool calls made
- Outcome
- Duration
- Tags (broker, lead, outcome, purpose)

---

## What Gets Logged

### **For Each Call:**

**Tags:**
- `barbara` - All Barbara calls
- `realtime` - OpenAI Realtime API
- Outcome: `appointment_booked`, `interested`, `not_interested`
- Money purpose: `medical`, `home_repair`, etc.
- `broker:Walter Richards` - Which broker
- `lead:John Smith` - Which lead

**Metadata:**
```json
{
  "call_id": "abc-123",
  "lead_id": "lead-uuid",
  "broker_id": "broker-uuid",
  "outcome": "appointment_booked",
  "duration_seconds": 180,
  
  "money_purpose": "medical",
  "specific_need": "Husband needs surgery - $75k",
  "amount_needed": 75000,
  "timeline": "urgent",
  "objections": ["fees_concern"],
  "questions_asked": ["Can I leave house to kids?"],
  "commitment_points": 8,
  "appointment_scheduled": true,
  
  "tool_calls_count": 3,
  "tool_calls": ["check_broker_availability", "book_appointment", "assign_tracking_number"],
  
  "email_verified": true,
  "phone_verified": true
}
```

**Conversation:**
```json
{
  "messages": [
    {"role": "assistant", "content": "Hi John, this is Barbara...", "timestamp": "..."},
    {"role": "user", "content": "I'm doing okay, thanks.", "timestamp": "..."},
    // ... full conversation
  ]
}
```

---

## What You Can Do in PromptLayer

### **1. View All Calls**
- Dashboard → Requests
- Filter by tag: `outcome:appointment_booked`
- See all successful bookings

### **2. Search Conversations**
- Search: "surgery"
- Find all calls about medical needs
- Review what worked/didn't work

### **3. Debug Failed Calls**
- Filter by: `outcome:not_interested`
- See conversation patterns
- Identify where Barbara lost them
- **Fix the prompt**

### **4. A/B Test Prompts**
- Dashboard → Prompts
- Create 2 versions:
  - "Prompt A: 5-point commitment"
  - "Prompt B: 8-point commitment"
- Split traffic 50/50
- See results in real-time
- **Pick winner in days, not weeks**

### **5. Track Tool Calls**
- See which tools are being called
- See which tools are failing
- **Your booking failure would show up immediately**

Example:
```
Tool: book_appointment
Args: {
  lead_id: "abc-123",
  broker_id: "walter-uuid",
  scheduled_for: "invalid-format"  // ← Root cause!
}
Error: "Invalid ISO 8601 format"
```

### **6. Cost Analytics**
- Cost per call
- Cost per outcome type
- Cost per broker
- **Optimize spending**

### **7. Latency Tracking**
- P50/P95/P99 latency
- By phase (greeting, qualifying, booking)
- **Optimize performance**

---

## Example Queries in PromptLayer

### **Find High-Interest Leads Who Didn't Book**
```
Filter: 
- Tag: outcome:interested
- Metadata: interest_level > 70
- Metadata: appointment_scheduled = false

Result: Leads to prioritize for follow-up
```

### **Find Common Objections**
```
Group by: metadata.objections
Count

Result:
- fees_concern: 45 calls
- spouse_approval: 32 calls
- leaving_home_to_kids: 28 calls

Action: Improve objection handling for top 3
```

### **Find Optimal Call Duration**
```
Group by: outcome
Average: duration_seconds

Result:
- appointment_booked: 210 seconds
- not_interested: 95 seconds
- interested: 180 seconds

Insight: Successful calls are longer (not rushed)
```

---

## What This Solves For You

### **Problem 1: "Which Prompt Version Works Best?"**
**Before:**
- Deploy version A for a week
- Deploy version B for a week
- Manually compare results
- **Time: 2-4 weeks**

**After:**
- A/B test both simultaneously
- PromptLayer shows winner
- **Time: 3-5 days**

### **Problem 2: "Why Did This Call Fail?"**
**Before:**
- Search logs manually
- Query database
- Read transcripts
- Guess at root cause
- **Time: 15-30 minutes per failure**

**After:**
- Click call in PromptLayer
- See tool calls + errors
- Root cause immediately visible
- **Time: 1-2 minutes**

### **Problem 3: "What Topics Are Trending?"**
**Before:**
- SQL queries
- Manual analysis
- Spreadsheet tracking
- **Time: Hours**

**After:**
- PromptLayer analytics tab
- Auto-grouped by metadata
- **Time: Seconds**

---

## Cost

**Free Tier:**
- 1,000 requests/month
- Full analytics
- A/B testing
- Unlimited team members

**Pro Tier ($49/month):**
- 10,000 requests/month
- Everything in free
- Priority support

**Your usage:**
- Testing: 100 calls/month → **Free**
- Early production: 1,000 calls/month → **Free**
- Growth: 5,000+ calls/month → **$49/month**

---

## Setup Complete!

**What we did:**
1. ✅ Installed `promptlayer` package
2. ✅ Created `promptlayer-integration.js` module
3. ✅ Integrated into `tools.js` (logs every call automatically)
4. ✅ Added to `env.template`

**What you need to do:**
1. Sign up at promptlayer.com (5 minutes)
2. Get API key
3. Add to `.env` file
4. Redeploy bridge
5. Make a call
6. See it in PromptLayer dashboard!

---

## Testing

### Make a Test Call
```bash
# Barbara makes a call
# ... call happens ...
# Call ends
```

### Check PromptLayer
1. Go to promptlayer.com/dashboard
2. Click "Requests"
3. See your call logged with:
   - Full transcript
   - Metadata
   - Tool calls
   - Outcome
   - Cost
   - Latency

### Filter by Tag
- Click tag: `appointment_booked`
- See all successful bookings
- Review what Barbara said that worked

---

## Debugging Your Specific Failure

**Once PromptLayer is enabled, you can:**

1. Go to PromptLayer dashboard
2. Find today's failed booking call
3. Click it
4. See tool call section:
   ```
   Tool: book_appointment
   Input: {...}
   Error: "..."  ← Root cause!
   ```
5. Fix immediately

**Instead of 30 minutes of manual debugging!**

---

## Next Steps

1. ✅ Integration complete (already done)
2. ⏳ Get PromptLayer API key
3. ⏳ Add to .env
4. ⏳ Redeploy bridge
5. ⏳ Make test call
6. ⏳ View in PromptLayer dashboard
7. ⏳ Debug that booking failure in 2 minutes!

**Want me to commit these changes?** 🚀
