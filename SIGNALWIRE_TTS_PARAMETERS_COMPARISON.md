# SignalWire TTS Parameters Comparison Chart

**Last Updated:** January 2025  
**Platform:** SignalWire AI Agents / SWML

---

## 📊 Complete Parameter Comparison

### **Common Parameters (Available Across All Providers)**

| Parameter | Type | Range/Values | Description | Format Example |
|-----------|------|--------------|-------------|----------------|
| **Voice Selection** | `string` | Provider-specific | Voice identifier (required) | `elevenlabs.rachel`, `openai.alloy` |
| **Language Code** | `string` | ISO language codes | Language for voice output | `en-US`, `es-MX`, `fr-FR` |
| **AI Volume** | `integer` | -50 to 50 | SignalWire AI-level volume control | Applied at AI session level |

---

## 🔧 Provider-Specific Parameters

### **1. ElevenLabs** (`elevenlabs.<voice>`)

| Parameter | Type | Range | Default | Description | SignalWire Access |
|-----------|------|-------|---------|-------------|-------------------|
| **Voice** | `string` | 38+ voices | `rachel` | Voice name (rachel, domi, emily, etc.) | Via `ai.languages[].voice` |
| **Model** | `string` | `multilingual_v2` | `multilingual_v2` | TTS model (fixed for SignalWire) | Not configurable |
| **Stability** | `float` | 0.0 to 1.0 | 0.5 | Voice consistency/randomness | Via `ai.params.eleven_labs_stability` |
| **Similarity Boost** | `float` | 0.0 to 1.0 | 0.75 | Closeness to original voice | Via `ai.params.eleven_labs_similarity` |
| **Style** | `float` | 0.0 to 1.0 | - | Expression/emotion level | Not available via SignalWire |
| **Use Speaker Boost** | `boolean` | true/false | false | Enhances speaker clarity | Not available via SignalWire |

**Format:** `elevenlabs.rachel`  
**Supported Languages:** Multilingual (11+ languages per voice)  
**SSML Support:** ❌ No

---

### **2. Rime** (`rime.<voice>`)

| Parameter | Type | Range | Default | Description | SignalWire Access |
|-----------|------|-------|---------|-------------|-------------------|
| **Voice** | `string` | 8+ voices | `luna` | Voice name (luna, celeste, orion, etc.) | Via `ai.languages[].voice` |
| **Model** | `string` | `mist_v2`, `arcana` | `mist_v2` | Model selection | Via voice selection |
| **Speed** | `float` | 0.5 to 2.0 | 1.0 | Speaking rate | Not available via SignalWire |

**Format:** `rime.luna`  
**Supported Languages:** English (some bilingual)  
**SSML Support:** ❌ No  
**Notes:** 
- Mist v2: Optimized for speed and low latency
- Arcana: Ultra-realistic, captures natural speech nuances

---

### **3. OpenAI** (`openai.<voice>`)

| Parameter | Type | Range | Default | Description | SignalWire Access |
|-----------|------|-------|---------|-------------|-------------------|
| **Voice** | `string` | 6 voices | `alloy` | Voice name (alloy, echo, fable, onyx, nova, shimmer) | Via `ai.languages[].voice` |
| **Model** | `string` | `tts-1` | `tts-1` | TTS model (fixed) | Not configurable |
| **Speed** | `float` | 0.25 to 4.0 | 1.0 | Speaking rate | Not available via SignalWire |

**Format:** `openai.alloy`  
**Supported Languages:** 11+ languages (multilingual per voice)  
**SSML Support:** ❌ No

---

### **4. Amazon Polly** (`amazon.<voice>:<model>:<lang>`)

| Parameter | Type | Range | Default | Description | SignalWire Access |
|-----------|------|-------|---------|-------------|-------------------|
| **Voice** | `string` | 60+ voices | `Joanna` | Voice name | Via `ai.languages[].voice` |
| **Model** | `string` | `standard`, `neural`, `generative` | `standard` | Engine type | Via voice format string |
| **Language** | `string` | ISO codes | `en-US` | Language code | Via voice format string |
| **Speaking Rate** | `string` | SSML prosody | - | Speech speed (via SSML) | Via SSML in prompt |
| **Pitch** | `string` | SSML prosody | - | Voice pitch (via SSML) | Via SSML in prompt |
| **Volume** | `string` | SSML prosody | - | Output volume (via SSML) | Via SSML in prompt |
| **Lexicon** | `string` | Custom | - | Custom pronunciation | Not available via SignalWire |

