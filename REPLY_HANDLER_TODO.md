# Reply Handler Workflow - Setup To-Do List

**Workflow:** Instantly Reply Handler (AI-Powered)  
**Status:** In Progress  
**Last Updated:** October 13, 2025

---

## ✅ **COMPLETED:**

- [x] Created workflow structure in n8n
- [x] Webhook configured (`instantly-reply-webhook`)
- [x] Webhook set up in Instantly.ai
- [x] Extract Reply Data node built
- [x] Lookup Lead from Supabase configured
- [x] Basic LLM Chain node added
- [x] OpenRouter Chat Model connected (Sonnet 4.5)
- [x] OpenRouter credentials configured
- [x] Switch node with 4 routes created
- [x] All route handler nodes created
- [x] Fixed typo in Switch conditions

---

## 🔧 **TO-DO - Critical Setup:**

### **1. Configure Switch Node Routes** ⚡ (5 minutes)
- [ ] Click Switch node in n8n
- [ ] Output 1: Set condition `{{ $json.primary_intent }}` equals `provide_phone`
- [ ] Output 2: Set condition `{{ $json.primary_intent }}` equals `ask_question`
- [ ] Output 3: Set condition `{{ $json.primary_intent }}` equals `unsubscribe`
- [ ] Output 4: Set condition `{{ $json.primary_intent }}` equals `general_interest`

### **2. Add VAPI Credentials** ⚡ (3 minutes)
- [ ] Go to n8n Credentials
- [ ] Create new HTTP Header Auth credential
- [ ] Name: "VAPI API"
- [ ] Header name: `Authorization`
- [ ] Header value: `Bearer YOUR_VAPI_API_KEY`
- [ ] Attach to "Trigger VAPI Call" node

### **3. Update VAPI Assistant ID** ⚡ (1 minute)
- [ ] In "Trigger VAPI Call" node
- [ ] Replace `YOUR_BARBARA_ASSISTANT_ID` with actual Barbara assistant ID
- [ ] Get ID from VAPI dashboard

### **4. Fix Workflow Connections** ⚡ (3 minutes)
Currently wrong - need to fix:
- [ ] Disconnect "Mark as Unsubscribed" from "Send Email Reply"
- [ ] Connect "Answer Question + Remind" → "Send Email Reply"
- [ ] Connect "Ask for Phone Number" → "Send Email Reply"
- [ ] Connect "Mark as Unsubscribed" → "Update Lead Status" (direct, no email)

---

## 🤖 **TO-DO - AI Enhancements:**

### **5. Build Question Answering AI Agent** (30 minutes)
Replace "Answer Question + Remind" code node with AI Agent:

**Components needed:**
- [ ] Create AI Agent node
- [ ] Add Supabase tool (query lead full details)
- [ ] Build reverse mortgage knowledge base (vector store)
- [ ] Load FAQ documents into vector store
- [ ] Add retrieval tool to agent
- [ ] Configure agent prompt:
  ```
  You're answering a senior's question about reverse mortgages.
  
  Their question: {{ $json.reply_text }}
  Topic detected: {{ $json.question_topic }}
  
  Use the knowledge base to answer accurately and compliantly.
  Reference their property value ({{ $json.property_value }}) naturally.
  End by asking: "What's the best phone number to reach you at?"
  
  Keep response warm, conversational, under 150 words.
  ```

### **6. Create Reverse Mortgage Knowledge Base** (1-2 hours)
- [ ] Gather documentation:
  - [ ] FHA reverse mortgage guidelines
  - [ ] Eligibility requirements
  - [ ] Fee structures and costs
  - [ ] Inheritance/heir impact rules
  - [ ] Timeline and process steps
  - [ ] Common objections + approved responses
  - [ ] Compliance rules (what NOT to say)
- [ ] Format as markdown or text files
- [ ] Upload to Pinecone or n8n vector store
- [ ] Test retrieval with sample questions

---

## 🧪 **TO-DO - Testing:**

### **7. Test Each Route** (20 minutes)
- [ ] **Test Route 1 (Phone Provided):**
  - Send test webhook with reply: "Yes, call me at 555-123-4567"
  - Verify: VAPI call triggered
  - Verify: Lead status updated
  
- [ ] **Test Route 2 (Question):**
  - Send test webhook with reply: "What are the fees?"
  - Verify: AI generates answer
  - Verify: Email sent via Instantly
  - Verify: Asks for phone number at end
  
- [ ] **Test Route 3 (Unsubscribe):**
  - Send test webhook with reply: "Stop emailing me"
  - Verify: Lead marked as do_not_contact
  - Verify: No email sent
  
- [ ] **Test Route 4 (General Interest):**
  - Send test webhook with reply: "Tell me more"
  - Verify: "What's your phone?" email sent
  - Verify: Lead status updated to awaiting_phone

### **8. Test Multi-Intent Replies** (10 minutes)
- [ ] Test: "Yes interested but what are the costs?"
  - Should route to: ask_question (answer + remind)
  
- [ ] Test: "Call me at 555-1234 but first tell me about fees"
  - Should route to: provide_phone (phone takes priority)

---

## 📝 **TO-DO - Barbara VAPI Setup:**

### **9. Configure Barbara's Script** (10 minutes)
In VAPI assistant settings:
- [ ] Opening greeting uses spintax:
  ```
  Hi {{firstName}}, this is Barbara with Equity Connect. 
  I'm a {virtual|automated} pre-qualification assistant. 
  I'm calling to verify your eligibility for the reverse 
  mortgage program. This will take about {5-10|around 5 to 10} 
  minutes. Is now a good time?
  ```
- [ ] Pass custom variables:
  - `firstName`
  - `propertyCity`
  - `propertyValue`
  - `estimatedEquity`

---

## 🚀 **TO-DO - Production Launch:**

### **10. Activate Workflow** (1 minute)
- [ ] Test all routes successfully
- [ ] Verify credentials work
- [ ] Turn on workflow in n8n
- [ ] Monitor first 5 replies closely

### **11. Monitor & Optimize** (Ongoing)
- [ ] Check execution logs daily for errors
- [ ] Review AI classifications (are they accurate?)
- [ ] Track conversion rate by route
- [ ] Refine prompts based on performance

---

## 📊 **Success Metrics to Track:**

- [ ] **Route Distribution:**
  - What % of replies are questions vs phone provides?
  
- [ ] **AI Accuracy:**
  - Are intents classified correctly?
  - Any misrouted replies?
  
- [ ] **Conversion Rate:**
  - How many "ask_question" replies convert to phone provided?
  - How many phone numbers → VAPI calls completed?

---

## ⚠️ **BLOCKERS (Need These First):**

**Before you can fully test:**
1. ⚠️ VAPI API key
2. ⚠️ Barbara assistant ID
3. ⚠️ Reverse mortgage knowledge base documents

**Can proceed with partial testing using Route 4 (Ask for Phone) since it's static.**

---

## 🎯 **Priority Order:**

**Do these FIRST (to get basic functionality working):**
1. Configure Switch node routes (5 min)
2. Fix workflow connections (3 min)
3. Test Route 4 with sample webhook (5 min)

**Do these NEXT (for full functionality):**
4. Add VAPI credentials + assistant ID (5 min)
5. Test Route 1 (phone provided) (5 min)

**Do these WHEN READY (for production quality):**
6. Build AI Agent for question answering (30 min)
7. Create knowledge base (1-2 hours)
8. Full testing and optimization (ongoing)

---

**Start with the top 3 items and you'll have a working (basic) reply handler in ~15 minutes!**

