# SignalWire + VAPI Quick Start Checklist

**Goal:** Set up SignalWire phone numbers for Barbara's outbound calls  
**Time Required:** 30-45 minutes  
**Difficulty:** Moderate (requires API calls and dashboard configuration)

---

## 📋 Quick Reference

**What you need:**
- SignalWire account with 1 phone number ✓ (you have)
- VAPI account with Barbara assistant ✓ (you have)
- VAPI Private API Key (get from dashboard)
- Terminal/command line access
- Text editor for copying/pasting

**What you'll create:**
- ONE SIP trunk credential (reusable for all numbers)
- Phone number registrations in VAPI (1 now, 4 more later)

---

## ✅ Setup Checklist

### □ Step 1: SignalWire SWML Script (5 minutes)

**Location:** SignalWire Dashboard → Resources → Add → Script → SWML Script

1. □ Create script named `vapi-barbara-outbound`
2. □ Copy YAML from `config/signalwire-vapi-outbound-script.yaml`
3. □ Replace `+1YourSignalWireNumber` with your actual number
4. □ Save script
5. □ Assign script to your phone number

**File reference:** `config/signalwire-vapi-outbound-script.yaml`

---

### □ Step 2: SignalWire SIP Configuration (10 minutes)

**Location:** SignalWire Dashboard → Your Script → Addresses & Phone Numbers

1. □ Click "Add" → Select "SIP Address"
2. □ Copy your SIP domain (e.g., `equity-connect-vapi.dapp.signalwire.com`)
3. □ Paste into `config/signalwire-phone-numbers.json` → `sip_domain`
4. □ Contact SignalWire support for SIP password:
   - **Option A:** Click "Help?" in dashboard
   - **Option B:** Email support@signalwire.com
   - **Subject:** "Request SIP Password for VAPI Integration"
5. □ Save password when received

**Expected wait time:** 1-2 hours for support response (usually faster)

---

### □ Step 3: Create VAPI SIP Trunk (5 minutes)

**Location:** Terminal / Command Line

1. □ Get your VAPI API key from https://dashboard.vapi.ai → Settings → API Keys
2. □ Open `config/signalwire-vapi-setup-commands.sh`
3. □ Find "STEP 3: CREATE VAPI SIP TRUNK CREDENTIAL"
4. □ Replace ALL placeholders:
   - `YOUR_VAPI_PRIVATE_KEY`
   - `YOUR_SIGNALWIRE_SIP_DOMAIN` (from Step 2)
   - `YOUR_SIGNALWIRE_PHONE_NUMBER` (e.g., +15035551234)
   - `YOUR_SIGNALWIRE_PASSWORD` (from Step 2)
5. □ Run the cURL command
6. □ Copy the `id` from response (e.g., `abc123-def456-ghi789`)
7. □ Paste into:
   - `config/signalwire-phone-numbers.json` → `sip_trunk_credential_id`
   - `config/environment-template.txt` → `VAPI_SIGNALWIRE_CREDENTIAL_ID`

**Success looks like:**
```json
{
  "id": "abc123-def456-ghi789",
  "provider": "byo-sip-trunk",
  "name": "SignalWire Barbara Outbound Trunk",
  ...
}
```

---

### □ Step 4: Register Phone Number (5 minutes)

**Location:** Terminal / Command Line

1. □ Open `config/signalwire-vapi-setup-commands.sh`
2. □ Find "STEP 4: REGISTER PHONE NUMBER #1"
3. □ Replace ALL placeholders:
   - `YOUR_VAPI_PRIVATE_KEY` (same as Step 3)
   - `YOUR_SIGNALWIRE_PHONE_NUMBER` (e.g., +15035551234)
   - `YOUR_CREDENTIAL_ID` (from Step 3)
4. □ Run the cURL command
5. □ Copy the `id` from response (e.g., `phone_xyz789`)
6. □ Paste into:
   - `config/signalwire-phone-numbers.json` → `numbers[0].vapi_phone_number_id`
   - `config/environment-template.txt` → `VAPI_SIGNALWIRE_PHONE_ID`

**Success looks like:**
```json
{
  "id": "phone_xyz789",
  "number": "+15035551234",
  "provider": "byo-phone-number",
  ...
}
```

---

### □ Step 5: Update n8n Workflow (10 minutes)

**Location:** n8n Dashboard → Instantly Reply Handler workflow

1. □ Open n8n at your instance URL
2. □ Find workflow: **Instantly Reply Handler - ALL MCP**
3. □ Open the **🤖 AI Agent** node (click to edit)
4. □ In the "Prompt" field, search for: `**3C1. Get Available Broker Phone Number:**`
5. □ Replace that entire section with (see detailed instructions in `config/instantly-reply-handler-signalwire-update.txt`):