**Format:** `amazon.Joanna:neural:en-US` or `amazon.Danielle:generative:en-US`  
**Supported Languages:** 40+ languages  
**SSML Support:** ✅ Yes (full SSML support)  
**Notes:**
- Standard: Cost-efficient, good quality
- Neural: Better quality, more natural
- Generative: Most realistic (limited voices)

---

### **5. Microsoft Azure** (`en-US-<Voice>Neural`)

| Parameter | Type | Range | Default | Description | SignalWire Access |
|-----------|------|-------|---------|-------------|-------------------|
| **Voice** | `string` | 30+ US voices | `JennyNeural` | Voice name with locale | Via `ai.languages[].voice` |
| **Model** | `string` | `Neural` | `Neural` | Neural TTS model | Fixed |
| **Speaking Rate** | `string` | SSML prosody | - | Speech speed (via SSML) | Via SSML in prompt |
| **Pitch** | `string` | SSML prosody | - | Voice pitch (via SSML) | Via SSML in prompt |
| **Volume** | `string` | SSML prosody | - | Output volume (via SSML) | Via SSML in prompt |
| **Style** | `string` | SSML express-as | - | Speaking style/emotion | Via SSML in prompt |

**Format:** `en-US-JennyNeural`, `en-US-GuyNeural`  
**Supported Languages:** 140+ languages (830+ voices total)  
**SSML Support:** ✅ Yes (full SSML support)  
**Notes:**
- High-quality Neural voices
- Supports SSML for advanced customization
- Style/emotion control via SSML `express-as`

---

### **6. Google Cloud** (`gcloud.<lang>-<model>-<variant>`)

| Parameter | Type | Range | Default | Description | SignalWire Access |
|-----------|------|-------|---------|-------------|-------------------|
| **Voice** | `string` | 40+ US voices | - | Voice identifier | Via `ai.languages[].voice` |
| **Model** | `string` | `Standard`, `WaveNet`, `Neural2`, `Chirp-HD` | - | TTS model | Via voice format string |
| **Speaking Rate** | `float` | 0.25 to 4.0 | 1.0 | Speech speed | Not available via SignalWire |
| **Pitch** | `float` | -20.0 to 20.0 | 0.0 | Voice pitch (semitones) | Not available via SignalWire |
| **Volume Gain** | `float` | -96.0 to 16.0 | 0.0 | Volume adjustment (dB) | Not available via SignalWire |
| **Audio Profile** | `string` | Various | - | Audio optimization | Not available via SignalWire |

**Format:** `gcloud.en-US-Neural2-C`, `gcloud.en-US-Chirp-HD-A`  
**Supported Languages:** 40+ languages  
**SSML Support:** ✅ Yes (full SSML support)  
**Notes:**
- Chirp 3 HD: Optimized for conversational AI
- Neural2: Premium quality neural voices
- Studio voices NOT supported by SignalWire

---

### **7. Cartesia** (`cartesia.<uuid>`)

| Parameter | Type | Range | Default | Description | SignalWire Access |
|-----------|------|-------|---------|-------------|-------------------|
| **Voice** | `string` | 200+ UUIDs | - | Voice UUID | Via `ai.languages[].voice` |
| **Model** | `string` | `sonic` | `sonic` | Sonic model (fixed) | Not configurable |
| **Speed** | `float` | 0.5 to 2.0 | 1.0 | Speaking rate | Not available via SignalWire |
| **Emotion** | `string` | Provider-specific | - | Emotional tone | Not available via SignalWire |

**Format:** `cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab`  
**Supported Languages:** Multiple languages  
**SSML Support:** ❌ No  
**Notes:**
- Low-latency Sonic model
- Large voice library (200+ voices)
- Identified by UUIDs

---

## 🎚️ SignalWire AI-Level Parameters

These parameters are set at the AI session level and apply across all TTS providers:

| Parameter | Type | Range | Default | Description | Access Method |
|-----------|------|-------|---------|-------------|---------------|
| **AI Volume** | `integer` | -50 to 50 | 0 | Overall AI voice volume | `ai.params.ai_volume` |
| **ElevenLabs Stability** | `float` | 0.0 to 1.0 | 0.5 | ElevenLabs voice stability | `ai.params.eleven_labs_stability` |
| **ElevenLabs Similarity** | `float` | 0.0 to 1.0 | 0.75 | ElevenLabs voice similarity | `ai.params.eleven_labs_similarity` |

