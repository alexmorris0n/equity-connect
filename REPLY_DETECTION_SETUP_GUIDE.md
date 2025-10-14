# Reply Detection & Microsite Auto-Response Setup

**Version:** 1.0  
**Date:** October 13, 2025  
**Critical:** Required for reply-first strategy to work

---

## 🎯 **What This Workflow Does**

**When a lead replies to your email:**
1. ✅ Instantly sends webhook to n8n
2. ✅ AI analyzes sentiment (positive/negative/neutral)
3. ✅ If POSITIVE → Auto-sends microsite link within 60 seconds
4. ✅ If NEGATIVE → Marks lead as not interested
5. ✅ Updates database with reply timestamp and sentiment

---

## ⚡ **Quick Setup (15 minutes)**

### **Step 1: Import Workflow to n8n** (2 minutes)

1. Open n8n
2. Click **Import**
3. Select: `workflows/04-reply-detection-microsite.json`
4. Click **Import**
5. **Don't activate yet!**

---

### **Step 2: Get Webhook URL** (1 minute)

1. Open the imported workflow
2. Click on node: **"Instantly Reply Webhook"**
3. Click **"Listen for Test Event"**
4. Copy the webhook URL (looks like):
   ```
   https://n8n.instaroute.com/webhook/instantly-reply-webhook
   ```
5. **Save this URL** - you'll need it for Instantly

---

### **Step 3: Configure Instantly Webhook** (3 minutes)

1. Go to **Instantly.ai** → Settings → Webhooks
2. Click **"Add Webhook"**
3. **Event Type:** "Lead Replied"
4. **Webhook URL:** Paste the n8n webhook URL from Step 2
5. **Apply to:** All campaigns (or select your 3 campaigns)
6. Click **Save**

**Instantly will now notify n8n every time a lead replies!**

---

### **Step 4: Verify Instantly Credentials** (1 minute)

**The workflow replies from the SAME mailbox that sent the original email!**

**Why this is better:**
- ✅ Lead sees reply from same person (Sarah → Sarah)
- ✅ Stays in same email thread (better deliverability)
- ✅ Professional (no confusion)
- ✅ No additional email service needed (uses Instantly)

**Verify credentials:**
1. In n8n, click node: **"Reply from Same Mailbox"**
2. Check that Instantly credentials are selected
3. Should show: "Instantly account" ✅
4. If missing, add your Instantly API credentials

**That's it!** No SendGrid or SMTP needed - Instantly handles the reply.

---

### **Step 5: Test the Workflow** (5 minutes)

**Test with a fake reply:**

1. In workflow, click **"Instantly Reply Webhook"** node
2. Click **"Listen for Test Event"**
3. **Manually trigger a test** by sending yourself an email and replying

OR

**Use test data:**
1. Click **"Execute Workflow"**
2. Paste test webhook data in the webhook node

**Test Payload:**
```json
{
  "from_email": "test@example.com",
  "body": "YES, I'm interested in learning more!",
  "subject": "Re: Stop your payment",
  "campaign_id": "c9f0a877-a6af-4d28-bd48-ade437cf63d9",
  "timestamp": "2025-10-13T10:00:00Z"
}
```

**What you should see:**
- Sentiment: POSITIVE
- Microsite URL generated
- Email prepared (sent if configured)
- Database updated

---

### **Step 6: Activate Workflow**

Once testing looks good:
1. Click **Activate** toggle
2. Workflow will now run automatically on every reply!

---

## 🔍 **How Sentiment Analysis Works (Current)**

**Simple keyword-based detection:**

**POSITIVE triggers:**
- "yes", "interested", "info", "more", "details"
- "send", "calculate", "numbers", "call", "schedule"

**NEGATIVE triggers:**
- "stop", "unsubscribe", "not interested", "no thanks"
- "remove", "opt out", "spam", "leave me alone"

**NEUTRAL:**
- Anything else (requires human review)

---

## 🚀 **Production Upgrade (Optional):**

**Replace keyword detection with real AI:**

In the "AI Sentiment Analysis" node, replace the code with actual OpenAI/Claude API call:

