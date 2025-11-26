-- ============================================================================
-- RLS POLICIES: Admin (God Mode) + Broker (Own Data)
-- ============================================================================
-- Admin: Full access to everything
-- Broker: Only sees/edits their own data (via broker_id linkage)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create user_profiles table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL DEFAULT 'broker' CHECK (role IN ('admin', 'broker')),
  broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- If role is 'broker', broker_id should be set
  CONSTRAINT broker_role_needs_broker_id CHECK (
    role != 'broker' OR broker_id IS NOT NULL
  )
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_broker_id ON public.user_profiles(broker_id);

-- Comment
COMMENT ON TABLE public.user_profiles IS 'Links auth.users to their role (admin/broker) and optionally to a broker record';

-- ============================================================================
-- STEP 2: Create helper functions
-- ============================================================================

-- Check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Get the broker_id for the current authenticated user
CREATE OR REPLACE FUNCTION public.get_user_broker_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT broker_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================================
-- STEP 3: Enable RLS on all tables
-- ============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microsites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_code_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_replay_guard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_source_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vector_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vapi_number_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vapi_number_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vapi_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pull_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_prompt_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_version_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculator_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instantly_persona_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livekit_available_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livekit_available_stt_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livekit_available_llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contexts_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_voice_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_routing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livekit_available_realtime_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalwire_available_llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalwire_available_stt_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalwire_available_voices ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Drop existing policies (clean slate)
-- ============================================================================

-- brokers
DROP POLICY IF EXISTS "Authenticated users can access brokers" ON public.brokers;

-- leads
DROP POLICY IF EXISTS "Authenticated users can access leads" ON public.leads;
DROP POLICY IF EXISTS "service_role_all" ON public.leads;

-- interactions
DROP POLICY IF EXISTS "Authenticated users can access interactions" ON public.interactions;
DROP POLICY IF EXISTS "service_role_interactions" ON public.interactions;

-- billing_events
DROP POLICY IF EXISTS "service_role_billing" ON public.billing_events;

-- pipeline_events
DROP POLICY IF EXISTS "service_role_pipeline" ON public.pipeline_events;

-- consent_tokens
DROP POLICY IF EXISTS "service_consent_tokens_all" ON public.consent_tokens;

-- pipeline_dlq
DROP POLICY IF EXISTS "service_pipeline_dlq_all" ON public.pipeline_dlq;

-- personas
DROP POLICY IF EXISTS "Allow public read access to active personas" ON public.personas;

-- neighborhoods
DROP POLICY IF EXISTS "Allow public read access to active neighborhoods" ON public.neighborhoods;

-- broker_territories
DROP POLICY IF EXISTS "Allow full access to broker territories" ON public.broker_territories;

-- source_bookmarks
DROP POLICY IF EXISTS "Allow all operations on source_bookmarks" ON public.source_bookmarks;

-- vector_embeddings
DROP POLICY IF EXISTS "broker_vector_embeddings_select" ON public.vector_embeddings;
DROP POLICY IF EXISTS "service_vector_embeddings_all" ON public.vector_embeddings;

-- prompts
DROP POLICY IF EXISTS "Authenticated users can access prompts" ON public.prompts;

-- prompt_versions
DROP POLICY IF EXISTS "Authenticated users can access prompt_versions" ON public.prompt_versions;

-- broker_prompt_assignments
DROP POLICY IF EXISTS "Authenticated users can access broker_prompt_assignments" ON public.broker_prompt_assignments;
DROP POLICY IF EXISTS "Brokers see own assignments" ON public.broker_prompt_assignments;
DROP POLICY IF EXISTS "Brokers update own variables" ON public.broker_prompt_assignments;

-- call_evaluations
DROP POLICY IF EXISTS "Authenticated users can access call_evaluations" ON public.call_evaluations;
DROP POLICY IF EXISTS "Brokers can view their own call evaluations" ON public.call_evaluations;
DROP POLICY IF EXISTS "Service role has full access to call evaluations" ON public.call_evaluations;

