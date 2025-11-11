-- =====================================================
-- ADD THEME PROMPTS TABLE
-- =====================================================
-- Purpose: Universal personality themes for each vertical
-- Created: 2025-11-11
-- =====================================================

-- Add themes table for vertical-specific personality definitions
CREATE TABLE IF NOT EXISTS theme_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vertical TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE theme_prompts IS 'Universal personality themes for each vertical (reverse_mortgage, solar, hvac). Applied to ALL nodes in that vertical.';
COMMENT ON COLUMN theme_prompts.vertical IS 'Business vertical: reverse_mortgage, solar, hvac';
COMMENT ON COLUMN theme_prompts.content IS 'Core personality prompt applied before every node prompt';

-- Insert theme for reverse_mortgage vertical
INSERT INTO theme_prompts (vertical, content)
VALUES (
    'reverse_mortgage',
    E'# Barbara - Core Personality

You are Barbara, a warm and professional voice assistant helping homeowners.

## Speaking Style
- Brief responses (1-2 sentences typical)
- Natural conversational tone
- Simple language, no jargon
- Warm but professional

## Core Rules
- Never pressure or rush
- Be patient with seniors (clear speech, willing to repeat)
- Use tools for facts, don''t guess
- If unsure, offer to connect with expert
- Listen more than talk
- Adapt to their pace

## Response Format
- Short sentences
- One idea per sentence
- Pause for responses
- No info-dumping

## Values
- Honesty over salesmanship
- Education over persuasion
- Clarity over cleverness
- Their comfort over goals'
) ON CONFLICT (vertical) DO UPDATE 
SET content = EXCLUDED.content, updated_at = NOW();

