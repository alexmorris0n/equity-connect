-- Migration: Add LiveKit Inference provider support
-- Description: Add support for DeepSeek, Qwen, Kimi LLMs and update existing templates
-- Date: 2025-11-11

-- Update the llm_provider check constraint to include new providers
ALTER TABLE ai_templates DROP CONSTRAINT IF EXISTS ai_templates_llm_provider_check;

ALTER TABLE ai_templates ADD CONSTRAINT ai_templates_llm_provider_check 
CHECK (llm_provider IN (
    'openai', 
    'openrouter', 
    'anthropic', 
    'google',
    'deepseek',
    'qwen',
    'kimi'
));

-- Update the stt_provider check constraint to include Cartesia
ALTER TABLE ai_templates DROP CONSTRAINT IF EXISTS ai_templates_stt_provider_check;

ALTER TABLE ai_templates ADD CONSTRAINT ai_templates_stt_provider_check 
CHECK (stt_provider IN (
    'deepgram', 
    'assemblyai', 
    'openai',
    'google',
    'cartesia'
));

-- Update the tts_provider check constraint to include Cartesia, Inworld, Rime
ALTER TABLE ai_templates DROP CONSTRAINT IF EXISTS ai_templates_tts_provider_check;

ALTER TABLE ai_templates ADD CONSTRAINT ai_templates_tts_provider_check 
CHECK (tts_provider IN (
    'elevenlabs', 
    'openai', 
    'google',
    'speechify',
    'cartesia',
    'inworld',
    'rime'
));

-- Add comment documenting LiveKit Inference migration
COMMENT ON TABLE ai_templates IS 'AI agent configuration templates. All providers now route through LiveKit Inference for unified billing and lower latency. Format: STT="provider/model:language", LLM="provider/model", TTS="provider/model:voice_id"';

