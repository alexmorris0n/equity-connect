# Portal Compatibility Verification - SignalWire Contexts Migration

**Date:** 2025-11-13  
**Status:** ✅ COMPATIBLE with bug fix applied

---

## Executive Summary

**Question:** Is `portal/src/views/admin/Verticals.vue` compatible with SignalWire Contexts migration?

**Answer:** ✅ YES - After critical bug fix

---

## Compatibility Analysis

### ✅ 1. Loading Instructions with {variable} Syntax

**Lines 1104-1105:**
```javascript
nodeContent.value[p.node_name].role = matchingVersion.content.role || ''
nodeContent.value[p.node_name].instructions = matchingVersion.content.instructions || ''
nodeContent.value[p.node_name].tools = [...toolsArray]
```

**Verdict:** ✅ COMPATIBLE
- Loads `content.instructions` as plain text
- Does NOT parse or strip `{lead.first_name}` syntax
- Treats curly braces as literal text (correct behavior)

**Example:**
```
Database: "Warmly greet {lead.first_name} from {property.city}..."
↓
Loaded into textarea as-is
↓
User sees: "Warmly greet {lead.first_name} from {property.city}..."
```

---

### ✅ 2. Display in Textarea Without Breaking

**Lines 263-268:**
```vue
<textarea
  :value="nodeContent[node]?.instructions || ''"
  @input="(e) => updateInstructions(node, e.target.value)"
  placeholder="What should Barbara do?"
  rows="6"
></textarea>
```

**Verdict:** ✅ COMPATIBLE
- Textarea displays raw text (no parsing)
- `{lead.first_name}` appears as literal characters
- User can edit without breaking syntax

**Lines 1533-1538 (updateInstructions):**
```javascript
function updateInstructions(node, value) {
  if (!nodeContent.value[node]) {
    nodeContent.value[node] = { role: '', instructions: '', tools: [] }
  }
  nodeContent.value[node].instructions = value
  markNodeChanged(node)
}
```

**Verdict:** ✅ COMPATIBLE
- Simple string assignment
- No parsing or transformation
- Curly braces preserved

---

### ❌ 3. Saving Updates - CRITICAL BUG (FIXED)

**BEFORE (Lines 1304-1308) - BROKEN:**
```javascript
const contentObj = {
  role: nodeContent.value[nodeName].role || '',
  instructions: nodeContent.value[nodeName].instructions || '',
  tools: toolsArray
}
// ❌ This WIPES OUT valid_contexts and step_criteria!
```

**AFTER (Lines 1304-1315) - FIXED:**
```javascript
// CRITICAL: Preserve existing content fields (valid_contexts, step_criteria, etc.)
// Load current active version to get existing fields
const currentPrompt = nodePrompts.value[selectedVertical.value]?.[nodeName]
const existingContent = currentPrompt?.content || {}

// Merge: preserve migration fields, update edited fields
const contentObj = {
  ...existingContent,  // PRESERVE: valid_contexts, step_criteria, valid_steps, etc.
  role: nodeContent.value[nodeName].role || '',
  instructions: nodeContent.value[nodeName].instructions || '',
  tools: toolsArray
}
// ✅ This preserves migration fields!
```

**Impact of Fix:**
- ✅ Admin can edit `instructions` field
- ✅ `valid_contexts` preserved from migration
- ✅ `step_criteria` preserved from migration
- ✅ Any future fields also preserved

---

### ✅ 4. Component Does NOT Touch Routing Fields

**Verified:** Component only edits 3 fields:
- `content.role`
- `content.instructions`
- `content.tools`

**Does NOT edit:**
- ❌ `content.valid_contexts` - Never touched (migration manages)
- ❌ `content.step_criteria` - Never touched (migration manages)
- ❌ `content.valid_steps` - Never touched (migration manages)

**This is correct behavior** - routing logic managed by migration SQL, UI only edits prompt content.

---

### ✅ 5. Curly Braces Not Stripped

**Test scenario:**

**Admin types:**
```
Ask {lead.first_name} about their property in {property.city}
```

**updateInstructions() receives:**
```javascript
value = "Ask {lead.first_name} about their property in {property.city}"
```

**Saves to database:**
```json
{
  "instructions": "Ask {lead.first_name} about their property in {property.city}"
}
```

**Agent loads:**
```python
"Ask {lead.first_name} about their property in {property.city}"
# SignalWire substitutes variables:
# "Ask Testy about their property in Inglewood"
```

**Verdict:** ✅ Curly braces preserved through entire flow

