-- Phone Number Routing Management
-- Track SignalWire phone numbers and their routing configuration
-- With broker assignment for RLS

-- Drop old table if it exists (cleanup)
DROP TABLE IF EXISTS signalwire_phone_numbers CASCADE;

-- Create phone_numbers table
CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE, -- E.164 format: +14155551234
    signalwire_sid TEXT NOT NULL UNIQUE, -- SignalWire Phone Number SID (PNxxx...)
    label TEXT, -- Friendly name: "Main Office", "Sales Line", etc.
    
    -- Routing configuration
    current_route TEXT NOT NULL DEFAULT 'signalwire', -- 'signalwire' (webhook) or 'livekit' (SWML script)
    
    -- Ownership & Access Control
    broker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Which broker owns this number
    organization_id UUID, -- Future: multi-org support
    
    -- Metadata
    vertical TEXT, -- Optional: link to specific vertical
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create config table for routing settings (global)
CREATE TABLE IF NOT EXISTS phone_routing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert routing configuration
INSERT INTO phone_routing_config (key, value, description) VALUES
    ('livekit_swml_script_id', 'e447162b-9780-468a-ae6b-447d23b664a1', 'LiveKit SWML Script UUID (assigned to number)'),
    ('signalwire_webhook_url', 'https://barbara-swaig-bridge.fly.dev/agent/barbara', 'SignalWire SWML Webhook URL (VoiceUrl)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_phone_numbers_current_route ON phone_numbers(current_route);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_vertical ON phone_numbers(vertical);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_is_active ON phone_numbers(is_active);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_broker_id ON phone_numbers(broker_id);

-- Add RLS policies
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_routing_config ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on phone_numbers"
    ON phone_numbers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on phone_routing_config"
    ON phone_routing_config
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Brokers can only see their own phone numbers
CREATE POLICY "Brokers can view their own phone numbers"
    ON phone_numbers
    FOR SELECT
    TO authenticated
    USING (broker_id = auth.uid());

-- Brokers can update routing on their own numbers
CREATE POLICY "Brokers can update their own phone numbers"
    ON phone_numbers
    FOR UPDATE
    TO authenticated
    USING (broker_id = auth.uid())
    WITH CHECK (broker_id = auth.uid());

-- Everyone can read routing config (no sensitive data)
CREATE POLICY "Anyone can read routing config"
    ON phone_routing_config
    FOR SELECT
    TO authenticated
    USING (true);

-- Example: Insert sample phone number (update with your actual numbers)
-- INSERT INTO phone_numbers (phone_number, signalwire_sid, label, current_route, broker_id)
-- VALUES ('+14155551234', 'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Main Line', 'livekit', 'broker-uuid-here');

COMMENT ON TABLE phone_numbers IS 'SignalWire phone numbers and their routing configuration with broker ownership';
COMMENT ON TABLE phone_routing_config IS 'Global configuration for phone routing';
COMMENT ON COLUMN phone_numbers.current_route IS 'Current routing: signalwire (webhook) or livekit (SWML script)';
COMMENT ON COLUMN phone_numbers.broker_id IS 'Broker who owns this phone number (for RLS access control)';
COMMENT ON COLUMN phone_numbers.last_synced_at IS 'Last time routing was synced to SignalWire';

