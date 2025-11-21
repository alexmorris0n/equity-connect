-- Insert actual phone numbers with SignalWire SIDs
-- These numbers can be toggled between SignalWire (webhook) and LiveKit (SWML script) routing
-- 
-- IMPORTANT: Update broker_id values with actual broker UUIDs from auth.users table
-- To find broker UUIDs, run: SELECT id, email FROM auth.users WHERE role = 'broker';

-- For now, all numbers assigned to NULL (admin access only)
-- Update with actual broker UUIDs after running this migration

INSERT INTO phone_numbers (phone_number, signalwire_sid, label, current_route, vertical, broker_id) VALUES
    ('+12135795113', '26f000db-8e58-4978-88ed-50daddf3bc0c', 'MyReverseOptions1', 'signalwire', 'reverse_mortgage', NULL),
    ('+13232858383', 'd54a77ba-0fa6-4593-b2ce-ac1b26d9ff3f', 'MyReverseOptions2', 'signalwire', 'reverse_mortgage', NULL),
    ('+14245502888', '20bbeb2b-8964-4ff9-96d5-e6e86ec43331', 'MyReverseOptions3', 'signalwire', 'reverse_mortgage', NULL),
    ('+14245502223', 'b2297acf-ee32-4d2c-81a5-07fe9cd8e407', 'MyReverseOptions4', 'signalwire', 'reverse_mortgage', NULL),
    ('+14153225030', 'dad7123c-7eb4-4436-bd1d-028d0a0b4607', 'AboutReverse1', 'signalwire', 'reverse_mortgage', NULL),
    ('+16502632573', 'cc2294fd-2256-42a3-a6f9-0f8bb416ebc4', 'AboutReverse2', 'signalwire', 'reverse_mortgage', NULL),
    ('+15102011888', '5a20d036-8aed-4bff-8e98-33026d928006', 'AboutReverse3', 'signalwire', 'reverse_mortgage', NULL),
    ('+13173146615', '1e8fabd1-d9f1-4ab0-836c-11cfa751e16c', 'BarbaraSignalWire', 'signalwire', 'reverse_mortgage', NULL),
    ('+18087468007', 'e6758c07-19fb-45a4-ae92-1b79c9d5f85a', 'BarbaraLivekit', 'livekit', 'reverse_mortgage', NULL)
ON CONFLICT (phone_number) DO UPDATE SET
    signalwire_sid = EXCLUDED.signalwire_sid,
    label = EXCLUDED.label,
    vertical = EXCLUDED.vertical,
    broker_id = EXCLUDED.broker_id,
    updated_at = NOW();

-- Example: Update broker assignments after insert
-- UPDATE phone_numbers SET broker_id = 'broker-uuid-here' WHERE label LIKE 'MyReverseOptions%';
-- UPDATE phone_numbers SET broker_id = 'another-broker-uuid' WHERE label LIKE 'AboutReverse%';

-- Verify insert
SELECT 
    phone_number, 
    label, 
    current_route,
    broker_id,
    CASE 
        WHEN current_route = 'signalwire' THEN '🔵 SignalWire (Webhook)'
        WHEN current_route = 'livekit' THEN '🟣 LiveKit (SWML Script)'
    END as routing_method
FROM phone_numbers
ORDER BY label;