```
**3C1. Use SignalWire Phone Number:**
phoneNumberId: "phone_xyz789"

**3C2. Create Call with ALL 28 VARIABLES (SIGNALWIRE VERSION):**
Call create_call with phoneNumberId: "phone_xyz789"
```

6. □ Replace `phone_xyz789` with your actual phone ID from Step 4 (in TWO places)
7. □ Save the workflow
8. □ Activate the workflow if it's not already active

**Detailed instructions:** See `config/instantly-reply-handler-signalwire-update.txt`

---

### □ Step 6: Test the Integration (10 minutes)

**Test procedure:**

1. □ Send a test email reply with a phone number (e.g., "My number is 555-123-4567")
2. □ Watch n8n execution log
3. □ Check VAPI dashboard → Calls (should see new outbound call)
4. □ Check SignalWire dashboard → Call Logs (should see SIP routing)
5. □ Answer the call
6. □ Verify:
   - □ Audio quality is excellent
   - □ Barbara says your test lead's name
   - □ Barbara mentions correct broker name
   - □ Conversation flows naturally

**If call doesn't connect:**
- Check SignalWire call logs for error messages
- Verify SWML script is assigned to phone number (Step 1)
- Confirm SIP password is correct (Step 2)
- Check VAPI credential matches in registration (Step 4)

---

### □ Step 7: Purchase Additional Numbers (Future)

**When ready to scale (after successful test):**

1. □ Purchase numbers 2-5 in SignalWire Dashboard
2. □ Assign same `vapi-barbara-outbound` SWML script to each
3. □ For each number, run registration cURL from Step 4:
   - Use **same** `credentialId` from Step 3 ✓
   - Change `number` to new phone number
   - Change `name` to "SignalWire Barbara #2", "#3", etc.
4. □ Add each to `config/signalwire-phone-numbers.json`
5. □ (Optional) Implement territory-based routing in n8n

**Key point:** You reuse the SIP trunk from Step 3 for ALL numbers!

---

## 📁 Files Created

All configuration files are in the `config/` directory:

| File | Purpose |
|------|---------|
| `signalwire-vapi-outbound-script.yaml` | SWML script template |
| `signalwire-vapi-setup-commands.sh` | cURL commands for API setup |
| `signalwire-phone-numbers.json` | Track all numbers and IDs |
| `instantly-reply-handler-signalwire-update.txt` | n8n workflow update instructions |
| `environment-template.txt` | Updated with VAPI + SignalWire vars |
| `SIGNALWIRE_SETUP_COMPLETE.md` | Detailed documentation |

---

## 🆘 Need Help?

**Detailed documentation:** See `config/SIGNALWIRE_SETUP_COMPLETE.md`

**Common issues:**
- **"Invalid gateway IP"** → Use SIP domain, not IP address
- **"Authentication failed"** → Verify SIP password with SignalWire support
- **"Number already registered"** → Check existing VAPI numbers with GET request
- **Calls not connecting** → Check SWML script assignment + SIP password

**Support resources:**
- SignalWire VAPI Docs: https://developer.signalwire.com/ai/guides/integrations/vapi/
- VAPI API Reference: https://docs.vapi.ai/api-reference
- SignalWire Support: support@signalwire.com or dashboard "Help?" button

---

## 💰 Cost Savings

**SignalWire vs VAPI Default:**

| Metric | SignalWire | VAPI Default | Savings |
|--------|------------|--------------|---------|
| Per-minute cost | $0.0085/min | $0.0140/min | 40% |
| 1,000 min/month | ~$8.50 | ~$14.00 | $5.50/month |
| 5 numbers × 1,000 min | ~$42.50 | ~$70.00 | $27.50/month |

**Annual savings (5 numbers):** ~$330/year

---

## ✅ Verification Checklist

You're done when:

- □ SignalWire number makes outbound calls
- □ Call audio quality is excellent
- □ Barbara personalizes with lead name, city, broker
- □ Barbara presents equity estimates correctly
- □ Call logs appear in VAPI dashboard
- □ Call logs appear in SignalWire dashboard
- □ Costs tracking at ~$0.0085/min

---

## 🎯 Next Steps After Setup

1. **Test with 10-20 real leads** to validate call quality and conversion
2. **Monitor call logs** in both VAPI and SignalWire for first week
3. **Track costs** to verify savings are realized
4. **Purchase 4 additional numbers** once comfortable with setup
5. **Implement territory routing** for local caller ID presence

---

**Ready to start?** Begin with Step 1 and work through sequentially. Each step builds on the previous one.

**Questions?** All details are in `config/SIGNALWIRE_SETUP_COMPLETE.md`

