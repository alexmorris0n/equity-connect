# Eden AI Integration Guide

This document describes how Eden AI is integrated into the LiveKit voice agent system.

## Overview

**Eden AI is used for STT (Speech-to-Text) and TTS (Text-to-Speech) only.**

**For LLM (Language Models), we use OpenRouter via the official LiveKit plugin** (`openai.LLM.with_openrouter()`).

Eden AI provides a unified API that routes STT/TTS requests to multiple providers (Deepgram, ElevenLabs, OpenAI, etc.) through a single API key. This allows you to:

- Switch between STT/TTS providers without changing code
- Use multiple providers for different phone numbers
- Configure provider/model selection per call from Supabase

## Configuration

### Environment Variables

Add to your `.env` file:
```bash
EDENAI_API_KEY=your-edenai-api-key
```

### Database Configuration

In the `signalwire_phone_numbers` table, configure providers:

**For STT (Speech-to-Text):**
```sql
UPDATE signalwire_phone_numbers 
SET 
  stt_provider = 'edenai',
  stt_edenai_provider = 'deepgram',  -- or 'openai', 'assemblyai', 'google'
  stt_model = 'nova-2'  -- optional, provider-specific model
WHERE number = '+14244851544';
```

**For TTS (Text-to-Speech):**
```sql
UPDATE signalwire_phone_numbers 
SET 
  tts_provider = 'edenai',
  tts_edenai_provider = 'elevenlabs',  -- or 'openai', 'playht', 'google'
  tts_voice = 'shimmer'  -- provider-specific voice
WHERE number = '+14244851544';
```

**For LLM (Language Model) - Use OpenRouter instead:**
```sql
UPDATE signalwire_phone_numbers 
SET 
  llm_provider = 'openrouter',
  llm_model = 'anthropic/claude-sonnet-4.5',  -- or 'openai/gpt-5', etc.
  llm_fallback_models = 'openai/gpt-4o,meta/llama-3-70b'  -- optional fallback models
WHERE number = '+14244851544';
```

**Note:** Eden AI is NOT used for LLM. We use OpenRouter via the official LiveKit plugin for better compatibility and streaming support.

## Supported Providers

### STT Providers via Eden AI
- `deepgram` - Deepgram STT
- `openai` - OpenAI Whisper
- `assemblyai` - AssemblyAI
- `google` - Google Speech-to-Text

### TTS Providers via Eden AI
- `elevenlabs` - ElevenLabs
- `openai` - OpenAI TTS
- `playht` - PlayHT
- `google` - Google Cloud TTS

### LLM Providers (via OpenRouter, NOT Eden AI)
- Use `openrouter` as `llm_provider` in Supabase
- Models: `anthropic/claude-sonnet-4.5`, `openai/gpt-5`, `google/gemini-pro`, etc.
- See OpenRouter documentation for full model list

## Usage Examples

### Example 1: Using Eden AI for STT/TTS, OpenRouter for LLM

```python
# Phone config in Supabase
{
  "stt_provider": "edenai",
  "stt_edenai_provider": "deepgram",
  "stt_model": "nova-2",
  
  "tts_provider": "edenai",
  "tts_edenai_provider": "elevenlabs",
  "tts_voice": "shimmer",
  
  "llm_provider": "openrouter",  # Use OpenRouter, not Eden AI
  "llm_model": "anthropic/claude-sonnet-4.5",
  "llm_fallback_models": "openai/gpt-4o,meta/llama-3-70b"
}
```

### Example 2: Mixed Providers (Eden AI STT/TTS + Direct LLM)

```python
# Use Eden AI for STT/TTS, direct OpenAI for LLM
{
  "stt_provider": "edenai",
  "stt_edenai_provider": "deepgram",
  
  "tts_provider": "edenai",
  "tts_edenai_provider": "elevenlabs",
  
  "llm_provider": "openai",  # Direct OpenAI, not through Eden AI
  "llm_model": "gpt-5"
}
```

## Implementation Details

### STT Provider (`providers/stt.py`)

The `EdenAISTT` class:
- Buffers audio chunks (Eden AI doesn't support true streaming)
- Sends audio to Eden AI's `/audio/speech_to_text_async` endpoint
- Extracts transcription from the response
- Supports provider-specific model selection

### TTS Provider (`providers/tts.py`)

The `EdenAITTS` class:
- Sends text to Eden AI's `/audio/text_to_speech` endpoint
- Downloads audio from the returned URL or decodes base64
- Supports provider-specific voice selection

### LLM Provider

**Eden AI is NOT used for LLM.** We use OpenRouter via the official LiveKit plugin (`openai.LLM.with_openrouter()`) for:
- Full LiveKit compatibility
- Streaming support
- Tool/function calling support
- Automatic fallback models
- Better performance and reliability

## Cost Tracking

Eden AI STT/TTS pricing is tracked based on the underlying provider (Deepgram, ElevenLabs, etc.) in `services/config.py`.

OpenRouter LLM pricing is tracked separately:

```python
'openrouter': {
    'anthropic/claude-sonnet-4.5': 0.003,
    'openai/gpt-5': 0.01,
    'openai/gpt-5-mini': 0.002,
    'google/gemini-pro': 0.0005,
    # ... etc
}
```

Costs are calculated based on the provider and model used.

## Fallback Logic

Eden AI providers support the same fallback logic as direct providers:

1. Try primary provider (e.g., `edenai` with `deepgram`)
2. Try per-number fallback provider
3. Try global default fallback provider
4. Try hardcoded fallback (OpenAI)

## Limitations

1. **Streaming**: Eden AI STT doesn't support true streaming - audio is buffered and sent as a single request
2. **LLM**: Eden AI is NOT used for LLM - use OpenRouter via official plugin instead
3. **LiveKit Integration**: Eden AI STT/TTS use REST APIs wrapped in LiveKit plugin interfaces - some advanced streaming features may be limited compared to native LiveKit plugins

## Testing

To test Eden AI integration:

1. Set `EDENAI_API_KEY` in your environment
2. Configure a phone number in Supabase with Eden AI providers
3. Make a test call
4. Check logs for Eden AI API calls
5. Verify costs are tracked correctly

## Migration Notes

**For LLM**: Continue using OpenRouter via the official LiveKit plugin - this is the recommended approach.

**For STT/TTS**: To migrate to Eden AI:

1. Update `stt_provider` or `tts_provider` to `edenai` in Supabase
2. Add `stt_edenai_provider` or `tts_edenai_provider` fields to specify underlying provider
3. Update model/voice names if needed (Eden AI uses different naming)
4. Add `EDENAI_API_KEY` to your environment variables

## References

- [Eden AI Documentation](https://docs.edenai.co/)
- [Eden AI Python SDK](https://github.com/edenai/edenai-python-sdk)
- [Eden AI API Reference](https://docs.edenai.co/reference)

