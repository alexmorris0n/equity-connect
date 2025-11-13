# SignalWire Voice Configuration System

Complete voice selector for Barbara AI agent with support for **7 TTS providers** and **400+ voices**.

---

## 🎤 Features

### **Provider Support**
1. **ElevenLabs** - 38 curated voices (Multilingual v2)
2. **Rime** - 8+ flagship voices (Mist v2, Arcana models)
3. **OpenAI** - 6 voices (TTS-1 model)
4. **Amazon Polly** - 60+ voices (Standard, Neural, Generative models)
5. **Microsoft Azure** - 30+ English USA voices (Neural model)
6. **Google Cloud** - 40+ voices (Chirp 3 HD, Neural2, WaveNet, Standard)
7. **Cartesia** - 200+ voices (Sonic model)

### **Selection Features**
- ✅ **Provider dropdown** - Choose from 7 TTS providers
- ✅ **Gender filter** - Filter by Female, Male, or Neutral voices
- ✅ **Voice dropdown** - Organized by gender with descriptions
- ✅ **Manual override** - Enter custom voice IDs (e.g., "tiffany" for ElevenLabs custom voices)
- ✅ **Live preview** - See final voice string format
- ✅ **Copy button** - One-click copy to clipboard
- ✅ **Provider docs links** - Direct links to official documentation

---

## 📁 Files Created

### **Frontend**
```
equity_connect_frontend/
├── src/
│   ├── constants/
│   │   └── voices.ts              # Voice data for all 7 providers (400+ voices)
│   └── components/
│       └── VoiceSelector.vue      # Vue component with provider → gender → voice selection
```

### **Backend/Database**
```
database/migrations/
└── 20241112_update_signalwire_voices.sql  # Existing migration (already applied)
```

---

## 🚀 Usage

### **In a Vue Component**

```vue
<template>
  <div>
    <h2>Configure Barbara's Voice</h2>
    <VoiceSelector v-model="selectedVoice" />
    
    <button @click="saveVoice">Save Configuration</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import VoiceSelector from '@/components/VoiceSelector.vue';

const selectedVoice = ref('elevenlabs.rachel'); // Default voice

async function saveVoice() {
  // Save to database
  await fetch('/api/prompts/update-voice', {
    method: 'POST',
    body: JSON.stringify({ voice: selectedVoice.value }),
  });
}
</script>
```

### **Voice String Format**

The component returns SignalWire-compatible voice strings:

| Provider | Format | Example |
|----------|--------|---------|
| ElevenLabs | `elevenlabs.<name>` | `elevenlabs.rachel` |
| Rime | `rime.<name>` | `rime.luna` |
| OpenAI | `openai.<name>` | `openai.alloy` |
| Amazon | `amazon.<voice>:<model>:<lang>` | `amazon.Joanna:neural:en-US` |
| Azure | `<language>-<model>` | `en-US-JennyNeural` |
| Google | `gcloud.<language>-<model>-<variant>` | `gcloud.en-US-Neural2-C` |
| Cartesia | `cartesia.<uuid>` | `cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab` |

---

## 📊 Voice Data Structure

### **TypeScript Types**

```typescript
type VoiceGender = 'female' | 'male' | 'neutral';

interface VoiceOption {
  id: string;              // Voice ID (e.g., "rachel")
  displayName: string;     // Display name (e.g., "Rachel")
  gender: VoiceGender;     // Gender category
  description?: string;    // Voice description (e.g., "Natural, conversational")
  model?: string;          // Model (e.g., "neural", "arcana")
  languageCode?: string;   // Language code (e.g., "en-US")
}

interface VoiceProvider {
  id: string;                      // Provider ID (e.g., "elevenlabs")
  name: string;                    // Display name (e.g., "ElevenLabs")
  prefix: string;                  // Voice string prefix (e.g., "elevenlabs.")
  voices: VoiceOption[];           // List of available voices
  supportsManualOverride: boolean; // Allow custom voice IDs
  formatExample: string;           // Example format (e.g., "elevenlabs.rachel")
  hasModels?: boolean;             // Has multiple models (e.g., Amazon Polly)
  searchable?: boolean;            // Large voice list (Cartesia, Azure, Google)
  docsUrl?: string;                // Link to provider documentation
}
```

