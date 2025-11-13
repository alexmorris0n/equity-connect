# Voice Provider Configurable Implementation

**Date:** 2025-11-13  
**Status:** ✅ COMPLETE - TTS provider now configurable

---

## Problem

Previous implementation was **hardcoded to ElevenLabs only**:

```python
# HARDCODED ❌
voice_name = os.getenv("ELEVENLABS_VOICE_NAME", "rachel")
elevenlabs_voice = f"elevenlabs.{voice_name}"
self.add_language(..., voice=elevenlabs_voice, engine="elevenlabs")
```

Could only use ElevenLabs - no way to switch providers.

---

## Solution

Made TTS provider **fully configurable** with database-driven voice selection:

1. **Database table** - Stores voice config per vertical/language
2. **Helper methods** - Load config and build provider-specific voice strings
3. **Vue UI** - Admin interface to manage voice configurations

---

## Part 1: Database Schema

**File:** `database/migrations/2025-11-13_agent_voice_config.sql`

### Table Structure:

```sql
CREATE TABLE agent_voice_config (
    id UUID PRIMARY KEY,
    vertical TEXT NOT NULL DEFAULT 'reverse_mortgage',
    language_code TEXT NOT NULL,  -- en-US, es-US, es-MX
    tts_engine TEXT NOT NULL,  -- elevenlabs, openai, google, amazon, azure, cartesia, rime
    voice_name TEXT NOT NULL,  -- Provider-specific voice ID
    model TEXT,  -- Optional: for Rime, Amazon
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(vertical, language_code)
);
```

### Default Configurations:

```sql
INSERT INTO agent_voice_config (vertical, language_code, tts_engine, voice_name) VALUES
('reverse_mortgage', 'en-US', 'elevenlabs', 'rachel'),
('reverse_mortgage', 'es-US', 'elevenlabs', 'domi'),
('reverse_mortgage', 'es-MX', 'elevenlabs', 'domi');
```

---

## Part 2: barbara_agent.py Helper Methods

**File:** `equity_connect/agent/barbara_agent.py`

### Method 1: _get_voice_config()

Loads voice configuration from database with env fallback.

```python
def _get_voice_config(self, vertical: str = "reverse_mortgage", language_code: str = "en-US") -> Dict[str, Any]:
    """Load voice configuration from database
    
    Returns:
        Dict with: engine, voice_name, model (nullable)
    """
    try:
        sb = get_supabase_client()
        result = sb.table('agent_voice_config') \
            .select('tts_engine, voice_name, model') \
            .eq('vertical', vertical) \
            .eq('language_code', language_code) \
            .eq('is_active', True) \
            .single() \
            .execute()
        
        if result.data:
            return {
                "engine": result.data['tts_engine'],
                "voice_name": result.data['voice_name'],
                "model": result.data.get('model')
            }
    except Exception as e:
        logger.warning(f"Failed to load voice config from DB: {e}, using env fallback")
    
    # Fallback to environment variables
    engine = os.getenv("TTS_ENGINE", "elevenlabs")
    voice_name = os.getenv("ELEVENLABS_VOICE_NAME", "rachel") if engine == "elevenlabs" else os.getenv("TTS_VOICE_NAME", "rachel")
    model = os.getenv("TTS_MODEL")
    
    return {
        "engine": engine,
        "voice_name": voice_name,
        "model": model
    }
```

### Method 2: _build_voice_string()

Builds provider-specific voice strings per SignalWire Voice API format.

```python
def _build_voice_string(self, engine: str, voice_name: str) -> str:
    """Build provider-specific voice string
    
    Based on SignalWire Voice API documentation formats.
    """
    formats = {
        "elevenlabs": f"elevenlabs.{voice_name}",  # elevenlabs.rachel
        "openai": f"openai.{voice_name}",  # openai.alloy
        "google": f"gcloud.{voice_name}",  # gcloud.en-US-Neural2-A
        "gcloud": f"gcloud.{voice_name}",  # Alias
        "amazon": f"amazon.{voice_name}",  # amazon.Ruth:neural
        "polly": f"amazon.{voice_name}",  # Alias
        "azure": voice_name,  # No prefix - en-US-JennyNeural
        "microsoft": voice_name,  # Alias
        "cartesia": f"cartesia.{voice_name}",  # cartesia.{uuid}
        "rime": f"rime.{voice_name}"  # rime.luna
    }
    
    return formats.get(engine.lower(), f"{engine}.{voice_name}")
```

### Usage in configure_per_call():

