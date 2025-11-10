-- conversation_state: durable call state across sessions
-- Creates one row per identity (phone_number/lead), reused across calls
-- Idempotent: uses IF NOT EXISTS where possible

-- Enable gen_random_uuid() if not already available (Supabase enables by default)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.conversation_state (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	phone_number text NOT NULL,
	lead_id uuid REFERENCES public.leads(id),
	qualified boolean DEFAULT false,
	current_node text,
	conversation_data jsonb DEFAULT '{}'::jsonb,
	call_count int DEFAULT 1,
	last_call_at timestamptz DEFAULT now(),
	topics_discussed text[] DEFAULT '{}'::text[],
	call_status text DEFAULT 'active',
	call_ended_at timestamptz,
	exit_reason text,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_conversation_state_phone ON public.conversation_state(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversation_state_status ON public.conversation_state(call_status);
CREATE INDEX IF NOT EXISTS idx_conversation_state_lead ON public.conversation_state(lead_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_conversation_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conversation_state_updated_at ON public.conversation_state;
CREATE TRIGGER trg_conversation_state_updated_at
BEFORE UPDATE ON public.conversation_state
FOR EACH ROW
EXECUTE PROCEDURE public.set_conversation_state_updated_at();