**Example Configuration (SWML):**
```yaml
sections:
  main:
    - ai:
        params:
          ai_volume: 10  # Increase volume by 10
          eleven_labs_stability: 0.7  # More stable voice
          eleven_labs_similarity: 0.8  # Closer to original voice
        languages:
          - name: English
            voice: elevenlabs.rachel
            code: en-US
```

---

## 📋 Summary Table

| Provider | SSML | Speed Control | Pitch Control | Volume Control | Stability | Emotion | Custom Params |
|----------|------|---------------|---------------|----------------|-----------|---------|---------------|
| **ElevenLabs** | ❌ | ❌ | ❌ | ✅ (AI-level) | ✅ (SignalWire) | ❌ | Similarity Boost |
| **Rime** | ❌ | ❌* | ❌ | ✅ (AI-level) | ❌ | ❌ | Model (Mist/Arcana) |
| **OpenAI** | ❌ | ❌* | ❌ | ✅ (AI-level) | ❌ | ❌ | - |
| **Amazon Polly** | ✅ | ✅ (SSML) | ✅ (SSML) | ✅ (SSML) | ❌ | ❌ | Lexicon, Model Type |
| **Microsoft Azure** | ✅ | ✅ (SSML) | ✅ (SSML) | ✅ (SSML) | ❌ | ✅ (SSML) | Style/Emotion |
| **Google Cloud** | ✅ | ❌* | ❌* | ❌* | ❌ | ❌ | Audio Profile* |
| **Cartesia** | ❌ | ❌* | ❌ | ✅ (AI-level) | ❌ | ❌* | Emotion* |

*Not available through SignalWire's interface, but supported by native provider API

---

## 🔍 Key Findings

### **What's Common:**
1. ✅ **Voice Selection** - All providers require voice identifier
2. ✅ **Language Support** - Most support multiple languages
3. ✅ **AI Volume** - SignalWire provides global volume control

### **What's Unique:**

#### **ElevenLabs:**
- ✅ Stability control (via SignalWire params)
- ✅ Similarity boost (via SignalWire params)
- ✅ Largest curated voice library (38+ voices)

#### **Amazon Polly & Azure:**
- ✅ Full SSML support for advanced customization
- ✅ Speaking rate, pitch, volume control via SSML
- ✅ Azure: Style/emotion control via SSML

#### **Google Cloud:**
- ✅ SSML support (but advanced params not exposed via SignalWire)
- ✅ Multiple model tiers (Standard, WaveNet, Neural2, Chirp HD)

#### **Rime:**
- ✅ Two model options (Mist v2 for speed, Arcana for realism)
- ✅ Optimized for low latency

#### **Cartesia:**
- ✅ Largest voice library (200+ voices)
- ✅ Lowest latency (Sonic model)

---

## 📚 References

- [SignalWire AI Parameters](https://developer.signalwire.com/swml/methods/ai/params)
- [SignalWire Languages Configuration](https://developer.signalwire.com/swml/methods/ai/languages)
- [SignalWire Voices Documentation](https://developer.signalwire.com/voice/getting-started/voice-and-languages/)
- [ElevenLabs API Documentation](https://elevenlabs.io/docs/api-reference)
- [Amazon Polly SSML Reference](https://docs.aws.amazon.com/polly/latest/dg/ssml.html)
- [Azure Neural TTS SSML](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup)

---

## 💡 Usage Recommendations

1. **For Natural Conversations:** ElevenLabs (with stability/similarity tuning) or Rime Arcana
2. **For SSML Control:** Amazon Polly or Microsoft Azure
3. **For Low Latency:** Rime Mist v2 or Cartesia Sonic
4. **For Cost Efficiency:** OpenAI TTS-1 or Google Cloud Standard
5. **For Premium Quality:** ElevenLabs Multilingual v2 or Rime Arcana

---

**Note:** Parameters marked with "*" are supported by the native provider API but may not be directly accessible through SignalWire's simplified interface. For advanced parameter control, consider using SSML (for Amazon Polly, Azure, and Google Cloud) or SignalWire's AI-level parameters (for ElevenLabs).


