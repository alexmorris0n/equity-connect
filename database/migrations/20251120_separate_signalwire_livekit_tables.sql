-- Separate SignalWire and LiveKit Tables
-- This migration renames existing tables to livekit_* and creates fresh signalwire_* tables

-- ============================================================================
-- STEP 1: Rename existing signalwire_* tables to livekit_*
-- ============================================================================

ALTER TABLE signalwire_available_llm_models RENAME TO livekit_available_llm_models;
ALTER TABLE signalwire_available_stt_models RENAME TO livekit_available_stt_models;
ALTER TABLE signalwire_available_voices RENAME TO livekit_available_voices;

-- ============================================================================
-- STEP 2: Create livekit_available_realtime_models table
-- ============================================================================

CREATE TABLE IF NOT EXISTS livekit_available_realtime_models (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_id_full TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    notes TEXT,
    requires_api_key BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, model_name)
);

-- Add is_active column with unique constraint to ensure only one realtime model active
ALTER TABLE livekit_available_realtime_models ADD COLUMN is_active BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX idx_livekit_realtime_one_active 
ON livekit_available_realtime_models (is_active) 
WHERE is_active = TRUE;

-- ============================================================================
-- STEP 3: Move realtime models to new table and remove others
-- ============================================================================

-- Insert gpt-4o-realtime-preview and gemini-2.0-flash-exp
INSERT INTO livekit_available_realtime_models (provider, model_name, model_id_full, display_name, is_available, notes, requires_api_key)
SELECT provider, model_name, model_id_full, display_name, is_available, notes, TRUE
FROM livekit_available_llm_models
WHERE model_id_full IN ('openai-realtime/gpt-4o-realtime-preview', 'google-realtime/gemini-2.0-flash-exp')
ON CONFLICT (model_id_full) DO NOTHING;

-- Remove ALL realtime models from livekit_available_llm_models
DELETE FROM livekit_available_llm_models WHERE notes LIKE '%Realtime%' OR notes LIKE '%Plugin%';

-- ============================================================================
-- STEP 4: Create fresh SignalWire tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS signalwire_available_llm_models (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_id_full TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    context_window INTEGER,
    is_available BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE,
    UNIQUE(provider, model_name)
);

CREATE TABLE IF NOT EXISTS signalwire_available_stt_models (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_id_full TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    language_codes TEXT[],
    is_available BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE,
    UNIQUE(provider, model_name)
);

CREATE TABLE IF NOT EXISTS signalwire_available_voices (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    voice_id_full TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    gender TEXT,
    language_codes TEXT[],
    model TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT FALSE,
    UNIQUE(provider, voice_id_full)
);

-- Unique constraints for is_active (only one active per type)
CREATE UNIQUE INDEX idx_signalwire_llm_one_active 
ON signalwire_available_llm_models (is_active) 
WHERE is_active = TRUE;

CREATE UNIQUE INDEX idx_signalwire_stt_one_active 
ON signalwire_available_stt_models (is_active) 
WHERE is_active = TRUE;

CREATE UNIQUE INDEX idx_signalwire_voices_one_active 
ON signalwire_available_voices (is_active) 
WHERE is_active = TRUE;

-- ============================================================================
-- STEP 5: Seed SignalWire tables from SignalWire docs
-- ============================================================================

-- SignalWire LLM Models (from ai.params docs)
INSERT INTO signalwire_available_llm_models (provider, model_name, model_id_full, display_name, is_available, notes) VALUES
('openai', 'gpt-4o-mini', 'gpt-4o-mini', 'GPT-4o mini', true, 'SignalWire Inference - Default'),
('openai', 'gpt-4.1-mini', 'gpt-4.1-mini', 'GPT-4.1 mini', true, 'SignalWire Inference'),
('openai', 'gpt-4.1-nano', 'gpt-4.1-nano', 'GPT-4.1 nano', true, 'SignalWire Inference')
ON CONFLICT (model_id_full) DO NOTHING;