```javascript
// Call OpenAI API
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{
      role: 'user',
      content: `Classify this email reply as POSITIVE, NEGATIVE, or NEUTRAL:
      
      "${replyText}"
      
      Respond with just one word: POSITIVE, NEGATIVE, or NEUTRAL`
    }],
    temperature: 0
  })
});

const data = await response.json();
const sentiment = data.choices[0].message.content.trim();
```

**This gives much better accuracy** for complex replies.

---

## 📊 **Database Updates**

**The workflow uses the `log_lead_reply()` function we created earlier:**

```sql
log_lead_reply(
  p_lead_id UUID,
  p_reply_text TEXT,
  p_sentiment VARCHAR  -- 'POSITIVE', 'NEGATIVE', or 'NEUTRAL'
)
```

**Updates:**
- `last_reply_date` → NOW()
- `last_interaction_date` → NOW()
- `status` → 'replied_positive', 'replied_negative', or 'replied_neutral'
- `campaign_history` → Marks result as 'replied'

---

## 🎯 **What Happens for Each Sentiment**

### **POSITIVE Reply:**
```
Lead replies: "YES, send me the info"
  ↓
Sentiment: POSITIVE
  ↓
Auto-response sent with microsite link
  ↓
Database updated: status = 'replied_positive'
  ↓
Lead gets microsite within 60 seconds
  ↓
If they book appointment → $350 billing event
```

### **NEGATIVE Reply:**
```
Lead replies: "Not interested, remove me"
  ↓
Sentiment: NEGATIVE
  ↓
Database updated: status = 'replied_negative'
  ↓
Lead marked as 'not_interested'
  ↓
Campaign stops (Instantly handles this)
```

### **NEUTRAL Reply:**
```
Lead replies: "Maybe, need to think about it"
  ↓
Sentiment: NEUTRAL
  ↓
Database updated: status = 'replied_neutral'
  ↓
No auto-action (human review recommended)
```

---

## 🔧 **Instantly Webhook Configuration**

**In Instantly Dashboard:**

1. Go to: **Settings** → **Webhooks**
2. Click: **Add Webhook**
3. **Webhook Name:** "Reply to n8n"
4. **Event:** "Email Reply Received"
5. **URL:** Your n8n webhook URL
6. **Method:** POST
7. **Apply to:** All Campaigns (or select your 3)
8. **Active:** ON ✅

**Instantly will send this payload:**
```json
{
  "event": "reply",
  "lead_email": "john@example.com",
  "from_email": "john@example.com",
  "body": "Yes, I'm interested!",
  "subject": "Re: Stop your payment",
  "campaign_id": "abc123",
  "timestamp": "2025-10-13T10:30:00Z"
}
```

---

## ✅ **Workflow is Ready to Import!**

**Files Created:**
- ✅ `workflows/04-reply-detection-microsite.json` - Main workflow
- ✅ `REPLY_DETECTION_SETUP_GUIDE.md` - This guide
- ✅ `log_lead_reply()` function - Already in database

**Next Steps:**
1. Import workflow to n8n
2. Get webhook URL
3. Configure in Instantly
4. Test with sample reply
5. Activate

---

## ⏱️ **Response Time:**

**From reply to microsite link:**
- Instantly detects reply: <5 seconds
- Webhook fires: <2 seconds
- n8n processes: <5 seconds
- Email sent: <10 seconds

**Total: ~20-30 seconds** from reply to microsite in their inbox! 🚀

---

## 🚨 **Important Notes:**

### **Email Sending:**
- ✅ Uses Instantly's reply API (no additional service needed)
- ✅ Replies from the SAME mailbox that sent original email
- ✅ Stays in same email thread for better deliverability
- ✅ Lead experiences: Sarah sends → Lead replies → Sarah responds

### **Microsite URLs:**
- Currently generates: `{city}.equityconnect.com?lead_id={id}`
- You'll need to build the actual microsite pages
- For now, this workflow handles the DETECTION and ROUTING

### **AI Sentiment:**
- Current version uses keyword matching (good enough to start)
- Upgrade to OpenAI/Claude for better accuracy when ready

---

**Ready to import and configure!** 🎉

Let me know when you've imported it and I'll help test!