### **Helper Functions**

```typescript
import {
  voiceProviders,
  getVoiceProvider,
  getVoicesByProvider,
  formatVoiceString,
  parseVoiceString,
} from '@/constants/voices';

// Get all providers
console.log(voiceProviders);  // Array of 7 providers

// Get specific provider
const elevenlabs = getVoiceProvider('elevenlabs');

// Get voices by provider and gender
const femaleVoices = getVoicesByProvider('elevenlabs', 'female');

// Format voice string
const voiceString = formatVoiceString('elevenlabs', 'rachel');
// Result: "elevenlabs.rachel"

// Parse voice string
const parsed = parseVoiceString('elevenlabs.rachel');
// Result: { providerId: 'elevenlabs', voiceId: 'rachel' }
```

---

## 🎨 UI Components

### **VoiceSelector.vue**

**Props:**
- `modelValue?: string` - Current voice string (v-model binding)

**Emits:**
- `update:modelValue(value: string)` - When voice selection changes

**Features:**
1. **Provider Selection** - Dropdown with 7 providers
2. **Gender Filter** - Radio buttons (All, Female, Male, Neutral)
3. **Voice Dropdown** - Organized by gender with descriptions
4. **Manual Override** - Text field for custom voice IDs
5. **Final Voice String** - Shows formatted voice string with copy button
6. **Documentation Links** - Links to provider docs

**Example:**

```vue
<!-- Basic usage -->
<VoiceSelector v-model="voice" />

<!-- With initial value -->
<VoiceSelector v-model="voice" />
<script setup>
const voice = ref('elevenlabs.rachel');
</script>
```

---

## 🗄️ Database Schema

### **prompts table**

The `voice` column stores the SignalWire voice string:

```sql
-- Voice configuration column
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS voice VARCHAR(255);

-- Comments
COMMENT ON COLUMN prompts.voice IS 
  'SignalWire voice format: provider.voice_name 
   (e.g., elevenlabs.rachel, openai.alloy, rime.luna)';
```

### **signalwire_available_voices table**

Reference table with all available voices:

```sql
CREATE TABLE signalwire_available_voices (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,           -- elevenlabs, openai, rime, etc.
  voice_name TEXT NOT NULL,         -- rachel, alloy, luna, etc.
  voice_id_full TEXT NOT NULL UNIQUE, -- elevenlabs.rachel, openai.alloy, etc.
  display_name TEXT NOT NULL,       -- Rachel (Female), Alloy (Neutral), etc.
  gender TEXT,                      -- male, female, neutral
  accent TEXT,                      -- american, british, etc.
  language_codes TEXT[],            -- ['en-US', 'en-GB', 'es-MX']
  model TEXT,                       -- turbo_v2_5, multilingual_v2, arcana, etc.
  quality_tier TEXT,                -- standard, premium, ultra
  latency_ms INTEGER,               -- typical latency
  is_available BOOLEAN DEFAULT true,
  notes TEXT
);
```

---

## 📖 Provider Documentation

### **ElevenLabs**
- 38 curated voices
- Multilingual v2 model
- Custom voices supported (use manual override)
- Docs: https://elevenlabs.io/voices

### **Rime**
- 8+ flagship voices (luna, celeste, orion, ursa, astra, esther, estelle, andromeda, colby)
- Mist v2 (fast) and Arcana (ultra-realistic) models
- Docs: https://docs.rime.ai/api-reference/voices

### **OpenAI**
- 6 voices (alloy, echo, fable, onyx, nova, shimmer)
- TTS-1 model
- Multilingual support
- Docs: https://platform.openai.com/docs/guides/text-to-speech

### **Amazon Polly**
- 60+ voices across 3 models
- Standard, Neural, Generative models
- Generative voices are most realistic
- Docs: https://docs.aws.amazon.com/polly/latest/dg/voicelist.html

