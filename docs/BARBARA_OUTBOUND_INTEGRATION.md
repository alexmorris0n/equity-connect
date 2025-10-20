# Barbara Outbound Integration Guide

## Overview

This guide explains how to integrate Barbara (our SignalWire + OpenAI Realtime system) into the n8n workflow for outbound calling, replacing the VAPI integration.

## What Changed

### 1. **New Outbound Prompt**
Created `prompts/BarbaraOutboundPrompt` - optimized for outbound calling:
- Barbara speaks first (waits for "Hello?" then introduces herself)
- Uses all 27 variables for personalization
- Handles screening detection automatically
- Natural, conversational flow

### 2. **Barbara MCP Server v2.0**
Updated `barbara-mcp/index.js`:
- Accepts all 27 customization variables
- Builds customized prompt by replacing handlebars templates
- Converts numbers to words (for natural speech)
- Passes customized prompt to bridge

### 3. **Bridge Server**
Updated `bridge/server.js`:
- Accepts `instructions` field in `/api/outbound-call` endpoint
- Stores custom prompt in `pendingCalls` map
- AudioBridge automatically uses custom prompt

## Integration Steps

### Step 1: Update n8n Workflow

In your workflow `02 AI Instantly Reply Handler` (ID: `MOtbYjaDYIF4IJwY`):

#### Find Section 3C (VAPI Call Creation)

**BEFORE (VAPI):**
```javascript
// 3C. Create VAPI Call with SignalWire Number Pool
// ... long VAPI-specific code ...
```

**AFTER (Barbara MCP):**
```javascript
// 3C. Create Barbara Call via MCP

// 3C1. Build variable payload for Barbara
const variablePayload = {
  // Lead information
  lead_first_name: lead_record.first_name || 'there',
  lead_last_name: lead_record.last_name || '',
  lead_full_name: `${lead_record.first_name || ''} ${lead_record.last_name || ''}`.trim(),
  lead_email: lead_record.primary_email || '',
  lead_phone: extracted_phone,
  
  // Property information
  property_address: lead_record.property_address || 'your property',
  property_city: lead_record.property_city || '',
  property_state: lead_record.property_state || '',
  property_zipcode: lead_record.property_zip || '',
  property_value: lead_record.property_value || '0',
  property_value_formatted: (lead_record.property_value || 0) >= 1000000 
    ? ((lead_record.property_value / 1000000).toFixed(1) + 'M') 
    : (Math.round((lead_record.property_value || 0) / 1000) + 'K'),
  
  // Equity calculations
  estimated_equity: lead_record.estimated_equity || '0',
  estimated_equity_formatted: (lead_record.estimated_equity || 0) >= 1000000 
    ? ((lead_record.estimated_equity / 1000000).toFixed(1) + 'M') 
    : (Math.round((lead_record.estimated_equity || 0) / 1000) + 'K'),
  equity_50_percent: Math.floor((lead_record.estimated_equity || 0) * 0.5),
  equity_50_formatted: ((lead_record.estimated_equity || 0) * 0.5) >= 1000000 
    ? (((lead_record.estimated_equity * 0.5) / 1000000).toFixed(1) + 'M') 
    : (Math.round((lead_record.estimated_equity || 0) * 0.5 / 1000) + 'K'),
  equity_60_percent: Math.floor((lead_record.estimated_equity || 0) * 0.6),
  equity_60_formatted: ((lead_record.estimated_equity || 0) * 0.6) >= 1000000 
    ? (((lead_record.estimated_equity * 0.6) / 1000000).toFixed(1) + 'M') 
    : (Math.round((lead_record.estimated_equity || 0) * 0.6 / 1000) + 'K'),
  
  // Campaign and persona
  campaign_archetype: lead_record.campaign_archetype || 'direct',
  persona_assignment: lead_record.assigned_persona || 'general',
  persona_sender_name: persona_sender_name || 'Equity Connect Team',
  
  // Broker information
  broker_company: lead_record.broker_company || 'our partner company',
  broker_full_name: lead_record.broker_contact_name || 'your specialist',
  broker_nmls: lead_record.broker_nmls || 'licensed',
  broker_phone: lead_record.broker_phone || '',
  broker_display: `${lead_record.broker_contact_name || 'your specialist'}, NMLS ${lead_record.broker_nmls || 'licensed'}`,
  
  // Call context
  call_context: 'outbound'
};

// 3C2. Call Barbara MCP to create outbound call
// The Barbara MCP node is already connected to the AI Agent
// It will:
// - Build customized prompt from variables
// - Convert numbers to words for natural speech
// - Pass prompt + context to bridge
// - Create SignalWire call with OpenAI Realtime

Call Barbara MCP create_outbound_call with:
{
  to_phone: extracted_phone,
  lead_id: lead_record.id,
  broker_id: lead_record.broker_id,
  ...variablePayload
}

// 3C3. Barbara will handle the rest:
// - Look up lead context from database
// - Assign SignalWire phone number from broker's pool
// - Create outbound call with customized prompt
// - AudioBridge connects to OpenAI Realtime
// - Barbara speaks first using the personalized script
```

