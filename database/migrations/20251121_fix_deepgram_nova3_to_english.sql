-- Fix Deepgram Nova-3 to use English instead of multilingual
-- LiveKit Inference has a bug where it doesn't pass detected language from multilingual mode
-- to the turn detector, causing "Turn detector does not support language multi" errors

-- Update livekit_available_stt_models active record to use :en
UPDATE livekit_available_stt_models
SET model_id_full = 'deepgram/nova-3:en'
WHERE provider = 'deepgram' 
  AND model_name = 'nova-3' 
  AND model_id_full = 'deepgram/nova-3:multi';

-- Also update the seed data for signalwire_available_stt_models (used for portal display)
UPDATE signalwire_available_stt_models
SET model_id_full = 'deepgram/nova-3:en'
WHERE provider = 'deepgram' 
  AND model_name = 'nova-3' 
  AND model_id_full = 'deepgram/nova-3:multi';

-- Note: When LiveKit fixes this bug, we can revert to :multi for true multilingual support

