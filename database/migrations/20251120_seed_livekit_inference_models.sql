-- Seed all LiveKit models (LLM, STT, TTS, Realtime)
-- This migration populates the database with all models available through LiveKit Inference
-- and popular realtime model plugins

-- ============================================================================
-- LLM MODELS (LiveKit Inference)
-- ============================================================================

-- OpenAI LLM Models
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes) VALUES
('openai', 'gpt-4o', 'openai/gpt-4o', 'GPT-4o', true, 'LiveKit Inference'),
('openai', 'gpt-4o-mini', 'openai/gpt-4o-mini', 'GPT-4o mini', true, 'LiveKit Inference'),
('openai', 'gpt-4.1', 'openai/gpt-4.1', 'GPT-4.1', true, 'LiveKit Inference'),
('openai', 'gpt-4.1-mini', 'openai/gpt-4.1-mini', 'GPT-4.1 mini', true, 'LiveKit Inference'),
('openai', 'gpt-4.1-nano', 'openai/gpt-4.1-nano', 'GPT-4.1 nano', true, 'LiveKit Inference'),
('openai', 'gpt-5', 'openai/gpt-5', 'GPT-5', true, 'LiveKit Inference'),
('openai', 'gpt-5-mini', 'openai/gpt-5-mini', 'GPT-5 mini', true, 'LiveKit Inference'),
('openai', 'gpt-5-nano', 'openai/gpt-5-nano', 'GPT-5 nano', true, 'LiveKit Inference'),
('openai', 'gpt-oss-120b', 'openai/gpt-oss-120b', 'GPT OSS 120B', true, 'LiveKit Inference')
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
is_available = EXCLUDED.is_available,
notes = EXCLUDED.notes;

-- Google Gemini LLM Models
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes) VALUES
('google', 'gemini-2.5-pro', 'google/gemini-2.5-pro', 'Gemini 2.5 Pro', true, 'LiveKit Inference'),
('google', 'gemini-2.5-flash', 'google/gemini-2.5-flash', 'Gemini 2.5 Flash', true, 'LiveKit Inference'),
('google', 'gemini-2.5-flash-lite', 'google/gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', true, 'LiveKit Inference'),
('google', 'gemini-2.0-flash', 'google/gemini-2.0-flash', 'Gemini 2.0 Flash', true, 'LiveKit Inference'),
('google', 'gemini-2.0-flash-lite', 'google/gemini-2.0-flash-lite', 'Gemini 2.0 Flash Lite', true, 'LiveKit Inference')
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
is_available = EXCLUDED.is_available,
notes = EXCLUDED.notes;

-- Other LLM Models
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes) VALUES
('qwen', 'qwen3-235b-a22b-instruct', 'qwen/qwen3-235b-a22b-instruct', 'Qwen3 235B A22B Instruct', true, 'LiveKit Inference'),
('moonshotai', 'kimi-k2-instruct', 'moonshotai/kimi-k2-instruct', 'Kimi K2 Instruct', true, 'LiveKit Inference'),
('deepseek-ai', 'deepseek-v3', 'deepseek-ai/deepseek-v3', 'DeepSeek V3', true, 'LiveKit Inference')
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
is_available = EXCLUDED.is_available,
notes = EXCLUDED.notes;

-- ============================================================================
-- REALTIME MODELS (Plugins - require own API keys)
-- ============================================================================

-- OpenAI Realtime API
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes) VALUES
('openai-realtime', 'gpt-4o-realtime-preview', 'openai-realtime/gpt-4o-realtime-preview', 'GPT-4o Realtime (Preview)', true, 'Realtime Plugin - Requires OpenAI API key'),
('openai-realtime', 'gpt-4o-mini-realtime-preview', 'openai-realtime/gpt-4o-mini-realtime-preview', 'GPT-4o mini Realtime (Preview)', true, 'Realtime Plugin - Requires OpenAI API key')
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
is_available = EXCLUDED.is_available,
notes = EXCLUDED.notes;

-- Azure OpenAI Realtime API
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes) VALUES
('azure-openai-realtime', 'gpt-4o-realtime-preview', 'azure-openai-realtime/gpt-4o-realtime-preview', 'Azure GPT-4o Realtime (Preview)', true, 'Realtime Plugin - Requires Azure OpenAI key')
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
is_available = EXCLUDED.is_available,
notes = EXCLUDED.notes;

-- Gemini Live API
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes) VALUES
('google-realtime', 'gemini-2.0-flash-exp', 'google-realtime/gemini-2.0-flash-exp', 'Gemini 2.0 Flash Live (Experimental)', true, 'Realtime Plugin - Requires Google API key'),
('google-realtime', 'gemini-2.5-flash-native-audio-preview', 'google-realtime/gemini-2.5-flash-native-audio-preview', 'Gemini 2.5 Flash Live Audio (Preview)', true, 'Realtime Plugin - Requires Google API key')
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
is_available = EXCLUDED.is_available,
notes = EXCLUDED.notes;