### Step 2: Remove Old VAPI Code

**Delete these sections:**
- 3C1. Check if Lead Already Has Assigned Phone Number
- 3C2. Release Old Phone if Lead Changed Brokers
- 3C3. Get Phone Number (Reuse Existing OR Assign New)
- 3C4. Update Lead Record (Only if New Assignment)
- 3C5. Create Call with ALL 28 VARIABLES (VAPI-specific)

**Why?** Barbara MCP and the bridge handle all of this automatically:
- Phone number assignment is managed by the bridge
- Lead lookup is done by the bridge
- Call creation is handled by SignalWire
- No need for manual phone pool management in n8n

### Step 3: Update Logging

**BEFORE:**
```javascript
// 3D. Log inbound interaction with phone assignment details
INSERT INTO interactions ... 
  'assigned_phone_number_id', '${selected_phone_number.vapi_phone_number_id}',
  'assigned_phone_number', '${selected_phone_number.number}',
```

**AFTER:**
```javascript
// 3C3. Log inbound interaction
INSERT INTO interactions (lead_id, type, direction, content, metadata, created_at) 
VALUES (
  '${lead_record.id}',
  'email_replied',
  'inbound',
  'Reply: phone provided - Barbara call scheduled',
  jsonb_build_object(
    'intent', 'phone_provided',
    'customer_phone', '${extracted_phone}',
    'campaign_id', '{{ $json.campaign_id }}',
    'email_id', '{{ $json.reply_to_uuid }}',
    'call_system', 'barbara'
  )::jsonb,
  NOW()
)
RETURNING id
```

**Note:** Phone assignment details are automatically logged by the bridge.

### Step 4: Verify Barbara MCP Node

In the n8n workflow, ensure the **Barbara MCP node** is:
- Connected to the AI Agent
- Using endpoint: `https://p01--barbara-mcp--p95wlpxnp2z2.code.run/mcp`
- Authenticated with proper credentials

The node is already configured in your workflow (ID: `3d8da337-b5f0-4674-9def-603df5ea4e81`).

## Variable Mapping Reference

### From Workflow to Barbara MCP

| Workflow Variable | MCP Parameter | Description |
|-------------------|---------------|-------------|
| `lead_record.first_name` | `lead_first_name` | Lead's first name |
| `lead_record.last_name` | `lead_last_name` | Lead's last name |
| `lead_record.primary_email` | `lead_email` | Lead's email |
| `extracted_phone` | `lead_phone` | Lead's phone |
| `lead_record.property_address` | `property_address` | Street address |
| `lead_record.property_city` | `property_city` | City |
| `lead_record.property_state` | `property_state` | State |
| `lead_record.property_zip` | `property_zipcode` | ZIP code |
| `lead_record.property_value` | `property_value` | Property value (numeric) |
| `lead_record.estimated_equity` | `estimated_equity` | Estimated equity (numeric) |
| `lead_record.campaign_archetype` | `campaign_archetype` | Campaign type |
| `lead_record.assigned_persona` | `persona_assignment` | Persona assignment |
| `persona_sender_name` | `persona_sender_name` | Full persona name |
| `lead_record.broker_company` | `broker_company` | Broker company |
| `lead_record.broker_contact_name` | `broker_full_name` | Broker full name |
| `lead_record.broker_nmls` | `broker_nmls` | NMLS number |
| `lead_record.broker_phone` | `broker_phone` | Broker phone |

