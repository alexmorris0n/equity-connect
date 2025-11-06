-- Migration: Add persona sync infrastructure (no column renames)

-- 1. Extend leads table with tracking columns (if they do not already exist)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_email_from TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

-- 2. Create log table for Instantly persona sync runs
CREATE TABLE IF NOT EXISTS public.instantly_persona_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  leads_found INTEGER NOT NULL DEFAULT 0,
  leads_updated INTEGER NOT NULL DEFAULT 0,
  leads_skipped INTEGER NOT NULL DEFAULT 0,
  errors JSONB,
  runtime_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed'))
);

-- 3. Add helpful index for persona lookups (first-touch policy keeps persona_sender_name stable)
CREATE INDEX IF NOT EXISTS idx_leads_persona_sender_name
  ON public.leads (persona_sender_name)
  WHERE persona_sender_name IS NOT NULL;

-- 4. Optional: index for log timestamps to support dashboards
CREATE INDEX IF NOT EXISTS idx_instantly_persona_sync_log_run_at
  ON public.instantly_persona_sync_log (run_at DESC);

-- 5. Helper functions for advisory locking (used by Edge Function)
CREATE OR REPLACE FUNCTION public.acquire_persona_sync_lock(lock_key BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
AS $$
  SELECT pg_try_advisory_lock(lock_key);
$$;

CREATE OR REPLACE FUNCTION public.release_persona_sync_lock(lock_key BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
AS $$
  SELECT pg_advisory_unlock(lock_key);
$$;