-- SignalWire STT Models (from ai.params docs)
INSERT INTO signalwire_available_stt_models (provider, model_name, model_id_full, display_name, language_codes, is_available, notes) VALUES
('deepgram', 'nova-2', 'deepgram:nova-2', 'Deepgram Nova-2', ARRAY['en'], true, 'SignalWire Inference'),
('deepgram', 'nova-3', 'deepgram:nova-3', 'Deepgram Nova-3 (Default)', ARRAY['en'], true, 'SignalWire Inference - Default'),
('deepgram', 'nova-2-medical', 'deepgram:nova-2-medical', 'Deepgram Nova-2 Medical', ARRAY['en'], true, 'SignalWire Inference')
ON CONFLICT (model_id_full) DO NOTHING;

-- SignalWire TTS Voices - US English only for Amazon Polly
-- Amazon Polly Neural voices (US English)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('amazon', 'Danielle', 'Danielle', 'amazon.Danielle:neural:en-US', 'Danielle (Neural, Female)', 'female', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Gregory', 'Gregory', 'amazon.Gregory:neural:en-US', 'Gregory (Neural, Male)', 'male', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Ivy', 'Ivy', 'amazon.Ivy:neural:en-US', 'Ivy (Neural, Child Female)', 'female', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Joanna', 'Joanna', 'amazon.Joanna:neural:en-US', 'Joanna (Neural, Female)', 'female', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Kendra', 'Kendra', 'amazon.Kendra:neural:en-US', 'Kendra (Neural, Female)', 'female', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Kimberly', 'Kimberly', 'amazon.Kimberly:neural:en-US', 'Kimberly (Neural, Female)', 'female', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Salli', 'Salli', 'amazon.Salli:neural:en-US', 'Salli (Neural, Female)', 'female', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Joey', 'Joey', 'amazon.Joey:neural:en-US', 'Joey (Neural, Male)', 'male', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Justin', 'Justin', 'amazon.Justin:neural:en-US', 'Justin (Neural, Child Male)', 'male', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Kevin', 'Kevin', 'amazon.Kevin:neural:en-US', 'Kevin (Neural, Child Male)', 'male', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Matthew', 'Matthew', 'amazon.Matthew:neural:en-US', 'Matthew (Neural, Male)', 'male', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Ruth', 'Ruth', 'amazon.Ruth:neural:en-US', 'Ruth (Neural, Female)', 'female', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural'),
('amazon', 'Stephen', 'Stephen', 'amazon.Stephen:neural:en-US', 'Stephen (Neural, Male)', 'male', ARRAY['en-US'], 'neural', true, 'Amazon Polly Neural')
ON CONFLICT (voice_id_full) DO NOTHING;

-- Amazon Polly Standard voices (US English)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('amazon', 'Ivy', 'Ivy', 'amazon.Ivy:standard:en-US', 'Ivy (Standard, Female)', 'female', ARRAY['en-US'], 'standard', true, 'Amazon Polly Standard'),
('amazon', 'Joanna', 'Joanna', 'amazon.Joanna:standard:en-US', 'Joanna (Standard, Female)', 'female', ARRAY['en-US'], 'standard', true, 'Amazon Polly Standard'),
('amazon', 'Kendra', 'Kendra', 'amazon.Kendra:standard:en-US', 'Kendra (Standard, Female)', 'female', ARRAY['en-US'], 'standard', true, 'Amazon Polly Standard'),
('amazon', 'Kimberly', 'Kimberly', 'amazon.Kimberly:standard:en-US', 'Kimberly (Standard, Female)', 'female', ARRAY['en-US'], 'standard', true, 'Amazon Polly Standard'),
('amazon', 'Salli', 'Salli', 'amazon.Salli:standard:en-US', 'Salli (Standard, Female)', 'female', ARRAY['en-US'], 'standard', true, 'Amazon Polly Standard'),
('amazon', 'Joey', 'Joey', 'amazon.Joey:standard:en-US', 'Joey (Standard, Male)', 'male', ARRAY['en-US'], 'standard', true, 'Amazon Polly Standard'),
('amazon', 'Kevin', 'Kevin', 'amazon.Kevin:standard:en-US', 'Kevin (Standard, Male)', 'male', ARRAY['en-US'], 'standard', true, 'Amazon Polly Standard')
ON CONFLICT (voice_id_full) DO NOTHING;