-- Amazon Nova Sonic
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes) VALUES
('aws-realtime', 'nova-sonic-v1', 'aws-realtime/nova-sonic-v1', 'Amazon Nova Sonic', true, 'Realtime Plugin - Requires AWS credentials')
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
is_available = EXCLUDED.is_available,
notes = EXCLUDED.notes;

-- Ultravox Realtime API
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes) VALUES
('ultravox-realtime', 'ultravox-v0.2', 'ultravox-realtime/ultravox-v0.2', 'Ultravox v0.2', true, 'Realtime Plugin - Requires Ultravox API key')
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
is_available = EXCLUDED.is_available,
notes = EXCLUDED.notes;

-- ============================================================================
-- STT MODELS
-- ============================================================================

-- AssemblyAI STT Models
INSERT INTO signalwire_available_stt_models (provider, model_name, model_id_full, display_name, language_codes, is_available) VALUES
('assemblyai', 'universal-streaming', 'assemblyai/universal-streaming:en', 'Universal-Streaming', ARRAY['en'], true)
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
language_codes = EXCLUDED.language_codes,
is_available = EXCLUDED.is_available;

-- Cartesia STT Models
INSERT INTO signalwire_available_stt_models (provider, model_name, model_id_full, display_name, language_codes, is_available) VALUES
('cartesia', 'ink-whisper', 'cartesia/ink-whisper:multi', 'Ink Whisper', ARRAY['en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl', 'ca', 'nl', 'ar', 'sv', 'it', 'id', 'vi', 'he', 'uk', 'el', 'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy', 'sk', 'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl', 'kn', 'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq', 'sw', 'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc', 'ka', 'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk', 'nn', 'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln', 'ha', 'ba', 'jw', 'su', 'yue'], true)
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
language_codes = EXCLUDED.language_codes,
is_available = EXCLUDED.is_available;

