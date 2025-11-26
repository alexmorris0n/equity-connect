-- ============================================================================
-- ROLLBACK: RLS Admin/Broker Policies
-- ============================================================================
-- This reverses all changes from 20251126_rls_admin_broker_policies.sql
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop all new policies
-- ============================================================================

-- user_profiles
DROP POLICY IF EXISTS "admin_full_access" ON public.user_profiles;
DROP POLICY IF EXISTS "user_read_own" ON public.user_profiles;

-- brokers
DROP POLICY IF EXISTS "admin_full_access" ON public.brokers;
DROP POLICY IF EXISTS "broker_read_own" ON public.brokers;
DROP POLICY IF EXISTS "broker_update_own" ON public.brokers;

-- leads
DROP POLICY IF EXISTS "admin_full_access" ON public.leads;
DROP POLICY IF EXISTS "broker_own_leads" ON public.leads;

-- interactions
DROP POLICY IF EXISTS "admin_full_access" ON public.interactions;
DROP POLICY IF EXISTS "broker_own_interactions" ON public.interactions;

-- billing_events
DROP POLICY IF EXISTS "admin_full_access" ON public.billing_events;
DROP POLICY IF EXISTS "broker_own_billing" ON public.billing_events;

-- pipeline_events
DROP POLICY IF EXISTS "admin_full_access" ON public.pipeline_events;
DROP POLICY IF EXISTS "broker_own_pipeline" ON public.pipeline_events;

-- microsites
DROP POLICY IF EXISTS "admin_full_access" ON public.microsites;
DROP POLICY IF EXISTS "broker_own_microsites" ON public.microsites;

-- consent_tokens
DROP POLICY IF EXISTS "admin_full_access" ON public.consent_tokens;
DROP POLICY IF EXISTS "broker_own_consent" ON public.consent_tokens;

-- verification_code_map
DROP POLICY IF EXISTS "admin_full_access" ON public.verification_code_map;

-- pipeline_dlq
DROP POLICY IF EXISTS "admin_full_access" ON public.pipeline_dlq;

-- leads_staging
DROP POLICY IF EXISTS "admin_full_access" ON public.leads_staging;

-- ingest_replay_guard
DROP POLICY IF EXISTS "admin_full_access" ON public.ingest_replay_guard;

-- personas
DROP POLICY IF EXISTS "admin_full_access" ON public.personas;
DROP POLICY IF EXISTS "broker_read_active" ON public.personas;

-- neighborhoods
DROP POLICY IF EXISTS "admin_full_access" ON public.neighborhoods;
DROP POLICY IF EXISTS "broker_read_active" ON public.neighborhoods;

-- lead_source_events
DROP POLICY IF EXISTS "admin_full_access" ON public.lead_source_events;

-- dlq
DROP POLICY IF EXISTS "admin_full_access" ON public.dlq;

-- suppression_contacts
DROP POLICY IF EXISTS "admin_full_access" ON public.suppression_contacts;

-- broker_territories
DROP POLICY IF EXISTS "admin_full_access" ON public.broker_territories;
DROP POLICY IF EXISTS "broker_own_territories" ON public.broker_territories;

-- source_bookmarks
DROP POLICY IF EXISTS "admin_full_access" ON public.source_bookmarks;

-- broker_daily_stats
DROP POLICY IF EXISTS "admin_full_access" ON public.broker_daily_stats;
DROP POLICY IF EXISTS "broker_own_stats" ON public.broker_daily_stats;

-- campaigns
DROP POLICY IF EXISTS "admin_full_access" ON public.campaigns;
DROP POLICY IF EXISTS "broker_read_campaigns" ON public.campaigns;

-- vector_embeddings
DROP POLICY IF EXISTS "admin_full_access" ON public.vector_embeddings;
DROP POLICY IF EXISTS "broker_own_embeddings" ON public.vector_embeddings;

-- vapi_number_pool
DROP POLICY IF EXISTS "admin_full_access" ON public.vapi_number_pool;
DROP POLICY IF EXISTS "broker_own_pool" ON public.vapi_number_pool;

-- vapi_number_assignments
DROP POLICY IF EXISTS "admin_full_access" ON public.vapi_number_assignments;
DROP POLICY IF EXISTS "broker_own_assignments" ON public.vapi_number_assignments;

-- vapi_call_logs
DROP POLICY IF EXISTS "admin_full_access" ON public.vapi_call_logs;
DROP POLICY IF EXISTS "broker_own_call_logs" ON public.vapi_call_logs;

-- lead_pull_results
DROP POLICY IF EXISTS "admin_full_access" ON public.lead_pull_results;
DROP POLICY IF EXISTS "broker_own_pull_results" ON public.lead_pull_results;

-- email_events
DROP POLICY IF EXISTS "admin_full_access" ON public.email_events;
DROP POLICY IF EXISTS "broker_own_email_events" ON public.email_events;

-- billing_call_logs
DROP POLICY IF EXISTS "admin_full_access" ON public.billing_call_logs;
DROP POLICY IF EXISTS "broker_own_billing_logs" ON public.billing_call_logs;