-- Amazon Polly Generative voices (US English)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('amazon', 'Danielle', 'Danielle', 'amazon.Danielle:generative:en-US', 'Danielle (Generative, Female)', 'female', ARRAY['en-US'], 'generative', true, 'Amazon Polly Generative'),
('amazon', 'Joanna', 'Joanna', 'amazon.Joanna:generative:en-US', 'Joanna (Generative, Female)', 'female', ARRAY['en-US'], 'generative', true, 'Amazon Polly Generative'),
('amazon', 'Matthew', 'Matthew', 'amazon.Matthew:generative:en-US', 'Matthew (Generative, Male)', 'male', ARRAY['en-US'], 'generative', true, 'Amazon Polly Generative'),
('amazon', 'Ruth', 'Ruth', 'amazon.Ruth:generative:en-US', 'Ruth (Generative, Female)', 'female', ARRAY['en-US'], 'generative', true, 'Amazon Polly Generative'),
('amazon', 'Salli', 'Salli', 'amazon.Salli:generative:en-US', 'Salli (Generative, Female)', 'female', ARRAY['en-US'], 'generative', true, 'Amazon Polly Generative'),
('amazon', 'Stephen', 'Stephen', 'amazon.Stephen:generative:en-US', 'Stephen (Generative, Male)', 'male', ARRAY['en-US'], 'generative', true, 'Amazon Polly Generative')
ON CONFLICT (voice_id_full) DO NOTHING;

-- Google Cloud Neural2 voices (US English)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('gcloud', 'en-US-Neural2-A', 'en-US-Neural2-A', 'gcloud.en-US-Neural2-A', 'Neural2-A (Female)', 'female', ARRAY['en-US'], 'neural2', true, 'Google Cloud Neural2'),
('gcloud', 'en-US-Neural2-C', 'en-US-Neural2-C', 'gcloud.en-US-Neural2-C', 'Neural2-C (Female)', 'female', ARRAY['en-US'], 'neural2', true, 'Google Cloud Neural2'),
('gcloud', 'en-US-Neural2-E', 'en-US-Neural2-E', 'gcloud.en-US-Neural2-E', 'Neural2-E (Female)', 'female', ARRAY['en-US'], 'neural2', true, 'Google Cloud Neural2'),
('gcloud', 'en-US-Neural2-F', 'en-US-Neural2-F', 'gcloud.en-US-Neural2-F', 'Neural2-F (Female)', 'female', ARRAY['en-US'], 'neural2', true, 'Google Cloud Neural2'),
('gcloud', 'en-US-Neural2-D', 'en-US-Neural2-D', 'gcloud.en-US-Neural2-D', 'Neural2-D (Male)', 'male', ARRAY['en-US'], 'neural2', true, 'Google Cloud Neural2'),
('gcloud', 'en-US-Neural2-I', 'en-US-Neural2-I', 'gcloud.en-US-Neural2-I', 'Neural2-I (Male)', 'male', ARRAY['en-US'], 'neural2', true, 'Google Cloud Neural2'),
('gcloud', 'en-US-Neural2-J', 'en-US-Neural2-J', 'gcloud.en-US-Neural2-J', 'Neural2-J (Male)', 'male', ARRAY['en-US'], 'neural2', true, 'Google Cloud Neural2')
ON CONFLICT (voice_id_full) DO NOTHING;

-- Google Cloud Standard voices (US English)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('gcloud', 'en-US-Standard-A', 'en-US-Standard-A', 'gcloud.en-US-Standard-A', 'Standard-A (Male)', 'male', ARRAY['en-US'], 'standard', true, 'Google Cloud Standard'),
('gcloud', 'en-US-Standard-B', 'en-US-Standard-B', 'gcloud.en-US-Standard-B', 'Standard-B (Male)', 'male', ARRAY['en-US'], 'standard', true, 'Google Cloud Standard'),
('gcloud', 'en-US-Standard-C', 'en-US-Standard-C', 'gcloud.en-US-Standard-C', 'Standard-C (Female)', 'female', ARRAY['en-US'], 'standard', true, 'Google Cloud Standard'),
('gcloud', 'en-US-Standard-D', 'en-US-Standard-D', 'gcloud.en-US-Standard-D', 'Standard-D (Male)', 'male', ARRAY['en-US'], 'standard', true, 'Google Cloud Standard'),
('gcloud', 'en-US-Standard-E', 'en-US-Standard-E', 'gcloud.en-US-Standard-E', 'Standard-E (Female)', 'female', ARRAY['en-US'], 'standard', true, 'Google Cloud Standard'),
('gcloud', 'en-US-Standard-F', 'en-US-Standard-F', 'gcloud.en-US-Standard-F', 'Standard-F (Female)', 'female', ARRAY['en-US'], 'standard', true, 'Google Cloud Standard')
ON CONFLICT (voice_id_full) DO NOTHING;

