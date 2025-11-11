-- Migration: Add llm_base_url for OpenRouter support in LangGraph
-- Date: November 10, 2025
-- Purpose: Enable OpenRouter as primary LLM provider for LangGraph ChatOpenAI
-- Context: LangGraph uses LangChain ChatOpenAI, not LiveKit LLM plugins

-- Add llm_base_url column for custom API endpoints (OpenRouter, Azure, etc.)
ALTER TABLE ai_templates 
ADD COLUMN IF NOT EXISTS llm_base_url TEXT;

-- Add comment explaining the LangGraph architecture
COMMENT ON COLUMN ai_templates.llm_base_url IS 'API base URL for LangChain ChatOpenAI. OpenRouter: https://openrouter.ai/api/v1, OpenAI: null (default), Azure: custom';

-- Update llm_provider constraint to include 'openrouter'
ALTER TABLE ai_templates
DROP CONSTRAINT IF EXISTS ai_templates_llm_provider_check;

ALTER TABLE ai_templates
ADD CONSTRAINT ai_templates_llm_provider_check 
CHECK (llm_provider IN ('openai', 'openrouter', 'anthropic', 'google', 'azure'));

-- Update existing templates to use OpenRouter (except gpt-realtime)
UPDATE ai_templates 
SET 
    llm_provider = 'openrouter',
    llm_base_url = 'https://openrouter.ai/api/v1'
WHERE llm_model != 'gpt-realtime' AND llm_model NOT LIKE '%realtime%';

-- Set OpenAI direct for any gpt-realtime templates (all-in-one mode)
UPDATE ai_templates 
SET 
    llm_provider = 'openai',
    llm_base_url = NULL
WHERE llm_model = 'gpt-realtime' OR llm_model LIKE '%realtime%';

-- Notes:
-- 1. LangGraph uses LangChain's ChatOpenAI, not LiveKit's openai plugin
-- 2. ChatOpenAI supports any OpenAI-compatible API via base_url parameter
-- 3. OpenRouter provides access to 100+ models (GPT, Claude, Gemini, DeepSeek, etc.)
-- 4. Use 'openrouter' + base_url for maximum flexibility
-- 5. Only use 'openai' + null base_url for gpt-realtime (all-in-one STT+LLM+TTS)

