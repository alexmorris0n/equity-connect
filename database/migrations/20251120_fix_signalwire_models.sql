-- ============================================================================
-- Fix SignalWire Models
-- ============================================================================
-- 1. Remove deepgram:nova-2-medical (not explicitly listed in docs)
-- 2. Add Microsoft Azure US English voices (missing from database)

-- ============================================================================
-- STEP 1: Remove deepgram:nova-2-medical from STT models
-- ============================================================================

DELETE FROM signalwire_available_stt_models
WHERE model_id_full = 'deepgram:nova-2-medical';

-- ============================================================================
-- STEP 2: Add Microsoft Azure US English voices
-- ============================================================================
-- Azure voices use format: azure.en-US-VoiceNameNeural
-- From SignalWire docs, US English voices include:

INSERT INTO signalwire_available_voices (provider, voice_name, voice_id, voice_id_full, display_name, language_codes, is_available, is_active)
VALUES
  -- Azure US English Neural voices
  ('azure', 'Ava', 'AvaNeural', 'azure.en-US-AvaNeural', 'Ava (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Andrew', 'AndrewNeural', 'azure.en-US-AndrewNeural', 'Andrew (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Emma', 'EmmaNeural', 'azure.en-US-EmmaNeural', 'Emma (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Brian', 'BrianNeural', 'azure.en-US-BrianNeural', 'Brian (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Jenny', 'JennyNeural', 'azure.en-US-JennyNeural', 'Jenny (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Guy', 'GuyNeural', 'azure.en-US-GuyNeural', 'Guy (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Aria', 'AriaNeural', 'azure.en-US-AriaNeural', 'Aria (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Davis', 'DavisNeural', 'azure.en-US-DavisNeural', 'Davis (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Jane', 'JaneNeural', 'azure.en-US-JaneNeural', 'Jane (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Jason', 'JasonNeural', 'azure.en-US-JasonNeural', 'Jason (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Kai', 'KaiNeural', 'azure.en-US-KaiNeural', 'Kai (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Luna', 'LunaNeural', 'azure.en-US-LunaNeural', 'Luna (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Sara', 'SaraNeural', 'azure.en-US-SaraNeural', 'Sara (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Tony', 'TonyNeural', 'azure.en-US-TonyNeural', 'Tony (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Nancy', 'NancyNeural', 'azure.en-US-NancyNeural', 'Nancy (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Amber', 'AmberNeural', 'azure.en-US-AmberNeural', 'Amber (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Ana', 'AnaNeural', 'azure.en-US-AnaNeural', 'Ana (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Ashley', 'AshleyNeural', 'azure.en-US-AshleyNeural', 'Ashley (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Brandon', 'BrandonNeural', 'azure.en-US-BrandonNeural', 'Brandon (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Christopher', 'ChristopherNeural', 'azure.en-US-ChristopherNeural', 'Christopher (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Cora', 'CoraNeural', 'azure.en-US-CoraNeural', 'Cora (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Elizabeth', 'ElizabethNeural', 'azure.en-US-ElizabethNeural', 'Elizabeth (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Eric', 'EricNeural', 'azure.en-US-EricNeural', 'Eric (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Jacob', 'JacobNeural', 'azure.en-US-JacobNeural', 'Jacob (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Michelle', 'MichelleNeural', 'azure.en-US-MichelleNeural', 'Michelle (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Monica', 'MonicaNeural', 'azure.en-US-MonicaNeural', 'Monica (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Roger', 'RogerNeural', 'azure.en-US-RogerNeural', 'Roger (Neural)', ARRAY['en-US'], true, false),
  ('azure', 'Steffan', 'SteffanNeural', 'azure.en-US-SteffanNeural', 'Steffan (Neural)', ARRAY['en-US'], true, false),
  -- Azure US English Multilingual voices
  ('azure', 'Ava Multilingual', 'AvaMultilingualNeural', 'azure.en-US-AvaMultilingualNeural', 'Ava (Multilingual)', ARRAY['en-US'], true, false),
  ('azure', 'Andrew Multilingual', 'AndrewMultilingualNeural', 'azure.en-US-AndrewMultilingualNeural', 'Andrew (Multilingual)', ARRAY['en-US'], true, false),
  ('azure', 'Emma Multilingual', 'EmmaMultilingualNeural', 'azure.en-US-EmmaMultilingualNeural', 'Emma (Multilingual)', ARRAY['en-US'], true, false),
  ('azure', 'Brian Multilingual', 'BrianMultilingualNeural', 'azure.en-US-BrianMultilingualNeural', 'Brian (Multilingual)', ARRAY['en-US'], true, false),
  ('azure', 'Cora Multilingual', 'CoraMultilingualNeural', 'azure.en-US-CoraMultilingualNeural', 'Cora (Multilingual)', ARRAY['en-US'], true, false),
  ('azure', 'Christopher Multilingual', 'ChristopherMultilingualNeural', 'azure.en-US-ChristopherMultilingualNeural', 'Christopher (Multilingual)', ARRAY['en-US'], true, false),
  ('azure', 'Brandon Multilingual', 'BrandonMultilingualNeural', 'azure.en-US-BrandonMultilingualNeural', 'Brandon (Multilingual)', ARRAY['en-US'], true, false),
  ('azure', 'Jenny Multilingual', 'JennyMultilingualNeural', 'azure.en-US-JennyMultilingualNeural', 'Jenny (Multilingual)', ARRAY['en-US'], true, false),
  ('azure', 'Ryan Multilingual', 'RyanMultilingualNeural', 'azure.en-US-RyanMultilingualNeural', 'Ryan (Multilingual)', ARRAY['en-US'], true, false)
ON CONFLICT (voice_id_full) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  stt_count INTEGER;
  azure_count INTEGER;
BEGIN
  -- Check STT models (should be 2: nova-2 and nova-3)
  SELECT COUNT(*) INTO stt_count 
  FROM signalwire_available_stt_models;
  
  IF stt_count != 2 THEN
    RAISE WARNING 'Expected 2 STT models, found %', stt_count;
  END IF;
  
  -- Check Azure voices (should have at least 37: 28 Neural + 9 Multilingual)
  SELECT COUNT(*) INTO azure_count 
  FROM signalwire_available_voices 
  WHERE provider = 'azure';
  
  IF azure_count < 37 THEN
    RAISE WARNING 'Expected at least 37 Azure voices, found %', azure_count;
  END IF;
  
  RAISE NOTICE 'SignalWire models fix complete: STT=% models, Azure=% voices', stt_count, azure_count;
END $$;