-- user_preferences
DROP POLICY IF EXISTS "Users can insert their preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can read their preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update their preferences" ON public.user_preferences;

-- phone_routing_config
DROP POLICY IF EXISTS "Anyone can read routing config" ON public.phone_routing_config;
DROP POLICY IF EXISTS "Service role full access on phone_routing_config" ON public.phone_routing_config;

-- ============================================================================
-- STEP 5: Create new policies
-- ============================================================================

-- ============================================================================
-- USER_PROFILES
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.user_profiles FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "user_read_own" ON public.user_profiles FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- BROKERS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.brokers FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read_own" ON public.brokers FOR SELECT
  USING (id = get_user_broker_id());

CREATE POLICY "broker_update_own" ON public.brokers FOR UPDATE
  USING (id = get_user_broker_id())
  WITH CHECK (id = get_user_broker_id());

-- ============================================================================
-- LEADS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.leads FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_leads" ON public.leads FOR ALL
  USING (assigned_broker_id = get_user_broker_id())
  WITH CHECK (assigned_broker_id = get_user_broker_id());

-- ============================================================================
-- INTERACTIONS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.interactions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_interactions" ON public.interactions FOR ALL
  USING (broker_id = get_user_broker_id())
  WITH CHECK (broker_id = get_user_broker_id());

-- ============================================================================
-- BILLING_EVENTS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.billing_events FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_billing" ON public.billing_events FOR SELECT
  USING (broker_id = get_user_broker_id());

-- ============================================================================
-- PIPELINE_EVENTS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.pipeline_events FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_pipeline" ON public.pipeline_events FOR SELECT
  USING (broker_id = get_user_broker_id());

-- ============================================================================
-- MICROSITES
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.microsites FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_microsites" ON public.microsites FOR ALL
  USING (lead_id IN (SELECT id FROM leads WHERE assigned_broker_id = get_user_broker_id()))
  WITH CHECK (lead_id IN (SELECT id FROM leads WHERE assigned_broker_id = get_user_broker_id()));

-- ============================================================================
-- CONSENT_TOKENS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.consent_tokens FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_consent" ON public.consent_tokens FOR SELECT
  USING (lead_id IN (SELECT id FROM leads WHERE assigned_broker_id = get_user_broker_id()));

-- ============================================================================
-- VERIFICATION_CODE_MAP (Admin only - system table)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.verification_code_map FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- PIPELINE_DLQ (Admin only - system table)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.pipeline_dlq FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- LEADS_STAGING (Admin only - system table)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.leads_staging FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- INGEST_REPLAY_GUARD (Admin only - system table)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.ingest_replay_guard FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- PERSONAS (Read for all authenticated, write for admin)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.personas FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read_active" ON public.personas FOR SELECT
  USING (active = true);

-- ============================================================================
-- NEIGHBORHOODS (Read for all authenticated, write for admin)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.neighborhoods FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read_active" ON public.neighborhoods FOR SELECT
  USING (active = true);

-- ============================================================================
-- LEAD_SOURCE_EVENTS (Admin only - system table)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.lead_source_events FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- DLQ (Admin only - system table)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.dlq FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- SUPPRESSION_CONTACTS (Admin only - system table)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.suppression_contacts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- BROKER_TERRITORIES
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.broker_territories FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_territories" ON public.broker_territories FOR SELECT
  USING (broker_id = get_user_broker_id());

-- ============================================================================
-- SOURCE_BOOKMARKS (Admin only - system table)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.source_bookmarks FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- BROKER_DAILY_STATS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.broker_daily_stats FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_stats" ON public.broker_daily_stats FOR SELECT
  USING (broker_id = get_user_broker_id());

