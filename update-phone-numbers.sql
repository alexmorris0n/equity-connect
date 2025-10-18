-- Update signalwire_phone_numbers table with new VAPI phone number IDs
-- These are the new IDs we just created with the correct outbound credential

UPDATE signalwire_phone_numbers 
SET vapi_phone_number_id = '701f7d5d-7422-488a-bf61-3dcdfd731e72'
WHERE number = '+14244851544';

UPDATE signalwire_phone_numbers 
SET vapi_phone_number_id = 'd61688ef-4a28-4c88-837e-e768b9280e4c'
WHERE number = '+14245502888';

UPDATE signalwire_phone_numbers 
SET vapi_phone_number_id = 'd93c014d-fea4-4efc-ae4f-dd5d33cebc70'
WHERE number = '+14245502229';

UPDATE signalwire_phone_numbers 
SET vapi_phone_number_id = 'da4c29a7-a61c-44ad-9247-3ac01a16678e'
WHERE number = '+14245502223';

UPDATE signalwire_phone_numbers 
SET vapi_phone_number_id = 'f1e75c04-9e63-43eb-878f-a72f93b6698c'
WHERE number = '+14246724222';

-- Also update the credential ID
UPDATE signalwire_phone_numbers 
SET sip_trunk_credential_id = 'b446678e-0ce8-4e69-b66b-366ccda96608';

-- Verify the updates
SELECT vapi_phone_number_id, number, name, status, sip_trunk_credential_id 
FROM signalwire_phone_numbers 
ORDER BY number;
