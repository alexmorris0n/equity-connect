# PromptLayer Debugging Guide

## Issue Summary

Barbara's greeting behavior suggests she's using the LOCAL FALLBACK prompt instead of the PromptLayer template, even though logs show the PromptLayer template was fetched successfully.

**Evidence:**
- ✅ Logs show: `✅ Fetched prompt from PromptLayer: barbara-inbound-qualified (5263 chars)`
- ❌ Barbara said: "Hi Testy! Thanks for calling back about your property in Inglewood..."
- This greeting style is from the fallback prompt, NOT the PromptLayer template

---

## What We Fixed

### Fix 1: Variable Handling (`prompt-manager.js`)
Added default values for missing PromptLayer variables:
```javascript
const enrichedVariables = {
  ...variables,
  user_question: variables.user_question || '',  // Remove this placeholder
  user: variables.user || variables.leadFirstName || '',
  context: variables.context || variables.callContext || 'inbound'
};
```

### Fix 2: Message Parsing (`prompt-manager.js`)
Now extracts ONLY system messages from PromptLayer templates (ignoring user messages):
```javascript
const systemMessages = result.prompt_template.messages.filter(m => m.role === 'system');
```

### Fix 3: Enhanced Logging (`audio-bridge.js`)
Added detailed logging to track which prompt source is actually being used:
```javascript
console.log(`📋 Using ${isFromPromptLayer ? 'PromptLayer' : 'Local Fallback'} prompt (${instructions.length} chars)`);
console.log(`📋 Prompt preview: ${instructions.substring(0, 150)}...`);
```

---

## Next Steps: Make a Test Call

When you make your next test call, look for these NEW log lines:

### If PromptLayer is Working:
```
🔍 Fetching prompt from PromptLayer with context: {...}
✅ Got prompt template, injecting variables...
📋 Using PromptLayer prompt (2500 chars)
📋 Prompt preview: You are Barbara, a warm and professional scheduling assistant for...
🔵 Final instructions length: 2500
```

### If Fallback is Being Used:
```
🔍 Fetching prompt from PromptLayer with context: {...}
❌ configureSession: Error in prompt building: [error message]
❌ Stack trace: [stack trace]
⚠️ Falling back to local prompt file
📋 Using Local Fallback prompt (33616 chars)
📋 Prompt preview: # ROLE & OBJECTIVE...
🔵 Final instructions length: 33616
```

---

## Possible Root Causes

If the fallback IS being used, it's because an error is happening in the try block. Possible causes:

### 1. PromptLayer Template Has {{user_question}} Placeholder
- **Symptom**: Template fetched but has unfilled `{{user_question}}`
- **Fix**: Already handled by enrichedVariables default
- **Check**: Look for `Message 1 (role: user): {{user_question}}` in logs

### 2. Variable Injection Fails
- **Symptom**: `injectVariables()` throws an error
- **Likely cause**: Missing required variable that PromptLayer template expects
- **Check**: Look for error message about missing variables

### 3. getPromptForCall() Fails
- **Symptom**: Can't fetch from PromptLayer
- **Likely cause**: API key missing, template name mismatch, network issue
- **Check**: Look for PromptLayer connection errors

### 4. PromptLayer Template NOT Uploaded
- **Symptom**: Falls back to local file immediately
- **Check**: Are all 4 templates uploaded? (`barbara-inbound-qualified`, `barbara-inbound-unqualified`, `barbara-outbound-warm`, `barbara-outbound-cold`)

---

## Verification Checklist

Before making a test call, verify:

- [ ] PromptLayer API key is set in production environment (`PROMPTLAYER_API_KEY`)
- [ ] All 4 templates are uploaded to PromptLayer with exact names
- [ ] Templates have `production` label assigned
- [ ] Templates are in correct format (system message only, no user messages)
- [ ] All variables in templates match what's in `variables` object (lines 430-467 in audio-bridge.js)

---

## Expected Behavior After Fix

### PromptLayer Template (Correct):
```
Hi! Thanks for reaching out. I'd love to help you explore your options with your home in Inglewood.
```

### Fallback Template (Wrong):
```
Hi Testy! Thanks for calling back about your property in Inglewood. What can I help you with today?
```

The PromptLayer template gives more natural, conversational greetings WITHOUT the "calling back" language (since this might be their first call).

---

## Files Modified

1. **bridge/prompt-manager.js**
   - Added default variable handling
   - Fixed message parsing to extract only system messages
   
2. **bridge/audio-bridge.js**
   - Enhanced error logging in `configureSession()`
   - Added prompt source detection
   - Added preview logging

---

## Testing Command

```bash
# Make a test call and watch the logs
kubectl logs -f deployment/barbara --tail=100 | grep -E "(Fetching prompt|Using|Prompt preview|Final instructions)"
```

---

## What to Do If It's Still Using Fallback

1. **Check the new error logs** - they'll show exactly why the PromptLayer template failed
2. **Verify PromptLayer connection** - run `node bridge/test-prompt-manager.js` in production environment
3. **Check template format** - make sure templates don't have user messages with `{{user_question}}`
4. **Verify variable names** - all `{{variableName}}` placeholders must have matching entries in the `variables` object

The enhanced logging will make it obvious what's failing!