-- prompts
DROP POLICY IF EXISTS "admin_full_access" ON public.prompts;
DROP POLICY IF EXISTS "broker_read_prompts" ON public.prompts;

-- prompt_versions
DROP POLICY IF EXISTS "admin_full_access" ON public.prompt_versions;
DROP POLICY IF EXISTS "broker_read_versions" ON public.prompt_versions;

-- prompt_deployments
DROP POLICY IF EXISTS "admin_full_access" ON public.prompt_deployments;

-- broker_prompt_assignments
DROP POLICY IF EXISTS "admin_full_access" ON public.broker_prompt_assignments;
DROP POLICY IF EXISTS "broker_own_prompt_assignments" ON public.broker_prompt_assignments;
DROP POLICY IF EXISTS "broker_update_own_variables" ON public.broker_prompt_assignments;

-- prompt_version_performance
DROP POLICY IF EXISTS "admin_full_access" ON public.prompt_version_performance;

-- prompt_audit_log
DROP POLICY IF EXISTS "admin_full_access" ON public.prompt_audit_log;

-- call_evaluations
DROP POLICY IF EXISTS "admin_full_access" ON public.call_evaluations;
DROP POLICY IF EXISTS "broker_own_evaluations" ON public.call_evaluations;

-- user_preferences
DROP POLICY IF EXISTS "admin_full_access" ON public.user_preferences;
DROP POLICY IF EXISTS "user_own_preferences" ON public.user_preferences;

-- calculator_tokens
DROP POLICY IF EXISTS "admin_full_access" ON public.calculator_tokens;
DROP POLICY IF EXISTS "broker_own_tokens" ON public.calculator_tokens;

-- instantly_persona_sync_log
DROP POLICY IF EXISTS "admin_full_access" ON public.instantly_persona_sync_log;

-- ai_templates
DROP POLICY IF EXISTS "admin_full_access" ON public.ai_templates;
DROP POLICY IF EXISTS "broker_read_templates" ON public.ai_templates;
DROP POLICY IF EXISTS "broker_own_templates" ON public.ai_templates;

-- conversation_state
DROP POLICY IF EXISTS "admin_full_access" ON public.conversation_state;
DROP POLICY IF EXISTS "broker_own_conversations" ON public.conversation_state;

-- theme_prompts
DROP POLICY IF EXISTS "admin_full_access" ON public.theme_prompts;
DROP POLICY IF EXISTS "broker_read_themes" ON public.theme_prompts;

-- livekit_available_voices
DROP POLICY IF EXISTS "admin_full_access" ON public.livekit_available_voices;
DROP POLICY IF EXISTS "broker_read" ON public.livekit_available_voices;

-- livekit_available_stt_models
DROP POLICY IF EXISTS "admin_full_access" ON public.livekit_available_stt_models;
DROP POLICY IF EXISTS "broker_read" ON public.livekit_available_stt_models;

-- livekit_available_llm_models
DROP POLICY IF EXISTS "admin_full_access" ON public.livekit_available_llm_models;
DROP POLICY IF EXISTS "broker_read" ON public.livekit_available_llm_models;

-- contexts_config
DROP POLICY IF EXISTS "admin_full_access" ON public.contexts_config;
DROP POLICY IF EXISTS "broker_read" ON public.contexts_config;

-- agent_voice_config
DROP POLICY IF EXISTS "admin_full_access" ON public.agent_voice_config;
DROP POLICY IF EXISTS "broker_read" ON public.agent_voice_config;

-- vertical_snapshots
DROP POLICY IF EXISTS "admin_full_access" ON public.vertical_snapshots;
DROP POLICY IF EXISTS "broker_read" ON public.vertical_snapshots;

-- agent_params
DROP POLICY IF EXISTS "admin_full_access" ON public.agent_params;
DROP POLICY IF EXISTS "broker_read" ON public.agent_params;

-- phone_numbers
DROP POLICY IF EXISTS "admin_full_access" ON public.phone_numbers;
DROP POLICY IF EXISTS "broker_own_numbers" ON public.phone_numbers;

-- phone_routing_config
DROP POLICY IF EXISTS "admin_full_access" ON public.phone_routing_config;
DROP POLICY IF EXISTS "broker_read" ON public.phone_routing_config;

-- livekit_available_realtime_models
DROP POLICY IF EXISTS "admin_full_access" ON public.livekit_available_realtime_models;
DROP POLICY IF EXISTS "broker_read" ON public.livekit_available_realtime_models;

-- signalwire_available_llm_models
DROP POLICY IF EXISTS "admin_full_access" ON public.signalwire_available_llm_models;
DROP POLICY IF EXISTS "broker_read" ON public.signalwire_available_llm_models;

-- signalwire_available_stt_models
DROP POLICY IF EXISTS "admin_full_access" ON public.signalwire_available_stt_models;
DROP POLICY IF EXISTS "broker_read" ON public.signalwire_available_stt_models;

-- signalwire_available_voices
DROP POLICY IF EXISTS "admin_full_access" ON public.signalwire_available_voices;
DROP POLICY IF EXISTS "broker_read" ON public.signalwire_available_voices;