-- ElevenLabs voices (from SignalWire docs)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('elevenlabs', 'rachel', 'rachel', 'elevenlabs.rachel', 'Rachel', 'female', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'clyde', 'clyde', 'elevenlabs.clyde', 'Clyde', 'male', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'domi', 'domi', 'elevenlabs.domi', 'Domi', 'female', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'antoni', 'antoni', 'elevenlabs.antoni', 'Antoni', 'male', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'thomas', 'thomas', 'elevenlabs.thomas', 'Thomas', 'male', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'charlie', 'charlie', 'elevenlabs.charlie', 'Charlie', 'male', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'emily', 'emily', 'elevenlabs.emily', 'Emily', 'female', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'elli', 'elli', 'elevenlabs.elli', 'Elli', 'female', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'josh', 'josh', 'elevenlabs.josh', 'Josh', 'male', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'arnold', 'arnold', 'elevenlabs.arnold', 'Arnold', 'male', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'adam', 'adam', 'elevenlabs.adam', 'Adam', 'male', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2'),
('elevenlabs', 'sam', 'sam', 'elevenlabs.sam', 'Sam', 'male', ARRAY['en-US'], 'multilingual_v2', true, 'ElevenLabs Multilingual v2')
ON CONFLICT (voice_id_full) DO NOTHING;

-- OpenAI voices (from SignalWire docs)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('openai', 'alloy', 'alloy', 'openai.alloy', 'Alloy', 'neutral', ARRAY['en-US'], 'tts-1', true, 'OpenAI TTS'),
('openai', 'echo', 'echo', 'openai.echo', 'Echo', 'male', ARRAY['en-US'], 'tts-1', true, 'OpenAI TTS'),
('openai', 'fable', 'fable', 'openai.fable', 'Fable', 'male', ARRAY['en-US'], 'tts-1', true, 'OpenAI TTS'),
('openai', 'onyx', 'onyx', 'openai.onyx', 'Onyx', 'male', ARRAY['en-US'], 'tts-1', true, 'OpenAI TTS'),
('openai', 'nova', 'nova', 'openai.nova', 'Nova', 'female', ARRAY['en-US'], 'tts-1', true, 'OpenAI TTS'),
('openai', 'shimmer', 'shimmer', 'openai.shimmer', 'Shimmer', 'female', ARRAY['en-US'], 'tts-1', true, 'OpenAI TTS')
ON CONFLICT (voice_id_full) DO NOTHING;

-- Cartesia voices (from SignalWire docs)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('cartesia', 'Customer Support Man', 'a167e0f3-df7e-4d52-a9c3-f949145efdab', 'cartesia.a167e0f3-df7e-4d52-a9c3-f949145efdab', 'Customer Support Man', 'male', ARRAY['en-US'], 'sonic', true, 'Cartesia Sonic')
ON CONFLICT (voice_id_full) DO NOTHING;

-- Rime voices (from SignalWire docs)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('rime', 'luna', 'luna', 'rime.luna:arcana', 'Luna (Arcana)', 'female', ARRAY['en-US'], 'arcana', true, 'Rime Arcana')
ON CONFLICT (voice_id_full) DO NOTHING;

-- Deepgram voices (from SignalWire docs)
INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, gender, language_codes, model, is_available, notes) VALUES
('deepgram', 'aura-asteria-en', 'aura-asteria-en', 'deepgram.aura-asteria-en', 'Aura Asteria', 'female', ARRAY['en-US'], 'aura', true, 'Deepgram Aura')
ON CONFLICT (voice_id_full) DO NOTHING;