```python
# Load voice config from database
voice_config = self._get_voice_config(vertical="reverse_mortgage", language_code="en-US")
voice_string = self._build_voice_string(voice_config["engine"], voice_config["voice_name"])

# Configure language dynamically
language_params = {
    "name": "English",
    "code": "en-US",
    "voice": voice_string,
    "engine": voice_config["engine"]
}

# Add model if specified (Rime Arcana, Amazon Neural, etc.)
if voice_config.get("model"):
    language_params["model"] = voice_config["model"]

agent.add_language(**language_params)
logger.info(f"✅ Voice configured: {voice_string} ({voice_config['engine']})")
```

### Usage in on_swml_request():

Same pattern - loads from DB, builds voice string, configures language dynamically.

---

## Part 3: Vue Admin Component

**File:** `portal/src/components/VoiceConfig.vue`

### Features:

1. **Language Tabs** - Switch between en-US, es-US, es-MX
2. **Provider Dropdown** - 7 providers (ElevenLabs, OpenAI, Google, Amazon, Azure, Cartesia, Rime)
3. **Voice Input** - Text field with format hints per provider
4. **Model Field** - Shows only for Rime/Amazon (optional model override)
5. **Popular Voices** - Quick-select chips for common voices
6. **Save/Reset** - Persists to database

### UI Layout:

```
┌─────────────────────────────────────────┐
│  🎙️ Voice Configuration                 │
│  Configure TTS provider per language    │
├─────────────────────────────────────────┤
│  [🇺🇸 English (US)] [🇺🇸 Spanish (US)] [🇲🇽 Spanish (Mexico)]
├─────────────────────────────────────────┤
│  TTS Provider                           │
│  [▼ ElevenLabs (Multilingual v2)    ]  │
│  High-quality multilingual voices...    │
│                                         │
│  Voice Name                             │
│  [rachel, domi, clyde, josh...      ]  │
│  Just the voice name. System adds prefix│
│                                         │
│  Popular ElevenLabs Voices:            │
│  [Rachel] [Clyde] [Domi] [Fin] [Josh]  │
│                                         │
│  [Reset to Default]  [Save Configuration]│
│                                         │
│  ✅ Saved ElevenLabs configuration...   │
└─────────────────────────────────────────┘
```

### Provider-Specific Voice Formats:

| Provider      | Format                          | Example                                   |
|---------------|---------------------------------|-------------------------------------------|
| **ElevenLabs**| Voice name only                 | `rachel` → `elevenlabs.rachel`            |
| **OpenAI**    | Voice name only                 | `alloy` → `openai.alloy`                  |
| **Google**    | Full voice code                 | `en-US-Neural2-A` → `gcloud.en-US-Neural2-A` |
| **Amazon**    | Voice:model:language            | `Ruth:neural` → `amazon.Ruth:neural`      |
| **Azure**     | Full voice code (no prefix)     | `en-US-JennyNeural` (as-is)               |
| **Cartesia**  | UUID only                       | `{uuid}` → `cartesia.{uuid}`              |
| **Rime**      | Voice name + optional model     | `luna` + model:`arcana` → `rime.luna`     |

### Popular Voices (English):

**ElevenLabs:**
- Rachel (Professional Female) ⭐
- Clyde (Professional Male)
- Domi (Warm Female)
- Fin (Conversational Male)
- Josh (Friendly Male)
- Nicole (Calm Female)

**OpenAI:**
- Alloy (Neutral)
- Nova (Female)
- Echo (Male)
- Shimmer (Soft Female)

**Google Cloud:**
- en-US-Neural2-A (Female)
- en-US-Neural2-C (Male)
- en-US-Wavenet-A (Female)

**Amazon Polly:**
- Joanna:neural (Female)
- Matthew:neural (Male)
- Ruth:neural (Female)

**Azure:**
- en-US-JennyNeural (Professional Female)
- en-US-GuyNeural (Professional Male)
- en-US-AriaNeural (Warm Female)

**Rime:**
- luna (Arcana model) - model: `arcana`
- atlas (Mist v2) - model: `null`

### Popular Voices (Spanish):

**ElevenLabs:**
- Domi (Multilingual) ⭐
- Antoni (Spanish Male)
- Serena (Spanish Female)

**OpenAI:**
- Nova (Multilingual)
- Alloy (Multilingual)

**Google Cloud:**
- es-US-Neural2-A (Female)
- es-MX-Neural2-A (Female)

**Amazon Polly:**
- Lupe:neural:es-US (Female)
- Mia:neural:es-MX (Female)
- Andres:neural:es-MX (Male)