-- ============================================================================
-- STEP 2: Disable RLS on tables that didn't have it before
-- ============================================================================

ALTER TABLE public.verification_code_map DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_staging DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_replay_guard DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_source_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dlq DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_daily_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vapi_number_pool DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vapi_number_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vapi_call_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pull_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_call_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_deployments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_version_performance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculator_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.instantly_persona_sync_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_prompts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.livekit_available_voices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.livekit_available_stt_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.livekit_available_llm_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contexts_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_voice_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_params DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.livekit_available_realtime_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalwire_available_llm_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalwire_available_stt_models DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalwire_available_voices DISABLE ROW LEVEL SECURITY;

-- Tables that had RLS enabled but with different policies - disable then restore old
ALTER TABLE public.brokers DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Restore original policies
-- ============================================================================

-- brokers - original policy
CREATE POLICY "Authenticated users can access brokers" ON public.brokers FOR ALL
  TO authenticated
  USING (true);

-- leads
CREATE POLICY "Authenticated users can access leads" ON public.leads FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "service_role_all" ON public.leads FOR ALL
  USING (auth.role() = 'service_role');

-- interactions
CREATE POLICY "Authenticated users can access interactions" ON public.interactions FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "service_role_interactions" ON public.interactions FOR ALL
  USING (auth.role() = 'service_role');

-- billing_events
CREATE POLICY "service_role_billing" ON public.billing_events FOR ALL
  USING (auth.role() = 'service_role');

-- pipeline_events
CREATE POLICY "service_role_pipeline" ON public.pipeline_events FOR ALL
  USING (auth.role() = 'service_role');

-- consent_tokens
CREATE POLICY "service_consent_tokens_all" ON public.consent_tokens FOR ALL
  USING (auth.role() = 'service_role');

-- pipeline_dlq
CREATE POLICY "service_pipeline_dlq_all" ON public.pipeline_dlq FOR ALL
  USING (auth.role() = 'service_role');

-- personas
CREATE POLICY "Allow public read access to active personas" ON public.personas FOR SELECT
  USING (active = true);

-- neighborhoods
CREATE POLICY "Allow public read access to active neighborhoods" ON public.neighborhoods FOR SELECT
  USING (active = true);

-- broker_territories
CREATE POLICY "Allow full access to broker territories" ON public.broker_territories FOR ALL
  USING (true)
  WITH CHECK (true);

-- source_bookmarks
CREATE POLICY "Allow all operations on source_bookmarks" ON public.source_bookmarks FOR ALL
  USING (true);

-- vector_embeddings
CREATE POLICY "broker_vector_embeddings_select" ON public.vector_embeddings FOR SELECT
  USING ((lead_id IS NULL) OR (lead_id IN (
    SELECT leads.id FROM leads WHERE leads.assigned_broker_id = auth.uid()
  )));

CREATE POLICY "service_vector_embeddings_all" ON public.vector_embeddings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- prompts
CREATE POLICY "Authenticated users can access prompts" ON public.prompts FOR ALL
  TO authenticated
  USING (true);

-- prompt_versions
CREATE POLICY "Authenticated users can access prompt_versions" ON public.prompt_versions FOR ALL
  TO authenticated
  USING (true);

-- broker_prompt_assignments
CREATE POLICY "Authenticated users can access broker_prompt_assignments" ON public.broker_prompt_assignments FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Brokers see own assignments" ON public.broker_prompt_assignments FOR SELECT
  USING (broker_id = (SELECT brokers.id FROM brokers WHERE brokers.user_id = auth.uid()));

CREATE POLICY "Brokers update own variables" ON public.broker_prompt_assignments FOR UPDATE
  USING (broker_id = (SELECT brokers.id FROM brokers WHERE brokers.user_id = auth.uid()))
  WITH CHECK (broker_id = (SELECT brokers.id FROM brokers WHERE brokers.user_id = auth.uid()));

-- call_evaluations
CREATE POLICY "Authenticated users can access call_evaluations" ON public.call_evaluations FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Brokers can view their own call evaluations" ON public.call_evaluations FOR SELECT
  USING (interaction_id IN (SELECT interactions.id FROM interactions WHERE interactions.broker_id = auth.uid()));

CREATE POLICY "Service role has full access to call evaluations" ON public.call_evaluations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- user_preferences
CREATE POLICY "Users can insert their preferences" ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their preferences" ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their preferences" ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- phone_routing_config
CREATE POLICY "Anyone can read routing config" ON public.phone_routing_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access on phone_routing_config" ON public.phone_routing_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 4: Drop helper functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_user_broker_id();

-- ============================================================================
-- STEP 5: Drop user_profiles table
-- ============================================================================

DROP TABLE IF EXISTS public.user_profiles;

-- ============================================================================
-- STEP 6: Restore brokers column comments
-- ============================================================================

COMMENT ON COLUMN public.brokers.user_id IS NULL;
COMMENT ON COLUMN public.brokers.user_role IS NULL;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