-- ============================================================================
-- CAMPAIGNS (Read for all, write for admin)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.campaigns FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read_campaigns" ON public.campaigns FOR SELECT
  USING (true);

-- ============================================================================
-- VECTOR_EMBEDDINGS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.vector_embeddings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_embeddings" ON public.vector_embeddings FOR SELECT
  USING (
    lead_id IS NULL 
    OR lead_id IN (SELECT id FROM leads WHERE assigned_broker_id = get_user_broker_id())
  );

-- ============================================================================
-- VAPI_NUMBER_POOL (Admin only)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.vapi_number_pool FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_pool" ON public.vapi_number_pool FOR SELECT
  USING (broker_id = get_user_broker_id());

-- ============================================================================
-- VAPI_NUMBER_ASSIGNMENTS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.vapi_number_assignments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_assignments" ON public.vapi_number_assignments FOR SELECT
  USING (broker_id = get_user_broker_id());

-- ============================================================================
-- VAPI_CALL_LOGS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.vapi_call_logs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_call_logs" ON public.vapi_call_logs FOR SELECT
  USING (assignment_id IN (
    SELECT id FROM vapi_number_assignments WHERE broker_id = get_user_broker_id()
  ));

-- ============================================================================
-- LEAD_PULL_RESULTS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.lead_pull_results FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_pull_results" ON public.lead_pull_results FOR SELECT
  USING (broker_id = get_user_broker_id());

-- ============================================================================
-- EMAIL_EVENTS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.email_events FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_email_events" ON public.email_events FOR SELECT
  USING (broker_id = get_user_broker_id());

-- ============================================================================
-- BILLING_CALL_LOGS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.billing_call_logs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_billing_logs" ON public.billing_call_logs FOR SELECT
  USING (broker_id = get_user_broker_id());

-- ============================================================================
-- PROMPTS (Read for all, write for admin)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.prompts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read_prompts" ON public.prompts FOR SELECT
  USING (true);

-- ============================================================================
-- PROMPT_VERSIONS (Read for all, write for admin)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.prompt_versions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read_versions" ON public.prompt_versions FOR SELECT
  USING (true);

-- ============================================================================
-- PROMPT_DEPLOYMENTS (Admin only)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.prompt_deployments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- BROKER_PROMPT_ASSIGNMENTS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.broker_prompt_assignments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_prompt_assignments" ON public.broker_prompt_assignments FOR SELECT
  USING (broker_id = get_user_broker_id());

CREATE POLICY "broker_update_own_variables" ON public.broker_prompt_assignments FOR UPDATE
  USING (broker_id = get_user_broker_id())
  WITH CHECK (broker_id = get_user_broker_id());

-- ============================================================================
-- PROMPT_VERSION_PERFORMANCE (Admin only)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.prompt_version_performance FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- PROMPT_AUDIT_LOG (Admin only)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.prompt_audit_log FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- CALL_EVALUATIONS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.call_evaluations FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_evaluations" ON public.call_evaluations FOR SELECT
  USING (interaction_id IN (
    SELECT id FROM interactions WHERE broker_id = get_user_broker_id()
  ));

-- ============================================================================
-- USER_PREFERENCES
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.user_preferences FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "user_own_preferences" ON public.user_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- CALCULATOR_TOKENS
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.calculator_tokens FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_tokens" ON public.calculator_tokens FOR SELECT
  USING (lead_id IN (SELECT id FROM leads WHERE assigned_broker_id = get_user_broker_id()));

-- ============================================================================
-- INSTANTLY_PERSONA_SYNC_LOG (Admin only)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.instantly_persona_sync_log FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- AI_TEMPLATES
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.ai_templates FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read_templates" ON public.ai_templates FOR SELECT
  USING (true);

CREATE POLICY "broker_own_templates" ON public.ai_templates FOR ALL
  USING (broker_id = get_user_broker_id())
  WITH CHECK (broker_id = get_user_broker_id());

