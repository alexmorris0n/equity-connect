# 🔍 SignalWire Documentation Deep Dive Analysis

**Date:** January 18, 2025  
**Analysis:** Complete review of all SignalWire AI documentation vs. our implementation

---

## ❌ **CRITICAL ERRORS - What We Did WRONG**

### 1. **VENDOR PARAMETERS DON'T EXIST IN `ai.params`**

**❌ WRONG:** We're using:
```python
"params": {
    "llm_vendor": "openai",
    "llm_model": "gpt-4o-mini",
    "stt_vendor": "deepgram",
    "stt_model": "nova-3",
    "tts_vendor": "elevenlabs",
    "tts_voice": "tiffany"
}
```

**✅ CORRECT:** According to `ai.params` docs, we should use:
```python
"params": {
    "ai_model": "gpt-4o-mini",  # LLM model
    "openai_asr_engine": "deepgram:nova-3",  # STT engine
    # TTS is configured in ai.languages, NOT in params!
}
```

**The docs show NO vendor parameters (`llm_vendor`, `stt_vendor`, `tts_vendor`) in `ai.params`!**

---

### 2. **TTS VOICE IN WRONG PLACE**

**❌ WRONG:** We're setting TTS in `params`:
```python
"params": {
    "tts_vendor": "elevenlabs",
    "tts_voice": "tiffany"
}
```

**✅ CORRECT:** TTS voice should be in `ai.languages`:
```python
"languages": [{
    "name": "English",
    "code": "en-US",
    "voice": "elevenlabs.tiffany"  # Format: engine.voice_id
}]
```

**The `ai.params` docs have NO TTS configuration. TTS is ONLY in `ai.languages`!**

---

### 3. **SWAIG INCLUDES: WRONG KEY NAME**

**❌ WRONG:** We're using:
```python
"includes": [{
    "functions": ["route_conversation", ...],  # Plural
    "url": "..."
}]
```

**✅ CORRECT:** According to `ai.SWAIG` docs, it should be:
```python
"includes": [{
    "function": ["route_conversation", ...],  # Singular "function"
    "url": "..."
}]
```

**The docs explicitly show `function` (singular), not `functions` (plural)!**

---

### 4. **FUNCTION DECLARATION: WRONG FIELD NAME**

**❌ WRONG:** We're using `purpose`:
```python
{
    "function": "route_conversation",
    "purpose": "Check if node transition needed",  # WRONG
    "parameters": {...}
}
```

**✅ CORRECT:** According to `ai.SWAIG.functions` docs:
```python
{
    "function": "route_conversation",
    "description": "Check if node transition needed",  # Use "description"
    "parameters": {...}
}
```

**The docs say `purpose` is DEPRECATED. Use `description` instead!**

---

### 5. **FUNCTION DISCOVERY: WRONG RESPONSE FORMAT**

**❌ WRONG:** We're returning:
```python
{"functions": function_declarations}  # Wrapped in "functions" key
```

**✅ CORRECT:** According to `ai.SWAIG.includes` docs, signature request should return:
```python
# Direct array, NOT wrapped in object
[
    {
        "function": "route_conversation",
        "description": "...",
        "parameters": {...},
        "web_hook_url": "..."
    }
]
```

**The docs show signature responses are arrays, not objects with a `functions` key!**

---

## ⚠️ **MISSING FEATURES - What We're NOT Using**

### 1. **Missing: `ai.params.conscience`**
- **What it does:** Reinforces AI guardrails after SWAIG function calls
- **Why we need it:** Prevents AI from going off-script after tool calls
- **Example:**
```python
"params": {
    "conscience": "Remember to stay in character. You must not do anything outside the scope of your provided role."
}
```

### 2. **Missing: `ai.params.post_prompt_url`**
- **What it does:** Receives conversation summary after call ends
- **Why we need it:** We have a placeholder endpoint but not configured in SWML
- **Should add:**
```python
"post_prompt_url": f"https://{PUBLIC_URL}/webhooks/post-conversation"
```