**Azure:**
- es-US-PalomaNeural (Female)
- es-MX-DaliaNeural (Female)
- es-MX-JorgeNeural (Male)

---

## How It Works

### 1. Admin configures voice in Vue UI:

```
User selects:
- Provider: OpenAI
- Voice: alloy
- Language: en-US

Saves to database:
{
  vertical: "reverse_mortgage",
  language_code: "en-US",
  tts_engine: "openai",
  voice_name: "alloy",
  model: null
}
```

### 2. Agent loads config on call:

```python
# In configure_per_call() or on_swml_request()
voice_config = self._get_voice_config("reverse_mortgage", "en-US")
# Returns: {"engine": "openai", "voice_name": "alloy", "model": null}

voice_string = self._build_voice_string("openai", "alloy")
# Returns: "openai.alloy"

agent.add_language("English", "en-US", voice="openai.alloy", engine="openai")
```

### 3. SignalWire uses configured voice:

```
Call connects → Barbara speaks with OpenAI Alloy voice
```

---

## Usage in Portal

### Add to Admin Settings View:

```vue
<template>
  <div class="admin-settings">
    <h2>Agent Settings</h2>
    
    <!-- Voice Configuration Component -->
    <VoiceConfig />
    
    <!-- Other settings... -->
  </div>
</template>

<script>
import VoiceConfig from '@/components/VoiceConfig.vue'

export default {
  components: {
    VoiceConfig
  }
}
</script>
```

### Or create dedicated route:

```javascript
// router.js
{
  path: '/admin/voice-config',
  name: 'VoiceConfig',
  component: () => import('@/components/VoiceConfig.vue')
}
```

---

## Testing

### 1. Run Database Migration:

```sql
-- Run in Supabase SQL Editor
\i database/migrations/2025-11-13_agent_voice_config.sql
```

### 2. Test UI (Local Development):

```bash
cd portal
npm run dev
# Navigate to VoiceConfig component
```

### 3. Test Different Providers:

**Test ElevenLabs (default):**
- Select ElevenLabs → rachel → Save
- Make test call → Should hear Rachel voice

**Test OpenAI:**
- Select OpenAI → nova → Save
- Make test call → Should hear Nova voice

**Test Google Cloud:**
- Select Google Cloud → en-US-Neural2-A → Save
- Make test call → Should hear Google Neural2 voice

**Test Rime with Arcana:**
- Select Rime → luna → Model: arcana → Save
- Make test call → Should hear Rime Luna (Arcana) voice

### 4. Test Spanish:

- Switch to 🇲🇽 Spanish (Mexico) tab
- Select provider (e.g., ElevenLabs → domi)
- Save
- Test Spanish call

---

## Voice Format Reference (English & Spanish Only)

### ElevenLabs (Recommended)

**Format:** Just voice name  
**English:** `rachel`, `clyde`, `domi`, `fin`, `josh`, `nicole`  
**Spanish:** `domi`, `antoni`, `serena`  
**Becomes:** `elevenlabs.{voice_name}`

### OpenAI

**Format:** Just voice name  
**English:** `alloy`, `echo`, `fable`, `nova`, `onyx`, `shimmer`  
**Spanish:** `nova` (multilingual), `alloy` (multilingual)  
**Becomes:** `openai.{voice_name}`

### Google Cloud

**Format:** Full voice code  
**English:** `en-US-Neural2-A`, `en-US-Neural2-C`, `en-US-Wavenet-A`  
**Spanish:** `es-US-Neural2-A`, `es-MX-Neural2-A`  
**Becomes:** `gcloud.{voice_code}`

### Amazon Polly

**Format:** Voice:model or Voice:model:language  
**English:** `Joanna:neural`, `Matthew:neural`, `Ruth:neural`  
**Spanish:** `Lupe:neural:es-US`, `Mia:neural:es-MX`, `Andres:neural:es-MX`  
**Becomes:** `amazon.{voice_string}` (as-is)

### Microsoft Azure

**Format:** Full voice code (NO PREFIX)  
**English:** `en-US-JennyNeural`, `en-US-GuyNeural`, `en-US-AriaNeural`  
**Spanish:** `es-US-PalomaNeural`, `es-MX-DaliaNeural`, `es-MX-JorgeNeural`  
**Becomes:** Voice code as-is (no prefix)

### Cartesia

