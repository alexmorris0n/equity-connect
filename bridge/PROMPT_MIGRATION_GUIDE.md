# Prompt Migration Guide: Local Files → Supabase

## Overview

The bridge is migrating from local markdown prompt files to Supabase-based prompts with structured JSONB content.

---

## What Changed

### **Before (Old System)**
- ✅ Prompts stored as `.md` files in `prompts/Production Prompts/`
- ✅ Simple file-based loading with `fs.readFileSync()`
- ✅ 4 prompt variants: inbound-qualified, inbound-unqualified, outbound-warm, outbound-cold
- ✅ Single flat markdown file per prompt

### **After (New System)**
- ✅ Prompts stored in Supabase database
- ✅ Structured JSONB format with 9 sections
- ✅ 9 call types: 4 lead-facing + 2 broker + 2 special + 1 fallback
- ✅ Version control & deployment tracking
- ✅ Voice selection per prompt
- ✅ Real-time updates without code deployment

---

## Files Changed

### **New File:**
- `bridge/prompt-manager-supabase.js` - New Supabase-based prompt manager

### **Keep for Reference:**
- `bridge/prompt-manager.js` - Original file-based prompt manager (for fallback)

### **To Update:**
- `bridge/audio-bridge-lean.js` - Replace require statement

---

## Migration Steps

### **1. Install Supabase Client**

```bash
cd bridge
npm install @supabase/supabase-js
```

### **2. Set Environment Variables**

Add to your `.env` file:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

### **3. Update Bridge to Use Supabase Prompts**

In `bridge/audio-bridge-lean.js`, change line 23:

**Old:**
```javascript
const { getPromptForCall, injectVariables, determinePromptName } = require('./prompt-manager');
```

**New:**
```javascript
const { getPromptForCall, injectVariables, determineCallType } = require('./prompt-manager-supabase');
```

### **4. Update Call Context**

When calling `getPromptForCall`, the bridge now needs to pass `call_type` or enough context to determine it:

**Example:**
```javascript
const promptCallContext = {
  context: 'inbound',           // 'inbound' or 'outbound'
  call_type: 'inbound-qualified', // Explicit call type (optional)
  lead_id: lead?.id,             // Database lead ID
  is_qualified: lead?.is_qualified, // Qualification status
  is_transfer: false,            // Is this a transfer?
  is_callback: false,            // Is this a scheduled callback?
  is_broker: false               // Is caller a broker?
};

const { prompt, voice, promptName } = await getPromptForCall(
  promptCallContext,
  customInstructions,
  variables
);
```

### **5. Use the Voice**

The new system returns voice selection:

```javascript
const { prompt, voice, promptName } = await getPromptForCall(...);

console.log(`Using voice: ${voice}`); // e.g., 'alloy', 'echo', 'shimmer'
// Pass voice to OpenAI Realtime API
```

---

## Call Type Mapping

### **Old → New**

| Old Prompt Name | New Call Type | Notes |
|----------------|---------------|-------|
| `barbara-inbound-qualified` | `inbound-qualified` | Same |
| `barbara-inbound-unqualified` | `inbound-unqualified` | Same |
| `barbara-outbound-warm` | `outbound-warm` | Same |
| `barbara-outbound-cold` | `outbound-cold` | Same |
| *(none)* | `transfer` | **NEW** - Warm transfers |
| *(none)* | `callback` | **NEW** - Scheduled callbacks |
| *(none)* | `broker-schedule-check` | **NEW** - Broker checking schedule |
| *(none)* | `broker-connect-appointment` | **NEW** - Broker connecting for appointment |
| `barbara-fallback` | `fallback` | Emergency fallback |

---

## How It Works

### **1. Call Context → Call Type**

```javascript
determineCallType(callContext)
```

Logic:
1. If `call_type` explicitly provided → use it
2. If `is_broker` → broker call types
3. If `is_transfer` → `transfer`
4. If `is_callback` → `callback`
5. If `context === 'outbound'` → `outbound-warm` or `outbound-cold`
6. If `context === 'inbound'` → `inbound-qualified` or `inbound-unqualified`
7. Else → `fallback`

### **2. Fetch from Supabase**

```sql
SELECT p.id, p.name, p.voice, p.call_type
FROM prompts p
WHERE p.call_type = 'inbound-qualified'
  AND p.is_active = true;

SELECT pv.content, pv.version_number
FROM prompt_versions pv
WHERE pv.prompt_id = p.id
  AND pv.is_active = true;
```

### **3. Assemble Prompt**

The JSONB `content` has 9 keys:
- `role`
- `personality`
- `context`
- `pronunciation`
- `tools`
- `instructions`
- `conversation_flow`
- `output_format`
- `safety`

Assembled into one prompt with section headings.

### **4. Inject Variables**

Replace `{{variableName}}` with actual values:
- `{{leadFirstName}}` → "John"
- `{{brokerCompany}}` → "Equity Connect"
- `{{estimatedEquityWords}}` → "two hundred fifty thousand"

### **5. Cache for 5 Minutes**

In-memory cache prevents hitting Supabase on every call.

---

## Testing

### **Test Prompt Fetch**

Create `bridge/test-supabase-prompts.js`:

```javascript
require('dotenv').config();
const { getPromptForCall, prewarmCache } = require('./prompt-manager-supabase');

async function test() {
  console.log('Testing Supabase prompt fetch...\n');
  
  const callContext = {
    context: 'inbound',
    is_qualified: true
  };
  
  const variables = {
    leadFirstName: 'John',
    brokerCompany: 'Equity Connect',
    estimatedEquityWords: 'two hundred thousand'
  };
  
  const result = await getPromptForCall(callContext, null, variables);
  
  console.log('\n=== RESULT ===');
  console.log('Prompt Name:', result.promptName);
  console.log('Voice:', result.voice);
  console.log('Prompt Length:', result.prompt.length);
  console.log('\n=== FIRST 500 CHARS ===');
  console.log(result.prompt.substring(0, 500));
  
  console.log('\n\nPre-warming cache...');
  await prewarmCache();
}

test().catch(console.error);
```

Run:
```bash
node bridge/test-supabase-prompts.js
```

---

## Rollback Plan

If issues occur:

1. **Revert bridge code:**
   ```javascript
   const { getPromptForCall, injectVariables, determinePromptName } = require('./prompt-manager');
   ```

2. **Keep local `.md` files** in `prompts/Production Prompts/`

3. **Both systems can run in parallel** during transition

---

## Benefits of New System

1. ✅ **No code deployments** to update prompts
2. ✅ **Version control** with rollback capability
3. ✅ **9 specialized prompts** vs 4 generic ones
4. ✅ **Voice selection** per prompt type
5. ✅ **Structured sections** for better prompt organization
6. ✅ **Real-time UI** for editing via portal
7. ✅ **Audit trail** of all prompt changes
8. ✅ **A/B testing** capability (deploy different versions)

---

## Next Steps

1. ✅ Install `@supabase/supabase-js`
2. ✅ Add environment variables
3. ✅ Update `audio-bridge-lean.js` require statement
4. ✅ Test with sample call
5. ✅ Pre-warm cache on bridge startup
6. ✅ Monitor logs for Supabase errors
7. ✅ Keep old system as fallback for 1-2 weeks