### 3. **Missing: `ai.params.save_conversation`**
- **What it does:** Sends conversation summary (requires `post_prompt_url`)
- **Status:** We have `save_conversation: True` but no `post_prompt_url` configured!

### 4. **Missing: `ai.languages.voice` Format**
- **Current:** Not setting voice at all in languages
- **Should be:** `"voice": "elevenlabs.tiffany"` (engine.voice_id format)

### 5. **Missing: Function Fillers**
- **What it does:** Plays phrases while function executes (reduces dead air)
- **Example:**
```python
"functions": [{
    "function": "calculate_reverse_mortgage",
    "fillers": {
        "en-US": ["Let me calculate that for you...", "One moment..."]
    }
}]
```

### 6. **Missing: `ai.params.debug_webhook_url`**
- **What it does:** Real-time debugging of every AI interaction
- **Why useful:** See exactly what AI is thinking/doing during calls
- **Example:**
```python
"params": {
    "debug_webhook_url": f"https://{PUBLIC_URL}/webhooks/debug",
    "debug_webhook_level": 2  # 0=off, 1=basic, 2=verbose
}
```

### 7. **Missing: `ai.params.swaig_post_conversation`**
- **What it does:** Posts entire conversation to SWAIG functions
- **Why useful:** Could use for analytics/processing

### 8. **Missing: Native Functions**
- **What they are:** Built-in SignalWire functions (`check_time`, `wait_seconds`, etc.)
- **How to enable:**
```python
"SWAIG": {
    "native_functions": ["check_time", "wait_seconds", "wait_for_user"]
}
```

### 9. **Missing: `ai.params.local_tz`**
- **What it does:** Sets timezone for time-related functions
- **Should add:**
```python
"params": {
    "local_tz": "America/Los_Angeles"  # IANA timezone
}
```

### 10. **Missing: `ai.params.interrupt_prompt`**
- **What it does:** Handles when user interrupts AI
- **Why useful:** Better handling of crosstalk

---

## ✅ **What We Did RIGHT**

1. ✅ **SWML Structure:** Correct `version`, `sections.main` format
2. ✅ **Function Discovery Endpoint:** `/functions` POST endpoint exists
3. ✅ **Function Handler Endpoint:** `/functions/{function_name}` pattern correct
4. ✅ **Argument Parsing:** Using `argument.parsed[0]` correctly
5. ✅ **Response Format:** Returning `{"response": "...", "action": [...]}` correctly
6. ✅ **Basic Params:** `end_of_speech_timeout`, `attention_timeout`, `enable_barge`, `transparent_barge`, `wait_for_user`, `save_conversation`, `conversation_id` all correct
7. ✅ **Prompt Structure:** Using `text` and `temperature` correctly
8. ✅ **Language Configuration:** `name` and `code` correct
9. ✅ **SWAIG Includes Pattern:** Using remote function includes (just wrong key name)

---

## 🚀 **What We Can ADD (Enhancements)**

### 1. **Add Function Fillers**
```python
"functions": [{
    "function": "calculate_reverse_mortgage",
    "description": "...",
    "fillers": {
        "en-US": [
            "Let me calculate that for you...",
            "One moment while I run the numbers...",
            "Calculating your available funds..."
        ]
    }
}]
```

### 2. **Add Debug Webhook**
```python
"params": {
    "debug_webhook_url": f"https://{PUBLIC_URL}/webhooks/debug",
    "debug_webhook_level": 2
}
```

### 3. **Add Conscience Prompt**
```python
"params": {
    "conscience": "Remember to stay in character as Barbara, a reverse mortgage specialist. Always use the calculate_reverse_mortgage function for any financial calculations - never estimate or guess numbers."
}
```

### 4. **Add Post-Prompt URL**
```python
"post_prompt_url": f"https://{PUBLIC_URL}/webhooks/post-conversation"
```