### **Microsoft Azure**
- 30+ English USA Neural voices
- 830+ voices total (all languages)
- High quality Neural model
- Docs: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support

### **Google Cloud**
- 40+ English USA voices
- Chirp 3 HD (conversational), Neural2 (premium), WaveNet (high quality), Standard (cost-efficient)
- Studio voices NOT supported by SignalWire
- Docs: https://cloud.google.com/text-to-speech/docs/voices

### **Cartesia**
- 200+ voices with UUIDs
- Sonic model (low latency)
- Multilingual support
- Docs: https://docs.cartesia.ai/

---

## 🔧 Advanced Usage

### **Custom Voice IDs**

To use a custom ElevenLabs voice (e.g., "Tiffany"):

1. Select **ElevenLabs** provider
2. Scroll to **"Or Enter Custom Voice ID"**
3. Enter `tiffany`
4. Final string: `elevenlabs.tiffany`

### **Amazon Polly Models**

Amazon Polly has 3 models with different formats:

```typescript
// Standard model (default)
'amazon.Joanna'  // or 'amazon.Joanna:standard:en-US'

// Neural model (better quality)
'amazon.Joanna:neural:en-US'

// Generative model (most realistic)
'amazon.Danielle:generative:en-US'
```

### **Programmatic Voice Selection**

```typescript
import { voiceProviders, formatVoiceString } from '@/constants/voices';

// Get all female ElevenLabs voices
const femaleVoices = voiceProviders
  .find(p => p.id === 'elevenlabs')
  ?.voices.filter(v => v.gender === 'female');

// Format voice string
const voiceString = formatVoiceString('elevenlabs', femaleVoices[0].id);

// Save to database
await updatePromptVoice(promptId, voiceString);
```

---

## ✅ Testing

### **Test Voice Configuration**

1. Open Barbara configuration UI
2. Select **ElevenLabs** provider
3. Select **Female** gender filter
4. Select **Rachel** voice
5. Verify final string shows: `elevenlabs.rachel`
6. Click **Copy** button to copy string
7. Save configuration

### **Test Custom Voice**

1. Select **ElevenLabs** provider
2. Enter `tiffany` in manual override field
3. Verify final string shows: `elevenlabs.tiffany`
4. Save configuration

### **Test Voice Parsing**

```typescript
import { parseVoiceString } from '@/constants/voices';

const parsed = parseVoiceString('elevenlabs.rachel');
console.log(parsed);
// Output: { providerId: 'elevenlabs', voiceId: 'rachel' }
```

---

## 🎯 Next Steps

1. ✅ Voice data constants file created
2. ✅ VoiceSelector Vue component built
3. ✅ Database schema already exists
4. ⏭️ Integrate VoiceSelector into BarbaraConfig.vue
5. ⏭️ Update Barbara agent to read voice from database
6. ⏭️ Test voice selection with live calls

---

## 🐛 Troubleshooting

### **Voice Not Found**

If a voice isn't working:
1. Check voice string format matches provider requirements
2. Verify voice is in SignalWire's supported list
3. For custom voices, contact SignalWire support to add them

### **Provider Documentation**

Always refer to the official provider documentation for the most up-to-date voice lists:
- Each provider has a `docsUrl` in the voice data
- Links are available in the VoiceSelector component

### **Database Migration**

The voice configuration migration is already applied:
- File: `database/migrations/20241112_update_signalwire_voices.sql`
- Table: `signalwire_available_voices` (reference table)
- Column: `prompts.voice` (stores voice string)

---

## 📚 Related Documentation

- [SignalWire Voice API](../SignalWire Voice API.md)
- [SignalWire AI Agents SDK](../SignalWire AI Agents SDK - Complete API Reference.md)
- [Barbara Agent Implementation](../../equity_connect/agent/barbara_agent.py)

---

**Last Updated:** 2025-01-12  
**Version:** 1.0.0  
**Providers:** 7  
**Voices:** 400+

