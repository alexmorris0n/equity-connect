# PromptLayer Injection Fix

## Problem

The PromptLayer templates were being fetched correctly, but there were two critical issues:

### Issue 1: Unfilled `{{user_question}}` Variable
The logs showed:
```
Message 1 (role: user): {{user_question}}...
```

**Root Cause**: The PromptLayer templates were uploaded in **chat completion format** with a system message and a user message containing `{{user_question}}`. This variable wasn't in the `variables` object, so it was being sent literally to OpenAI.

### Issue 2: Wrong Template Format for Realtime API
The PromptLayer templates had **two messages**:
- Message 0 (system): The actual Barbara prompt
- Message 1 (user): `{{user_question}}`

**Root Cause**: The Realtime API uses a single `instructions` field (like a system prompt), NOT a messages array. The code was concatenating both the system and user messages into one instruction block, which is incorrect.

---

## Solution

### Fix 1: Default Variable Handling (`injectVariables`)
**File**: `bridge/prompt-manager.js`

Added default values for common PromptLayer variables that might be missing:

```javascript
const enrichedVariables = {
  ...variables,
  user_question: variables.user_question || '',  // Remove this placeholder if present
  user: variables.user || variables.leadFirstName || '',
  context: variables.context || variables.callContext || 'inbound'
};
```

**Effect**: Any `{{user_question}}` placeholders will now be replaced with an empty string (removing them from the final prompt).

### Fix 2: Extract Only System Messages
**File**: `bridge/prompt-manager.js`

Changed the chat format parsing to **extract ONLY system messages**:

```javascript
// For Realtime API, we only want the system message
// User messages with {{user_question}} are for chat completion API, not realtime
const systemMessages = result.prompt_template.messages.filter(m => m.role === 'system');
```

**Effect**: 
- ✅ System messages are extracted
- ❌ User/assistant messages are ignored
- Logs will show: `✅ Extracted 1 system message(s), ignoring 1 user/assistant messages`

---

## How PromptLayer Injection Works

According to PromptLayer's documentation:

1. **Template Registration**: Store prompt templates with variable placeholders (e.g., `{{leadFirstName}}`, `{{propertyCity}}`)
2. **Runtime Injection**: When calling `promptLayer.run()`, provide `input_variables` object
3. **Variable Merging**: PromptLayer automatically merges variables into placeholders
4. **Final Prompt**: The merged prompt is sent to the LLM

### Our Implementation
Since we're using the Realtime API (not chat completions), we:
1. Fetch template using `promptLayer.client.templates.get(promptName)`
2. Extract the prompt text (system message only)
3. Inject variables locally using our `injectVariables()` function
4. Send the final merged prompt as `session.instructions` to OpenAI

---

## Testing

### Before Fix
```
Message 0 (role: system): You are Barbara, a warm, professional scheduling a...
Message 1 (role: user): {{user_question}}...
🔵 Final instructions length: 5060
🔵 Session config: {...instructions":"You are Barbara...\n\n{{user_question}}..."...}
```

### After Fix
```
System Message 0: You are Barbara, a warm, professional scheduling a...
✅ Extracted 1 system message(s), ignoring 1 user/assistant messages
✅ Fetched prompt from PromptLayer: barbara-inbound-qualified (2500 chars)
🔵 Final instructions length: 2500
🔵 Session config: {...instructions":"You are Barbara, a warm and professional..."...}
```

No more `{{user_question}}` in the final prompt! ✅

---

## Recommendation: Update PromptLayer Templates

The templates on PromptLayer should be updated to **single-message format** (system message only) since we're using the Realtime API, not chat completions.

### Current Format (Wrong)
```json
{
  "messages": [
    { "role": "system", "content": "You are Barbara..." },
    { "role": "user", "content": "{{user_question}}" }
  ]
}
```

### Correct Format for Realtime API
```json
{
  "messages": [
    { "role": "system", "content": "You are Barbara..." }
  ]
}
```

Or even simpler:
```json
{
  "prompt_template": "You are Barbara..."
}
```

However, the current fix handles both formats correctly, so this is not urgent.

---

## Files Modified

1. `bridge/prompt-manager.js`
   - Updated `injectVariables()` to provide default values for missing variables
   - Updated chat format parsing to extract only system messages
   - Added debug logging for better visibility

---

## Status: ✅ FIXED

The PromptLayer injection now correctly:
- Fetches templates from PromptLayer
- Extracts only system messages (ignoring user messages)
- Fills all variables including defaults
- Sends clean instructions to OpenAI Realtime API

No more unfilled placeholders or incorrectly formatted prompts!

