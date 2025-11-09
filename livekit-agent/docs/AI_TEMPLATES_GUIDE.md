# AI Templates System - Complete Guide

## Overview

The AI Templates system allows brokers to configure and manage voice AI settings for their phone numbers. Templates define which STT (Speech-to-Text), TTS (Text-to-Speech), and LLM (Language Model) providers are used, along with all runtime parameters like VAD settings, temperature, and voice characteristics.

## Architecture

### Provider Strategy
- **Eden AI**: Aggregator for STT/TTS (access to Deepgram, ElevenLabs, PlayHT, Google, etc.)
- **OpenRouter**: Aggregator for LLM (access to GPT, Claude, Llama, Gemini, etc.)
- **OpenAI Realtime**: All-in-one (bundled STT+TTS+LLM for ultra-low latency)

### Data Flow
```
Phone Number → AI Template → Provider Configuration → LiveKit Agent → Voice Call
```

## Database Schema

### `ai_templates` Table
- **id**: UUID primary key
- **broker_id**: Owner (NULL for system templates)
- **name**: Template name (e.g., "Spanish Language")
- **STT fields**: `stt_provider`, `stt_model`, `stt_language`
- **TTS fields**: `tts_provider`, `tts_model`, `tts_voice_id`, `tts_speed`, `tts_stability`
- **LLM fields**: `llm_provider`, `llm_model`, `llm_temperature`, `llm_max_tokens`, `llm_top_p`, etc.
- **VAD fields**: `vad_enabled`, `vad_threshold`, `vad_prefix_padding_ms`, `vad_silence_duration_ms`
- **estimated_cost_per_minute**: Auto-calculated
- **is_system_default**: Read-only system presets
- **is_preset**: Shown in preset picker UI

### System Presets

1. **OpenAI Realtime (Best Quality)** - $0.45/min
   - All-in-one solution with GPT-4o Realtime
   - Best quality, highest cost
   - Use for premium/VIP leads

2. **Budget Friendly** - $0.12/min
   - Deepgram STT + PlayHT TTS + Llama 3.1 70B LLM
   - 70% cost savings vs Realtime
   - Use for high-volume campaigns

3. **Spanish Language** - $0.22/min
   - Deepgram STT + ElevenLabs multilingual TTS + Claude 3.5 Sonnet
   - Optimized for Spanish-speaking leads
   - High-quality multilingual support

## API Endpoints

### Template Management
- `GET /api/ai-templates?broker_id={id}` - List templates
- `POST /api/ai-templates` - Create template
- `PUT /api/ai-templates/{id}` - Update template
- `DELETE /api/ai-templates/{id}` - Delete template (if not in use)
- `POST /api/ai-templates/{id}/clone` - Clone system preset

### Provider Data
- `GET /api/ai-providers/health` - Check API key status
- `GET /api/ai-providers/all` - List all provider options
- `GET /api/ai-providers/stt-models?provider={provider}` - STT models
- `GET /api/ai-providers/tts-models?provider={provider}` - TTS models (grouped)
- `GET /api/ai-providers/tts-voices?provider={provider}&model={model}` - Voices
- `GET /api/ai-providers/llm-models?provider={provider}` - LLM models

### LiveKit Integration
- `POST /api/livekit/test-token` - Generate token for playground testing
- `GET /api/livekit/active-calls` - List active calls
- `POST /api/livekit/monitor-token/{call_id}` - Monitor live call
- `POST /api/livekit/webhooks` - Webhook handler for call events

## Cost Calculation

Costs are automatically calculated based on:
- **STT**: Per minute of audio processed
- **TTS**: Per 150 words generated (~1 minute of speech)
- **LLM**: Per 200 tokens (~4 turns/minute)

Example breakdown for "Budget Friendly":
```
STT (Deepgram Nova 2):     $0.0043/min
TTS (PlayHT 2.0 Turbo):    $0.0400/min
LLM (Llama 3.1 70B):       $0.0757/min (200 tokens)
-------------------------------------------
TOTAL:                     $0.12/min
```

## Migration Guide

### Assigning Default Template to Existing Phones

All phone numbers MUST have an assigned template. Run this after deploying:

```sql
-- Option 1: Assign all phones to "Budget Friendly" preset
UPDATE signalwire_phone_numbers
SET assigned_ai_template_id = (
  SELECT id FROM ai_templates
  WHERE name = 'Budget Friendly' AND is_system_default = TRUE
  LIMIT 1
)
WHERE assigned_ai_template_id IS NULL;

-- Option 2: Assign per broker based on their tier
-- (Requires manual mapping of broker → template preference)
```

### Adding Template Assignment to Phone Number UI

To add template selection to your phone number configuration UI, add this dropdown:

```vue
<n-form-item label="AI Configuration Template">
  <n-select 
    v-model:value="phoneData.assigned_ai_template_id"
    :options="availableTemplates"
    placeholder="Select AI template"
    clearable
  />
</n-form-item>

<script setup>
// Load templates on mount
const availableTemplates = ref([])

async function loadTemplates() {
  const response = await fetch(`/api/ai-templates?broker_id=${brokerId}`)
  const data = await response.json()
  
  availableTemplates.value = data.templates.map(t => ({
    label: `${t.name} ($${t.estimated_cost_per_minute}/min)`,
    value: t.id
  }))
}
</script>
```

### Testing After Migration

1. Check provider health: `GET /api/ai-providers/health`
2. List templates: `GET /api/ai-templates`
3. Test a template: `POST /api/livekit/test-token` → use in playground
4. Make test call and verify billing event is logged

## Provider Rate Limits

### Eden AI (Aggregator)
- **Deepgram**: 1000 concurrent requests
- **ElevenLabs**: Depends on subscription (usually 100-1000/month)
- **PlayHT**: 100 concurrent requests
- **Google**: 1000 concurrent requests

### OpenRouter (Aggregator)
- **Rate limits**: Varies by model, typically 60-300 req/min
- **Usage credits**: Buy in advance, auto-recharges

### OpenAI Realtime
- **Rate limits**: 100 concurrent sessions (Enterprise: higher)
- **Token limits**: 4096 tokens per request

## Voice ID Reference

### ElevenLabs Multilingual V2
| Voice ID | Name | Gender | Accent | Age |
|----------|------|--------|--------|-----|
| `21m00Tcm4TlvDq8ikWAM` | Rachel | Female | American | Young |
| `AZnzlk1XvdvUeBnXmlld` | Domi | Female | American | Young |
| `pNInz6obpgDQGcFmaJgB` | Adam | Male | American | Middle |

### OpenAI TTS
| Voice ID | Name | Gender | Accent |
|----------|------|--------|--------|
| `alloy` | Alloy | Neutral | American |
| `echo` | Echo | Male | American |
| `shimmer` | Shimmer | Female | American |
| `nova` | Nova | Female | American |

Full voice lists available at: `GET /api/ai-providers/tts-voices`

## Model Compatibility

All Eden AI models work with all OpenRouter LLMs. Only restriction:
- **OpenAI Realtime** requires all 3 providers set to `openai_realtime` (bundled)

## Troubleshooting

### Template validation fails
- Check `GET /api/ai-providers/health` to verify API keys
- Ensure all required fields are set (`name`, `stt_provider`, `tts_provider`, `llm_provider`, etc.)

### Can't delete template
- Template must not be assigned to any phone numbers
- System templates (is_system_default=true) cannot be deleted

### Calls not being billed
- Check webhook is configured: `POST /api/livekit/webhooks`
- Verify `template_id` is in call metadata
- Check `billing_events` table for entries

### Voice preview not working
- Requires valid API keys for the TTS provider
- Check browser console for CORS errors
- Verify `/api/ai-providers/tts-preview` endpoint exists

## Best Practices

1. **Start with system presets** - Clone and customize rather than creating from scratch
2. **Test before assigning** - Use playground to validate template works as expected
3. **Monitor costs** - Check `billing_events` table weekly to track spending
4. **Use Budget template for high-volume** - Reserve Realtime for premium leads
5. **Match template to use case** - Spanish template for Spanish leads, etc.

## Support

For issues or questions:
- Check logs: `livekit-agent/api_server.py` for API errors
- Check logs: `livekit-agent/agent.py` for agent errors
- Database issues: Query `ai_templates` and `billing_events` tables
- LiveKit issues: Check LiveKit Cloud dashboard or self-hosted logs

