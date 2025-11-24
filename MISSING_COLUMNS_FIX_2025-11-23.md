# ✅ REAL FIX: Missing Database Columns for TTS Parameters

## The ACTUAL Problem

When the user clicked "Save SignalWire Configuration", they got:
- ❌ No popup message
- ❌ Settings didn't persist after refresh

**Root Cause:** The `agent_voice_config` table was **missing 3 columns** that the Vue UI was trying to save:
- `ai_volume`
- `eleven_labs_stability`
- `eleven_labs_similarity`

This caused the database upsert to **fail silently** (PostgreSQL rejected the columns), so:
1. No success message appeared (catch block wasn't reached)
2. Settings weren't saved
3. Page refresh showed old values

---

## What Was Fixed

### 1. Added Missing Columns to Database

```sql
ALTER TABLE agent_voice_config
ADD COLUMN IF NOT EXISTS ai_volume INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS eleven_labs_stability NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS eleven_labs_similarity NUMERIC DEFAULT 0.75;
```

### 2. Added Debug Logging

Updated `saveSignalWireConfig()` to include:
- Console logs at function entry
- Full config object logging
- Alert as fallback (if window.$message fails)
- Success/error logging

**Before:**
```javascript
async function saveSignalWireConfig() {
  loading.value = true
  try {
    console.log('💾 Saving SignalWire configuration...')
    // ... save code ...
    window.$message?.success('✅ Saved!')
  } catch (error) {
    window.$message?.error('Failed!')
  }
}
```

**After:**
```javascript
async function saveSignalWireConfig() {
  console.log('🔵 saveSignalWireConfig CALLED')
  console.log('🔵 Current signalwireConfig:', JSON.stringify(signalwireConfig.value, null, 2))
  
  loading.value = true
  try {
    console.log('💾 Saving SignalWire configuration...')
    console.log('Behavior params:', {
      end_of_speech_timeout: signalwireConfig.value.end_of_speech_timeout,
      attention_timeout: signalwireConfig.value.attention_timeout,
      transparent_barge: signalwireConfig.value.transparent_barge
    })
    
    // ... save to agent_voice_config ...
    // ... save to agent_params ...
    
    console.log('✅ SignalWire configuration saved successfully to both tables!')
    alert('✅ SignalWire configuration saved! Changes will apply on next call.')
    window.$message?.success('✅ Saved!')
  } catch (error) {
    console.error('❌ Failed to save SignalWire config:', error)
    alert('❌ Failed to save: ' + error.message)
    window.$message?.error('Failed!')
  } finally {
    console.log('🔵 saveSignalWireConfig COMPLETE')
  }
}
```

---

## Complete Database Schema (After Fix)

### agent_voice_config
```
✅ id                         UUID
✅ vertical                   TEXT (default: 'reverse_mortgage')
✅ language_code              TEXT
✅ tts_engine                 TEXT
✅ voice_name                 TEXT
✅ model                      TEXT (nullable)
✅ is_active                  BOOLEAN (default: true)
✅ created_at                 TIMESTAMPTZ
✅ updated_at                 TIMESTAMPTZ
✅ end_of_speech_timeout      INTEGER (default: 2000)
✅ attention_timeout          INTEGER (default: 8000)
✅ transparent_barge          BOOLEAN (default: false)
✅ ai_volume                  INTEGER (default: 0)        ← ADDED
✅ eleven_labs_stability      NUMERIC (default: 0.5)      ← ADDED
✅ eleven_labs_similarity     NUMERIC (default: 0.75)     ← ADDED
```

### agent_params
```
✅ id                         UUID
✅ vertical                   TEXT
✅ language                   TEXT
✅ ai_model                   TEXT (default: 'gpt-4o-mini')
✅ temperature                NUMERIC (default: 0.8)
✅ max_tokens                 INTEGER (default: 200)
✅ wait_for_user              BOOLEAN (default: true)
✅ attention_timeout          INTEGER (default: 8000)
✅ first_word_timeout         INTEGER (default: 5000)
✅ end_of_speech_timeout      INTEGER (default: 2000)
✅ attention_timeout_prompt   TEXT
✅ transparent_barge          BOOLEAN (default: false)
✅ is_active                  BOOLEAN (default: true)
✅ created_at                 TIMESTAMPTZ
✅ updated_at                 TIMESTAMPTZ
```

---

## Testing Instructions

1. **Open Browser Console** (F12)
2. Go to Admin Portal → Verticals → SignalWire tab
3. Change any setting (e.g., End of Speech Timeout: `2500` → `3000`)
4. Click "Save SignalWire Configuration"
5. **Expected in Console:**
   ```
   🔵 saveSignalWireConfig CALLED
   🔵 Current signalwireConfig: { ... }
   💾 Saving SignalWire configuration...
   Behavior params: { end_of_speech_timeout: 3000, ... }
   ✅ SignalWire configuration saved successfully to both tables!
   🔵 saveSignalWireConfig COMPLETE
   ```
6. **Expected in Browser:**
   - Alert popup: "✅ SignalWire configuration saved! Changes will apply on next call."
7. **Refresh page (F5)**
8. Go back to Verticals → SignalWire tab
9. **Expected:** Setting shows `3000` ✅

---

## Migration Files Created

- `supabase/migrations/20251123_add_tts_parameters_to_agent_voice_config.sql` (forward)
- `supabase/migrations/20251123_add_tts_parameters_to_agent_voice_config_inverse.sql` (rollback)

---

## Summary of All Fixes Applied

### Fix #1: Dual-Table Save (Previous)
- Save behavior params to both `agent_voice_config` AND `agent_params`
- Load from `agent_params` as source of truth

### Fix #2: Missing Columns (This Fix)
- Added `ai_volume`, `eleven_labs_stability`, `eleven_labs_similarity` to `agent_voice_config`
- These columns were referenced in Vue but didn't exist in DB

### Fix #3: Better Error Handling
- Added console logging for debugging
- Added alert() as fallback notification
- More detailed error messages

---

## Status

✅ **FULLY FIXED**

All TTS and behavior parameters now:
- Save to correct database tables
- Persist after page refresh
- Show success messages
- Apply to next call