-- ============================================================================
-- CONVERSATION_STATE
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.conversation_state FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_conversations" ON public.conversation_state FOR SELECT
  USING (lead_id IN (SELECT id FROM leads WHERE assigned_broker_id = get_user_broker_id()));

-- ============================================================================
-- THEME_PROMPTS (Read for all, write for admin)
-- ============================================================================
CREATE POLICY "admin_full_access" ON public.theme_prompts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read_themes" ON public.theme_prompts FOR SELECT
  USING (true);

-- ============================================================================
-- CONFIG/REFERENCE TABLES (Read for all authenticated, write for admin)
-- ============================================================================

-- livekit_available_voices
CREATE POLICY "admin_full_access" ON public.livekit_available_voices FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.livekit_available_voices FOR SELECT
  USING (true);

-- livekit_available_stt_models
CREATE POLICY "admin_full_access" ON public.livekit_available_stt_models FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.livekit_available_stt_models FOR SELECT
  USING (true);

-- livekit_available_llm_models
CREATE POLICY "admin_full_access" ON public.livekit_available_llm_models FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.livekit_available_llm_models FOR SELECT
  USING (true);

-- contexts_config
CREATE POLICY "admin_full_access" ON public.contexts_config FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.contexts_config FOR SELECT
  USING (true);

-- agent_voice_config
CREATE POLICY "admin_full_access" ON public.agent_voice_config FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.agent_voice_config FOR SELECT
  USING (true);

-- vertical_snapshots
CREATE POLICY "admin_full_access" ON public.vertical_snapshots FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.vertical_snapshots FOR SELECT
  USING (true);

-- agent_params
CREATE POLICY "admin_full_access" ON public.agent_params FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.agent_params FOR SELECT
  USING (true);

-- phone_numbers
CREATE POLICY "admin_full_access" ON public.phone_numbers FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_own_numbers" ON public.phone_numbers FOR SELECT
  USING (broker_id IN (SELECT user_id FROM user_profiles WHERE broker_id = get_user_broker_id()));

-- phone_routing_config
CREATE POLICY "admin_full_access" ON public.phone_routing_config FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.phone_routing_config FOR SELECT
  USING (true);

-- livekit_available_realtime_models
CREATE POLICY "admin_full_access" ON public.livekit_available_realtime_models FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.livekit_available_realtime_models FOR SELECT
  USING (true);

-- signalwire_available_llm_models
CREATE POLICY "admin_full_access" ON public.signalwire_available_llm_models FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.signalwire_available_llm_models FOR SELECT
  USING (true);

-- signalwire_available_stt_models
CREATE POLICY "admin_full_access" ON public.signalwire_available_stt_models FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.signalwire_available_stt_models FOR SELECT
  USING (true);

-- signalwire_available_voices
CREATE POLICY "admin_full_access" ON public.signalwire_available_voices FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "broker_read" ON public.signalwire_available_voices FOR SELECT
  USING (true);

-- ============================================================================
-- STEP 6: Insert admin user (alex@amorrison.email)
-- ============================================================================

INSERT INTO public.user_profiles (user_id, role, broker_id)
SELECT 
  '7aaeeca4-765d-47a1-92aa-82360d0afcd0'::uuid,
  'admin',
  NULL
WHERE EXISTS (
  SELECT 1 FROM auth.users WHERE id = '7aaeeca4-765d-47a1-92aa-82360d0afcd0'
);

-- ============================================================================
-- STEP 7: Remove user_id and user_role from brokers table (cleanup)
-- ============================================================================

-- These columns are now redundant since we use user_profiles
-- Keeping them for now but marking as deprecated via comment
COMMENT ON COLUMN public.brokers.user_id IS 'DEPRECATED: Use user_profiles table instead';
COMMENT ON COLUMN public.brokers.user_role IS 'DEPRECATED: Use user_profiles table instead';

-- ============================================================================
-- DONE
-- ============================================================================
