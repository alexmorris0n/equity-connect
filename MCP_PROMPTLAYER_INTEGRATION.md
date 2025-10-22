# MCP PromptLayer Integration - Complete

## Overview

The Barbara MCP server now integrates with PromptLayer to dynamically select the correct outbound prompt template based on lead qualification status.

## What Changed

### 1. `barbara-mcp/index.js`

**Added:**
- Import of `getPromptForCall` and `injectVariables` from `bridge/prompt-manager.js`
- Qualification determination logic based on `qualified` field and property data
- PromptLayer template fetching for outbound calls
- Variable injection into PromptLayer templates

**Logic Flow:**
```javascript
// 1. Determine qualification
const hasPropertyData = !!(variables.property_value || variables.estimated_equity);
const isQualified = variables.qualified === true || hasPropertyData;

// 2. Build call context
const callContext = {
  context: 'outbound',
  lead_id: lead_id,
  has_property_data: hasPropertyData,
  is_qualified: isQualified
};

// 3. Fetch correct template from PromptLayer
const promptTemplate = await getPromptForCall(callContext, null);
// Returns either 'barbara-outbound-warm' or 'barbara-outbound-cold'

// 4. Inject variables
const customizedPrompt = injectVariables(promptTemplate, promptVariables);

// 5. Send to bridge
fetch(`${BRIDGE_URL}/api/outbound-call`, {
  body: JSON.stringify({
    to_phone,
    lead_id,
    broker_id,
    instructions: customizedPrompt
  })
});
```

**Added Tool Parameter:**
- `qualified` (boolean): Whether lead is qualified (optional, auto-detected if not provided)

### 2. `barbara-mcp/README.md`

**Added:**
- PromptLayer integration feature description
- Prompt selection logic documentation
- Qualification criteria explanation

## Prompt Selection Logic

### Outbound Calls (from n8n via MCP)

| Condition | Prompt Template | Use Case |
|-----------|----------------|----------|
| `qualified === true` OR has property/equity data | `barbara-outbound-warm` | Lead responded to email, has shown interest |
| `qualified === false` OR no data | `barbara-outbound-cold` | Cold outreach, first contact |

### Inbound Calls (direct to bridge)

| Condition | Prompt Template | Use Case |
|-----------|----------------|----------|
| `qualified === true` OR has property/equity data | `barbara-inbound-qualified` | Known lead calling back, has data |
| `qualified === false` OR not in DB | `barbara-inbound-unqualified` | Unknown caller, discovery mode |

## n8n Workflow Integration

When n8n calls `create_outbound_call`, it should pass:

**Required:**
- `to_phone`: Phone number
- `lead_id`: Lead UUID

**Optional (for qualification):**
- `qualified`: Boolean flag from DB
- `property_value`: Property value (numeric)
- `estimated_equity`: Estimated equity (numeric)

**Example:**
```json
{
  "to_phone": "+16505300051",
  "lead_id": "abc-123-def-456",
  "qualified": true,
  "lead_first_name": "John",
  "lead_last_name": "Smith",
  "property_city": "Austin",
  "property_value": "1500000",
  "estimated_equity": "1000000",
  "broker_full_name": "Sarah Johnson",
  "broker_company": "Equity Connect"
}
```

The MCP server will:
1. Determine qualification: `true` (qualified field is true)
2. Fetch: `barbara-outbound-warm` from PromptLayer
3. Inject variables: `{{leadFirstName}}` → "John", etc.
4. Send to bridge with customized prompt

## Testing

### 1. Test Qualified Lead (Warm)

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+16505300051",
        "lead_id": "test-lead-123",
        "qualified": true,
        "lead_first_name": "John",
        "property_city": "Austin",
        "property_value": "1500000",
        "estimated_equity": "1000000",
        "broker_full_name": "Sarah Johnson",
        "broker_company": "Equity Connect"
      }
    }
  }'
```

**Expected Log:**
```
🎯 Lead qualification determined: { isQualified: true, hasPropertyData: true }
🔍 Fetching prompt from PromptLayer
📋 Using barbara-outbound-warm
```

### 2. Test Unqualified Lead (Cold)

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+16505300051",
        "lead_id": "test-lead-456",
        "qualified": false,
        "lead_first_name": "Jane",
        "property_city": "Dallas",
        "broker_full_name": "Mike Davis",
        "broker_company": "Reverse Mortgage Co"
      }
    }
  }'
```

**Expected Log:**
```
🎯 Lead qualification determined: { isQualified: false, hasPropertyData: false }
🔍 Fetching prompt from PromptLayer
📋 Using barbara-outbound-cold
```

## Benefits

1. **Centralized Prompt Management**: All prompts in PromptLayer, no duplication
2. **Automatic Selection**: MCP server picks the right template based on data
3. **Dynamic Updates**: Change prompts in PromptLayer without redeploying code
4. **Consistent Logic**: Same `determinePromptName` logic used for both inbound and outbound
5. **Full Variable Support**: All 27+ variables work with PromptLayer templates

## Files Changed

- ✅ `barbara-mcp/index.js` - Added PromptLayer integration
- ✅ `barbara-mcp/README.md` - Documented new feature
- ✅ `bridge/prompt-manager.js` - Already had the logic (no changes needed)
- ✅ `bridge/audio-bridge.js` - Already uses prompt-manager (no changes needed)
- ✅ `bridge/tools.js` - Already returns `qualified` flag (no changes needed)

## Deployment

1. **Commit changes:**
```bash
git add barbara-mcp/index.js barbara-mcp/README.md MCP_PROMPTLAYER_INTEGRATION.md
git commit -m "feat: integrate PromptLayer with MCP for outbound prompt selection"
git push origin master
```

2. **Redeploy MCP server** on Northflank (if deployed)

3. **Test with n8n workflow** - ensure `qualified` field is passed from lead lookup

## Next Steps

- [ ] Update n8n workflow to pass `qualified` field from lead lookup
- [ ] Test warm vs cold prompt selection in production
- [ ] Monitor logs to verify correct template selection
- [ ] Update PromptLayer templates as needed

---

**Status:** ✅ Complete and ready to deploy

