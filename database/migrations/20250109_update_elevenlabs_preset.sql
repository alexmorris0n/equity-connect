-- Update ElevenLabs Best Quality preset to use GPT-5 and Tiffany voice
UPDATE ai_templates
SET 
  llm_model = 'openai/gpt-5',
  tts_voice_id = '6aDn1KB0hjpdcocrUkmq',
  description = 'Premium voice quality with ElevenLabs Turbo v2.5 + Tiffany voice + GPT-5. Best for important leads and conversions.',
  updated_at = NOW()
WHERE 
  name = 'ElevenLabs Best Quality'
  AND is_system_default = TRUE
  AND is_preset = TRUE;