-- Deepgram STT Models
INSERT INTO signalwire_available_stt_models (provider, model_name, model_id_full, display_name, language_codes, is_available) VALUES
('deepgram', 'nova-3', 'deepgram/nova-3:multi', 'Nova-3', ARRAY['en', 'en-US', 'en-AU', 'en-GB', 'en-IN', 'en-NZ', 'de', 'nl', 'sv', 'da', 'es', 'fr', 'pt', 'multi'], true),
('deepgram', 'nova-3-medical', 'deepgram/nova-3-medical:en', 'Nova-3 Medical', ARRAY['en'], true),
('deepgram', 'nova-2', 'deepgram/nova-2:multi', 'Nova-2', ARRAY['multi', 'bg', 'ca', 'zh', 'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr', 'de', 'el', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'lv', 'lt', 'ms', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'es', 'sv', 'th', 'tr', 'uk', 'vi'], true),
('deepgram', 'nova-2-medical', 'deepgram/nova-2-medical:en', 'Nova-2 Medical', ARRAY['en'], true),
('deepgram', 'nova-2-conversationalai', 'deepgram/nova-2-conversationalai:en', 'Nova-2 Conversational AI', ARRAY['en'], true),
('deepgram', 'nova-2-phonecall', 'deepgram/nova-2-phonecall:en', 'Nova-2 Phonecall', ARRAY['en'], true)
ON CONFLICT (model_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model_name = EXCLUDED.model_name,
display_name = EXCLUDED.display_name,
language_codes = EXCLUDED.language_codes,
is_available = EXCLUDED.is_available;

-- ============================================================================
-- TTS VOICES
-- ============================================================================

-- Cartesia Voices
INSERT INTO signalwire_available_voices (provider, model, voice_id, voice_name, voice_id_full, display_name, language_codes, is_available, is_custom) VALUES
('cartesia', 'sonic-3', 'a167e0f3-df7e-4d52-a9c3-f949145efdab', 'Blake', 'cartesia/sonic-3:a167e0f3-df7e-4d52-a9c3-f949145efdab', 'Blake - Energetic American adult male', ARRAY['en-US'], true, false),
('cartesia', 'sonic-3', '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', 'Daniela', 'cartesia/sonic-3:5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', 'Daniela - Calm and trusting Mexican female', ARRAY['es-MX'], true, false),
('cartesia', 'sonic-3', '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', 'Jacqueline', 'cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', 'Jacqueline - Confident, young American adult female', ARRAY['en-US'], true, false),
('cartesia', 'sonic-3', 'f31cc6a7-c1e8-4764-980c-60a361443dd1', 'Robyn', 'cartesia/sonic-3:f31cc6a7-c1e8-4764-980c-60a361443dd1', 'Robyn - Neutral, mature Australian female', ARRAY['en-AU'], true, false)
ON CONFLICT (voice_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model = EXCLUDED.model,
voice_id = EXCLUDED.voice_id,
voice_name = EXCLUDED.voice_name,
display_name = EXCLUDED.display_name,
language_codes = EXCLUDED.language_codes,
is_available = EXCLUDED.is_available,
is_custom = EXCLUDED.is_custom;

-- ElevenLabs Voices (Standard - LiveKit Inference)
INSERT INTO signalwire_available_voices (provider, model, voice_id, voice_name, voice_id_full, display_name, language_codes, is_available, is_custom) VALUES
('elevenlabs', 'eleven_turbo_v2_5', 'Xb7hH8MSUJpSbSDYk0k2', 'Alice', 'elevenlabs/eleven_turbo_v2_5:Xb7hH8MSUJpSbSDYk0k2', 'Alice - Clear and engaging, friendly British woman', ARRAY['en-GB'], true, false),
('elevenlabs', 'eleven_turbo_v2_5', 'iP95p4xoKVk53GoZ742B', 'Chris', 'elevenlabs/eleven_turbo_v2_5:iP95p4xoKVk53GoZ742B', 'Chris - Natural and real American male', ARRAY['en-US'], true, false),
('elevenlabs', 'eleven_turbo_v2_5', 'cjVigY5qzO86Huf0OWal', 'Eric', 'elevenlabs/eleven_turbo_v2_5:cjVigY5qzO86Huf0OWal', 'Eric - A smooth tenor Mexican male', ARRAY['es-MX'], true, false),
('elevenlabs', 'eleven_turbo_v2_5', 'cgSgspJ2msm6clMCkdW9', 'Jessica', 'elevenlabs/eleven_turbo_v2_5:cgSgspJ2msm6clMCkdW9', 'Jessica - Young and popular, playful American female', ARRAY['en-US'], true, false),
('elevenlabs', 'eleven_turbo_v2_5', 'EXAVITQu4vr4xnSDxMaL', 'Tiffany', 'elevenlabs/eleven_turbo_v2_5:EXAVITQu4vr4xnSDxMaL', 'Tiffany - Professional American female', ARRAY['en-US'], true, false)
ON CONFLICT (voice_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model = EXCLUDED.model,
voice_id = EXCLUDED.voice_id,
voice_name = EXCLUDED.voice_name,
display_name = EXCLUDED.display_name,
language_codes = EXCLUDED.language_codes,
is_available = EXCLUDED.is_available,
is_custom = EXCLUDED.is_custom;

-- Rime Voices
INSERT INTO signalwire_available_voices (provider, model, voice_id, voice_name, voice_id_full, display_name, language_codes, is_available, is_custom) VALUES
('rime', 'arcana', 'astra', 'Astra', 'rime/arcana:astra', 'Astra - Chipper, upbeat American female', ARRAY['en-US'], true, false),
('rime', 'arcana', 'celeste', 'Celeste', 'rime/arcana:celeste', 'Celeste - Chill Gen-Z American female', ARRAY['en-US'], true, false),
('rime', 'arcana', 'luna', 'Luna', 'rime/arcana:luna', 'Luna - Chill but excitable American female', ARRAY['en-US'], true, false),
('rime', 'arcana', 'ursa', 'Ursa', 'rime/arcana:ursa', 'Ursa - Young, emo American male', ARRAY['en-US'], true, false)
ON CONFLICT (voice_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model = EXCLUDED.model,
voice_id = EXCLUDED.voice_id,
voice_name = EXCLUDED.voice_name,
display_name = EXCLUDED.display_name,
language_codes = EXCLUDED.language_codes,
is_available = EXCLUDED.is_available,
is_custom = EXCLUDED.is_custom;

-- Inworld Voices
INSERT INTO signalwire_available_voices (provider, model, voice_id, voice_name, voice_id_full, display_name, language_codes, is_available, is_custom) VALUES
('inworld', 'inworld-tts-1', 'Ashley', 'Ashley', 'inworld/inworld-tts-1:Ashley', 'Ashley - Warm, natural American female', ARRAY['en-US'], true, false),
('inworld', 'inworld-tts-1', 'Diego', 'Diego', 'inworld/inworld-tts-1:Diego', 'Diego - Soothing, gentle Mexican male', ARRAY['es-MX'], true, false),
('inworld', 'inworld-tts-1', 'Edward', 'Edward', 'inworld/inworld-tts-1:Edward', 'Edward - Fast-talking, emphatic American male', ARRAY['en-US'], true, false),
('inworld', 'inworld-tts-1', 'Olivia', 'Olivia', 'inworld/inworld-tts-1:Olivia', 'Olivia - Upbeat, friendly British female', ARRAY['en-GB'], true, false)
ON CONFLICT (voice_id_full) DO UPDATE SET
provider = EXCLUDED.provider,
model = EXCLUDED.model,
voice_id = EXCLUDED.voice_id,
voice_name = EXCLUDED.voice_name,
display_name = EXCLUDED.display_name,
language_codes = EXCLUDED.language_codes,
is_available = EXCLUDED.is_available,
is_custom = EXCLUDED.is_custom;
