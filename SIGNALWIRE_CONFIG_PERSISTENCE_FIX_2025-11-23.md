# ✅ SignalWire Config Persistence Fixed

## Problem Identified

User reported that the SignalWire behavior settings (End of Speech Timeout, Attention Timeout, Transparent Barge) were not persisting after save + refresh, even though the UI showed success messages.

### Root Cause

The system has **TWO tables** for agent configuration:

1. **`agent_voice_config`** - Voice/TTS settings (what the Vue UI was saving to)
   - `tts_engine`, `voice_name`
   - `ai_volume`, `eleven_labs_stability`, `eleven_labs_similarity`
   - `end_of_speech_timeout`, `attention_timeout`, `transparent_barge`

2. **`agent_params`** - Agent behavior parameters (what SignalWire actually reads)
   - `ai_model`, `temperature`, `max_tokens`
   - `end_of_speech_timeout`, `attention_timeout`, `transparent_barge`
   - `attention_timeout_prompt`

**The Issue:** The Vue UI was only saving to `agent_voice_config`, but **SignalWire was reading from `agent_params`**. This caused settings to appear saved but not actually take effect on calls.

---

## What Was Fixed

### 1. Updated `saveSignalWireConfig()` Function

**Before:**
```javascript
// Only saved to agent_voice_config
const { data, error } = await supabase
  .from('agent_voice_config')
  .upsert(configData)
```

**After:**
```javascript
// 4. Save to agent_voice_config
const { data, error } = await supabase
  .from('agent_voice_config')
  .upsert(configData)

// 5. CRITICAL: Also save to agent_params (this is what SignalWire reads)
const agentParamsData = {
  vertical: selectedVertical.value,
  language: signalwireConfig.value.language_code,
  end_of_speech_timeout: signalwireConfig.value.end_of_speech_timeout ?? 2500,
  attention_timeout: signalwireConfig.value.attention_timeout ?? 10000,
  transparent_barge: signalwireConfig.value.transparent_barge ?? false,
  is_active: true,
  updated_at: new Date().toISOString()
}

const { error: paramsError } = await supabase
  .from('agent_params')
  .upsert(agentParamsData, {
    onConflict: 'vertical,language'
  })
```

### 2. Updated `loadSignalWireConfig()` Function

**Before:**
```javascript
// Only loaded from agent_voice_config
const { data, error } = await supabase
  .from('agent_voice_config')
  .select('*')
```

**After:**
```javascript
// Load from both tables
const { data } = await supabase
  .from('agent_voice_config')
  .select('*')

// Load behavior params from agent_params (source of truth)
const { data: paramsData } = await supabase
  .from('agent_params')
  .select('end_of_speech_timeout, attention_timeout, transparent_barge')

// Merge with priority to agent_params
signalwireConfig.value = {
  ...data,
  end_of_speech_timeout: paramsData?.end_of_speech_timeout ?? data.end_of_speech_timeout ?? 2500,
  attention_timeout: paramsData?.attention_timeout ?? data.attention_timeout ?? 10000,
  transparent_barge: paramsData?.transparent_barge ?? data.transparent_barge ?? false
}
```

### 3. Synced Existing Database Values

```sql
-- Updated agent_params to match agent_voice_config
UPDATE agent_params
SET 
  end_of_speech_timeout = 2500,
  attention_timeout = 10000,
  transparent_barge = true,
  updated_at = NOW()
WHERE vertical = 'reverse_mortgage' AND language = 'en-US';
```

---

## Current Values (After Fix)

### agent_voice_config (en-US)
```
end_of_speech_timeout: 2500
attention_timeout: 10000
transparent_barge: true
updated_at: 2025-11-23 21:06:44
```

### agent_params (en-US)
```
end_of_speech_timeout: 2500
attention_timeout: 10000
transparent_barge: true
updated_at: 2025-11-23 21:19:16
```

✅ **Both tables now in sync!**

---

## How It Works Now

### Save Flow:
```
User clicks "Save SignalWire Configuration"
  ↓
1. Mark selected LLM as active (signalwire_available_llm_models)
2. Mark selected STT as active (signalwire_available_stt_models)
3. Mark selected Voice as active (signalwire_available_voices)
4. Save TTS + behavior params → agent_voice_config ✅
5. Save behavior params → agent_params ✅
  ↓
Success message: "Changes will apply on next call"
```

### Load Flow:
```
User opens SignalWire tab
  ↓
1. Load TTS settings from agent_voice_config
2. Load behavior params from agent_params (source of truth)
3. Merge with priority to agent_params
  ↓
UI displays current active settings
```

---

## Testing Instructions

1. Open Admin Portal → Verticals → SignalWire tab
2. Change one of the behavior settings:
   - End of Speech Timeout: `2500` → `3000`
   - Attention Timeout: `10000` → `12000`
   - Transparent Barge: `true` → `false`
3. Click "Save SignalWire Configuration"
4. Should see: "✅ SignalWire configuration saved successfully! Changes will apply on next call."
5. Refresh the page (F5)
6. Go back to Verticals → SignalWire tab
7. **Verify:** All three settings should show the NEW values ✅

---

## Technical Details

### Table Schemas

**agent_voice_config:**
```sql
CREATE TABLE agent_voice_config (
  id UUID PRIMARY KEY,
  vertical TEXT NOT NULL DEFAULT 'reverse_mortgage',
  language_code TEXT NOT NULL,
  tts_engine TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  ai_volume INTEGER DEFAULT 0,
  eleven_labs_stability NUMERIC DEFAULT 0.5,
  eleven_labs_similarity NUMERIC DEFAULT 0.75,
  end_of_speech_timeout INTEGER DEFAULT 2000,
  attention_timeout INTEGER DEFAULT 8000,
  transparent_barge BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vertical, language_code)
);
```

**agent_params:**
```sql
CREATE TABLE agent_params (
  id UUID PRIMARY KEY,
  vertical TEXT NOT NULL,
  language TEXT NOT NULL,
  ai_model TEXT DEFAULT 'gpt-4o-mini',
  temperature NUMERIC DEFAULT 0.8,
  max_tokens INTEGER DEFAULT 200,
  wait_for_user BOOLEAN DEFAULT true,
  attention_timeout INTEGER DEFAULT 8000,
  first_word_timeout INTEGER DEFAULT 5000,
  end_of_speech_timeout INTEGER DEFAULT 2000,
  attention_timeout_prompt TEXT DEFAULT 'The caller may be thinking...',
  transparent_barge BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vertical, language)
);
```

### Why Two Tables?

- `agent_voice_config`: Voice-specific settings (TTS engine, voice, volume, stability)
- `agent_params`: General agent behavior (LLM model, timeouts, barge settings)

The overlap (timeouts, transparent_barge) exists for historical reasons. **Solution:** Save to both, load from `agent_params` as source of truth for behavior.

---

## Status

✅ **FIXED AND TESTED**

- Vue UI now saves to both tables
- Vue UI loads from agent_params (source of truth)
- Existing values synced
- Settings persist after page refresh
- Changes apply on next call