### 5. **Add Native Functions**
```python
"SWAIG": {
    "native_functions": ["check_time", "wait_seconds", "wait_for_user"]
}
```

### 6. **Add Timezone**
```python
"params": {
    "local_tz": "America/Los_Angeles"
}
```

### 7. **Add Interrupt Handling**
```python
"params": {
    "interrupt_prompt": "The user interrupted you. Acknowledge this briefly and continue with your response."
}
```

### 8. **Add Speech Fillers (Language Level)**
```python
"languages": [{
    "name": "English",
    "code": "en-US",
    "voice": "elevenlabs.tiffany",
    "speech_fillers": [
        "Let me think...",
        "Hmm...",
        "One moment..."
    ],
    "function_fillers": [
        "Let me check that for you...",
        "One moment while I look that up..."
    ]
}]
```

### 9. **Add Hints (Pronunciation)**
```python
"hints": [
    "reverse mortgage",
    "HECM",
    {
        "hint": "equity connect",
        "pattern": "(?i)equity\\s*connect",
        "replace": "Equity Connect"
    }
]
```

### 10. **Add Pronounce (Pronunciation Rules)**
```python
"pronounce": [
    {
        "replace": "HECM",
        "with": "heck-em"
    }
]
```

---

## 📝 **TYPOS FOUND IN DOCUMENTATION**

1. **ai.params line 7:** `params`Optional should be `params` Optional (space issue in table)
2. **ai.SWAIG line 1544:** `function`Required should be `function` Required (space issue)
3. **ai.SWAIG line 1563:** Example shows `function: ["get_weather"]` but earlier says `functions` - inconsistent
4. **ai.params line 42:** `openai_asr_engine` description says "Common values include `deepgram:nova-2`" but should clarify this is the FORMAT, not that it's OpenAI

---

## 🔧 **FIXES APPLIED**

### ✅ Priority 1 (CRITICAL - FIXED):
1. ✅ **FIXED:** Removed `llm_vendor`, `stt_vendor`, `tts_vendor` from `params`
   - Now using: `ai_model: "gpt-4o-mini"` and `openai_asr_engine: "deepgram:nova-3"`
2. ✅ **FIXED:** Changed `functions` to `function` in `includes`
3. ✅ **FIXED:** Changed `purpose` to `description` in all function declarations
4. ✅ **FIXED:** Moved TTS voice to `languages` array as `voice: "elevenlabs.tiffany"`
5. ✅ **FIXED:** Function discovery now returns array directly (not wrapped in object)
6. ✅ **FIXED:** Function declarations use `parameters` (not `argument`)

### ✅ Priority 2 (IMPORTANT - ADDED):
1. ✅ **ADDED:** `post_prompt_url` at top level of `ai` (not in params)
2. ✅ **ADDED:** `voice` in `languages` array
3. ✅ **ADDED:** `conscience` prompt for guardrails
4. ✅ **ADDED:** `local_tz` for timezone
5. ✅ **ADDED:** `speech_fillers` and `function_fillers` in languages
6. ✅ **ADDED:** `native_functions` in SWAIG config

### ⏳ Priority 3 (ENHANCEMENTS - TODO):
1. ⏳ Add debug webhook (`debug_webhook_url`)
2. ⏳ Add function-specific fillers per function
3. ⏳ Add hints for pronunciation
4. ⏳ Add pronounce rules
5. ⏳ Implement post-conversation data saving to database

---

## 📊 **SUMMARY**

**What We Got Right:** 9/10 core concepts ✅  
**Critical Errors:** 5 major issues ❌  
**Missing Features:** 10+ useful features ⚠️  
**Enhancements Available:** 10+ improvements ➕

**Overall Grade: C+ (70%)**

We have the right architecture but wrong parameter names and missing key configurations. The vendor parameters issue is CRITICAL - they don't exist in the official docs!

---

**Next Steps:**
1. Fix all Priority 1 issues immediately
2. Add Priority 2 features
3. Test with actual SignalWire call
4. Add Priority 3 enhancements incrementally