---

## Verification Checklist

### Load Behavior:
- [x] Loads `content.instructions` as plain text
- [x] Does NOT parse `{variable}` syntax
- [x] Does NOT strip curly braces
- [x] Displays in textarea correctly

### Edit Behavior:
- [x] Admin can type `{lead.first_name}` freely
- [x] Curly braces treated as normal characters
- [x] No special parsing on input
- [x] Changes tracked properly

### Save Behavior:
- [x] Saves `instructions` field as-is
- [x] Preserves `valid_contexts` from migration ✅ FIXED
- [x] Preserves `step_criteria` from migration ✅ FIXED
- [x] Uses spread operator to merge ✅ FIXED
- [x] Does NOT create new object from scratch ✅ FIXED

### Does NOT Touch:
- [x] `valid_contexts` - Never edited
- [x] `step_criteria` - Never edited
- [x] `valid_steps` - Never edited
- [x] Routing logic fields - Never edited

---

## Before vs After Fix

### BEFORE (Broken):
```javascript
// User edits GREET instructions
instructions: "Warmly greet {lead.first_name} from {property.city}..."

// Save creates NEW object (wipes out other fields)
contentObj = {
  role: "...",
  instructions: "Warmly greet {lead.first_name}...",
  tools: [...]
  // ❌ valid_contexts LOST
  // ❌ step_criteria LOST
}

// Database now broken:
{
  "role": "...",
  "instructions": "Warmly greet {lead.first_name}...",
  "tools": [...]
  // ❌ No routing logic - contexts broken!
}
```

### AFTER (Fixed):
```javascript
// User edits GREET instructions
instructions: "Warmly greet {lead.first_name} from {property.city}..."

// Load existing content first
existingContent = {
  role: "...",
  instructions: "old text",
  tools: [...],
  valid_contexts: ["verify", "exit"],  // From migration
  step_criteria: "User has responded..."  // From migration
}

// Merge: preserve existing + update edited
contentObj = {
  ...existingContent,  // ← Spreads all existing fields
  role: "...",  // Updates this
  instructions: "Warmly greet {lead.first_name}...",  // Updates this
  tools: [...]  // Updates this
}

// Database preserved:
{
  "role": "...",
  "instructions": "Warmly greet {lead.first_name}...",
  "tools": [...],
  "valid_contexts": ["verify", "exit"],  // ✅ PRESERVED
  "step_criteria": "User has responded..."  // ✅ PRESERVED
}
```

---

## Testing Recommendations

### Test 1: Edit Instructions with Variables
1. Open portal → Verticals → Reverse Mortgage
2. Expand GREET node
3. Edit instructions: Add or modify `{lead.first_name}`
4. Save
5. Reload page
6. Verify `{lead.first_name}` still there ✅
7. Check database:
```sql
SELECT content FROM prompt_versions 
WHERE prompt_id = (SELECT id FROM prompts WHERE node_name = 'greet')
AND is_active = true;
```
8. Verify `valid_contexts` still present ✅

### Test 2: Verify Migration Fields Preserved
**Before editing:**
```sql
SELECT content->>'valid_contexts', content->>'step_criteria'
FROM prompt_versions pv
JOIN prompts p ON pv.prompt_id = p.id
WHERE p.node_name = 'greet' AND pv.is_active = true;
```
Result: `["verify", "exit"]` and `"User has responded..."`

**Edit and save node via portal**

**After editing:**
```sql
-- Same query as above
```
Result should be: `["verify", "exit"]` and `"User has responded..."` ✅ PRESERVED

---

## Files Involved

**Fixed:** `portal/src/views/admin/Verticals.vue`
- Lines 1304-1315: Changed from object creation to merge pattern
- Uses spread operator to preserve existing fields
- Only updates role, instructions, tools

---

## Summary

### Compatibility Status:

✅ **Load:** Compatible - loads instructions with {variables} correctly  
✅ **Display:** Compatible - textarea shows raw text, no parsing  
✅ **Edit:** Compatible - user can type {variables} freely  
✅ **Save:** Compatible (AFTER FIX) - preserves migration fields  
✅ **Scope:** Compatible - doesn't touch routing fields

### Critical Fix Applied:

**Changed:** Object creation → Object merging  
**Preserves:** `valid_contexts`, `step_criteria`, all migration fields  
**Updates:** Only `role`, `instructions`, `tools` (UI-editable fields)

---

**🎉 Portal is now fully compatible with SignalWire Contexts migration!**

Admin can safely edit prompts without breaking the contexts system.