### Calculated Fields

Barbara MCP automatically calculates:
- **First names** from full names
- **Equity percentages** (50% and 60%)
- **Number-to-words conversion** for speech
- **Formatted values** (1.2M, 500K, etc.)

## Example Barbara Call Flow

1. **n8n receives email reply** with phone number
2. **AI Agent** extracts phone and lead context
3. **Barbara MCP** receives `create_outbound_call` with 27 variables
4. **Barbara MCP** builds customized prompt:
   ```
   Hi, is this Testy?
   
   Great! Carlos let me know you reached out about learning more 
   about reverse mortgages. I'm here to help connect you with 
   Walter Richards. How's your day going?
   
   Oh, Inglewood is a wonderful area! How long have you been there?
   ```
5. **Bridge** creates SignalWire call with custom prompt
6. **AudioBridge** connects to OpenAI Realtime API
7. **Barbara speaks first** using the personalized script
8. **Natural conversation** with real-time audio streaming

## Testing

### Test in n8n

1. Pin test data with phone number in reply
2. Run workflow
3. Check execution logs:
   - Barbara MCP should show "Call created successfully"
   - Bridge should show "Outbound call placed"
   - AudioBridge should show "Session configured with custom prompt"
4. Verify call is placed to test number

### Test Variables

Use this test payload:
```json
{
  "lead_email": "alex@amorrison.email",
  "reply_text": "hey carlos can you have barbara call me back at 6505300051",
  "campaign_id": "test-campaign-id",
  "reply_to_uuid": "test-email-id",
  "sender_account": "c.rodriguez@equityconnecthq.com",
  "persona_sender_name": "Carlos Rodriguez"
}
```

Expected result:
- Lead looked up from database
- All 27 variables populated
- Custom prompt generated with "Carlos" and lead's city
- Call placed to 650-530-0051

## Troubleshooting

### Issue: "Call creation failed: Lead not found"
**Solution:** Ensure lead exists in database with matching email

### Issue: "No available phone numbers"
**Solution:** Check `signalwire_phone_numbers` table for active numbers assigned to broker's company

### Issue: "Barbara doesn't use variables"
**Solution:** Check bridge logs for "Session configured with custom prompt" - if missing, instructions weren't passed

### Issue: "Barbara uses generic greeting"
**Solution:** Verify Barbara MCP is passing `instructions` field to bridge API

## Benefits Over VAPI

1. **No rate limits** - SignalWire + OpenAI Realtime has higher capacity
2. **Lower cost** - $0.06/min vs VAPI's pricing
3. **More control** - Full prompt customization per call
4. **Better debugging** - Full access to logs and audio streams
5. **Simplified workflow** - No manual phone pool management
6. **Natural voice** - OpenAI Realtime "sage" voice is warmer than VAPI

## Next Steps

1. Update the n8n workflow prompt (Step 1 above)
2. Test with a single lead
3. Monitor bridge logs for custom prompt usage
4. Roll out to production
5. Monitor call quality and completion rates

## Files Modified

- `prompts/BarbaraOutboundPrompt` - New outbound-optimized prompt
- `barbara-mcp/index.js` - v2.0 with full variable support
- `bridge/server.js` - Accepts and stores `instructions` field
- `bridge/audio-bridge.js` - Already uses custom instructions (no changes needed)

## Support

For issues or questions, check:
- Bridge logs: `https://bridge.northflank.app/healthz`
- Barbara MCP logs: `https://barbara-mcp.northflank.app/health`
- n8n execution logs: Workflow executions panel