**Format:** Full UUID  
**English:** `156fb8d2-335b-4950-9cb3-a2d33befec77` (Helpful Woman)  
**Spanish:** `846d6cb0-2301-48b6-9683-48f5618ea2f6` (Spanish Lady), `5c5ad5e7-1020-476b-8b91-fdcbe9cc313c` (Mexican Woman)  
**Becomes:** `cartesia.{uuid}`

### Rime

**Format:** Voice name + optional model  
**English:** `luna` (with model: `arcana` or empty for Mist v2)  
**Spanish:** `luna` (multilingual with Arcana)  
**Becomes:** `rime.{voice_name}` + model parameter

---

## Examples

### Example 1: Switch to OpenAI Nova

**In Vue UI:**
1. Select "OpenAI" from dropdown
2. Enter "nova" in Voice Name field
3. Click "Save Configuration"

**Database:**
```sql
UPDATE agent_voice_config 
SET tts_engine = 'openai', voice_name = 'nova' 
WHERE vertical = 'reverse_mortgage' AND language_code = 'en-US';
```

**Agent loads:**
```python
voice_config = _get_voice_config("reverse_mortgage", "en-US")
# {"engine": "openai", "voice_name": "nova", "model": null}

voice_string = _build_voice_string("openai", "nova")
# "openai.nova"

agent.add_language("English", "en-US", voice="openai.nova", engine="openai")
```

**Result:** Barbara speaks with OpenAI Nova voice

---

### Example 2: Use Rime Luna (Arcana Model)

**In Vue UI:**
1. Select "Rime" from dropdown
2. Enter "luna" in Voice Name field
3. Enter "arcana" in Model field
4. Click "Save Configuration"

**Database:**
```sql
UPDATE agent_voice_config 
SET tts_engine = 'rime', voice_name = 'luna', model = 'arcana' 
WHERE vertical = 'reverse_mortgage' AND language_code = 'en-US';
```

**Agent loads:**
```python
voice_config = _get_voice_config("reverse_mortgage", "en-US")
# {"engine": "rime", "voice_name": "luna", "model": "arcana"}

voice_string = _build_voice_string("rime", "luna")
# "rime.luna"

agent.add_language("English", "en-US", voice="rime.luna", engine="rime", model="arcana")
```

**Result:** Barbara speaks with Rime Luna (Arcana model)

---

### Example 3: Spanish with Google Cloud

**In Vue UI:**
1. Switch to 🇲🇽 Spanish (Mexico) tab
2. Select "Google Cloud" from dropdown
3. Click "es-MX-Neural2-A" chip (or type it)
4. Click "Save Configuration"

**Database:**
```sql
UPDATE agent_voice_config 
SET tts_engine = 'google', voice_name = 'es-MX-Neural2-A' 
WHERE vertical = 'reverse_mortgage' AND language_code = 'es-MX';
```

**Agent loads:**
```python
voice_config = _get_voice_config("reverse_mortgage", "es-MX")
# {"engine": "google", "voice_name": "es-MX-Neural2-A", "model": null}

voice_string = _build_voice_string("google", "es-MX-Neural2-A")
# "gcloud.es-MX-Neural2-A"

agent.add_language("Spanish", "es-MX", voice="gcloud.es-MX-Neural2-A", engine="google")
```

**Result:** Barbara speaks Spanish with Google Cloud Neural2 voice

---

## Benefits

### Before (Hardcoded):
❌ Only ElevenLabs  
❌ Change requires code deployment  
❌ No UI for non-technical users  
❌ Environment variable management

### After (Configurable):
✅ 7 providers supported  
✅ Change via admin UI (no code deploy)  
✅ Non-technical users can configure  
✅ Database-driven, per-language control  
✅ Env fallback for safety

---

## File Summary

**NEW:**
- `database/migrations/2025-11-13_agent_voice_config.sql` - Schema + defaults
- `portal/src/components/VoiceConfig.vue` - Admin UI

**MODIFIED:**
- `equity_connect/agent/barbara_agent.py` - Added `_get_voice_config()` and `_build_voice_string()` helpers

**Lines Added:** ~450 lines
- SQL: 35 lines
- Python helpers: 80 lines
- Vue component: 335 lines

---

## Migration Checklist

- [ ] Run `database/migrations/2025-11-13_agent_voice_config.sql`
- [ ] Verify default configs inserted (3 rows)
- [ ] Test VoiceConfig.vue in portal
- [ ] Switch provider in UI and save
- [ ] Make test call to verify voice changed
- [ ] Test all 3 languages (en-US, es-US, es-MX)
- [ ] Verify env fallback works if DB fails

---

**🎉 TTS provider now fully configurable! Admins can switch providers without code changes.**

