# LiveKit Agent Environment Variables

This document lists all environment variables required for the LiveKit voice agent.

---

## 🔐 Required Variables

### LiveKit Configuration
```bash
# LiveKit Cloud credentials (required)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

### Supabase Configuration
```bash
# Supabase project credentials (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

### OpenAI (for LLM and evaluation)
```bash
# OpenAI API key (required for LLM and call evaluation)
OPENAI_API_KEY=sk-your-openai-key
```

---

## 🎙️ Provider Configuration

### STT (Speech-to-Text) Providers

**Deepgram** (optional, if using Deepgram STT):
```bash
DEEPGRAM_API_KEY=your-deepgram-api-key
```

**AssemblyAI** (optional, if using AssemblyAI STT):
```bash
ASSEMBLYAI_API_KEY=your-assemblyai-key
```

**Google Speech-to-Text** (optional, if using Google STT):
```bash
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_PROJECT_ID=your-google-project-id
```

### TTS (Text-to-Speech) Providers

**ElevenLabs** (optional, if using ElevenLabs TTS):
```bash
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

**PlayHT** (optional, if using PlayHT TTS):
```bash
PLAYHT_API_KEY=your-playht-api-key
PLAYHT_USER_ID=your-playht-user-id
```

**Deepgram Aura** (optional, if using Deepgram Aura TTS):
```bash
DEEPGRAM_API_KEY=your-deepgram-api-key  # Same as STT
```

**Google Cloud TTS** (optional, if using Google TTS):
```bash
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_PROJECT_ID=your-google-project-id
```

### LLM Providers

**OpenRouter** (optional, if using OpenRouter for LLM):
```bash
OPENROUTER_API_KEY=sk-your-openrouter-api-key
```

**Eden AI** (optional, if using Eden AI for STT/TTS):
```bash
EDENAI_API_KEY=your-edenai-api-key
```

**Anthropic Claude** (optional, if using Anthropic):
```bash
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Google Gemini** (optional, if using Google Gemini):
```bash
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_PROJECT_ID=your-google-project-id
```

---

## 📞 SignalWire Configuration (for outbound calls)

```bash
# SignalWire credentials (required for outbound calls)
SIGNALWIRE_PROJECT_ID=your-project-id
SIGNALWIRE_TOKEN=your-api-token
SIGNALWIRE_SPACE=your-space.signalwire.com
```

---

## 🎙️ Recording Configuration (LiveKit Egress)

```bash
# AWS S3 credentials for storing recordings (required for recording)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_BUCKET_NAME=your-bucket-name
AWS_REGION=us-east-1
```

---

## 📅 Business Logic Services

### Nylas (Calendar Integration)
```bash
# Nylas API key for calendar operations (optional, if using calendar tools)
NYLAS_API_KEY=your-nylas-api-key
```

### Google Vertex AI (Knowledge Base Search)
```bash
# Google Vertex AI for embeddings (optional, if using knowledge search)
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_PROJECT_ID=your-google-project-id
```

---

## ⚙️ API Server Configuration

```bash
# API server configuration (for outbound calls and recording URLs)
API_SERVER_PORT=8080
API_SERVER_HOST=0.0.0.0
API_BASE_URL=https://your-api-domain.com  # Public URL for SWML webhooks
```

---

## 🔧 Optional Configuration

### Provider Fallbacks
```bash
# Global fallback providers (used if per-number fallback not set)
DEFAULT_FALLBACK_STT_PROVIDER=openai
DEFAULT_FALLBACK_TTS_PROVIDER=openai_tts
DEFAULT_FALLBACK_LLM_PROVIDER=openai
```

### Pricing Override
```bash
# Optional: Override default pricing map with custom JSON
PRICING_JSON={"deepgram":{"nova-2":0.0043},...}
```

---

## 📋 Quick Setup Checklist

1. ✅ **Required**: Set LiveKit credentials (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)
2. ✅ **Required**: Set Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)
3. ✅ **Required**: Set OpenAI API key (`OPENAI_API_KEY`)
4. ✅ **Required for outbound**: Set SignalWire credentials
5. ✅ **Required for recording**: Set AWS S3 credentials
6. ✅ **Optional**: Set provider-specific API keys based on your configuration
7. ✅ **Optional**: Set business service keys (Nylas, Google Vertex AI)

---

## 🔍 Environment Variable Sources

- **Local Development**: Create a `.env` file in `livekit-agent/` directory
- **Fly.io Deployment**: Set via `fly secrets set KEY=value`
- **Docker**: Pass via `-e KEY=value` or `.env` file
- **Kubernetes**: Use ConfigMaps or Secrets

---

## 📝 Example `.env` File

```bash
# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# SignalWire (for outbound)
SIGNALWIRE_PROJECT_ID=your-project-id
SIGNALWIRE_TOKEN=your-token
SIGNALWIRE_SPACE=your-space.signalwire.com

# AWS S3 (for recordings)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BUCKET_NAME=your-bucket-name
AWS_REGION=us-east-1

# Providers (set based on your configuration)
DEEPGRAM_API_KEY=your-deepgram-key
ELEVENLABS_API_KEY=your-elevenlabs-key
EDENAI_API_KEY=your-edenai-key

# Business Services
NYLAS_API_KEY=your-nylas-key
GOOGLE_PROJECT_ID=your-google-project-id
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# API Server
API_BASE_URL=https://your-api-domain.com
```

---

## 🚨 Security Notes

- **Never commit** `.env` files to version control
- Use **service role keys** for Supabase (not anon keys)
- Store sensitive credentials in **environment variables** or **secret management systems**
- Rotate API keys regularly
- Use **least privilege** IAM policies for AWS credentials

---

## 📚 Related Documentation

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [Supabase Environment Variables](https://supabase.com/docs/guides/api)
- [SignalWire API Documentation](https://developer.signalwire.com/)
- [LiveKit Egress Documentation](https://docs.livekit.io/agents/ops/recording/)

