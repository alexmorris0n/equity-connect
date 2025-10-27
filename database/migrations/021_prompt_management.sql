-- =====================================================
-- PROMPT MANAGEMENT SYSTEM
-- =====================================================
-- Purpose: Structured prompt versioning with multi-tenant support
-- Created: 2025-01-26
-- =====================================================

-- Main prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'barbara',
  current_version INTEGER DEFAULT 1,
  is_base_prompt BOOLEAN DEFAULT FALSE, -- Mark as default/base prompt
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for base prompt lookups
CREATE INDEX IF NOT EXISTS idx_prompts_base ON prompts(is_base_prompt) WHERE is_base_prompt = TRUE;

-- Structured prompt versions (JSON sections)
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  
  -- Structured content by section
  content JSONB NOT NULL,
  -- Example structure:
  -- {
  --   "role": "You are Barbara...",
  --   "personality": "- Brief responses...",
  --   "lead_context": "Caller: {{leadFirstName}}...",
  --   "broker_context": "Broker: {{brokerName}}...",
  --   "conversation_flow": "## Introduction...",
  --   "tools": "Available tools:...",
  --   "objection_handling": "Common objections:...",
  --   "safety": "Escalate when:...",
  --   "compliance": "TCPA disclaimer:..."
  -- }
  
  -- Template variables detected in content
  variables TEXT[],
  
  -- Version metadata
  change_summary TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  is_draft BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(prompt_id, version_number)
);

-- Indexes for version queries
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_active ON prompt_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_draft ON prompt_versions(is_draft);

-- Deployment history
CREATE TABLE IF NOT EXISTS prompt_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  deployed_by VARCHAR(100),
  deployment_reason TEXT,
  rollback_from_version INTEGER,
  status VARCHAR(50) DEFAULT 'deployed',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_deployments_prompt_id ON prompt_deployments(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_deployments_status ON prompt_deployments(status);

-- Broker prompt assignments
CREATE TABLE IF NOT EXISTS broker_prompt_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_version INTEGER,
  
  -- Broker-specific variable overrides
  custom_variables JSONB,
  -- Example: {
  --   "brokerName": "Walter Richards",
  --   "companyName": "MyReverseOptions",
  --   "brokerNMLS": "123456",
  --   "brokerPhone": "555-1234"
  -- }
  
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES brokers(id),
  
  UNIQUE(broker_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_assignments_broker ON broker_prompt_assignments(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_assignments_prompt ON broker_prompt_assignments(prompt_id);

-- Performance tracking (basic metrics from interactions)
CREATE TABLE IF NOT EXISTS prompt_version_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  
  -- Aggregated metrics
  total_calls INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2),
  avg_call_duration_seconds INTEGER,
  
  -- Time period for metrics
  metrics_start_date TIMESTAMP,
  metrics_end_date TIMESTAMP,
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(prompt_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_prompt_performance_prompt ON prompt_version_performance(prompt_id);

-- Audit log for all prompt changes
CREATE TABLE IF NOT EXISTS prompt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  version_number INTEGER,
  action VARCHAR(50) NOT NULL, -- 'created', 'deployed', 'rolled_back', 'assigned', 'updated'
  performed_by VARCHAR(100),
  change_details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_prompt ON prompt_audit_log(prompt_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON prompt_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON prompt_audit_log(created_at DESC);

-- Add user_role column to brokers if not exists
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS user_role VARCHAR(20) DEFAULT 'broker';
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_brokers_role ON brokers(user_role);
CREATE INDEX IF NOT EXISTS idx_brokers_user_id ON brokers(user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on leads (brokers see only their leads)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins see all leads" ON leads;
CREATE POLICY "Admins see all leads"
  ON leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE brokers.user_id = auth.uid()
      AND brokers.user_role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Brokers see only their leads" ON leads;
CREATE POLICY "Brokers see only their leads"
  ON leads FOR SELECT
  USING (
    assigned_broker_id = (
      SELECT id FROM brokers WHERE user_id = auth.uid()
    )
  );

-- Enable RLS on interactions
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins see all interactions" ON interactions;
CREATE POLICY "Admins see all interactions"
  ON interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE brokers.user_id = auth.uid()
      AND brokers.user_role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Brokers see only their interactions" ON interactions;
CREATE POLICY "Brokers see only their interactions"
  ON interactions FOR SELECT
  USING (
    broker_id = (
      SELECT id FROM brokers WHERE user_id = auth.uid()
    )
  );

-- Prompts: Admins can do everything, brokers can only read
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access prompts" ON prompts;
CREATE POLICY "Admins full access prompts"
  ON prompts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE brokers.user_id = auth.uid()
      AND brokers.user_role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Brokers read prompts" ON prompts;
CREATE POLICY "Brokers read prompts"
  ON prompts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers WHERE brokers.user_id = auth.uid()
    )
  );

-- Prompt versions: Same as prompts
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access versions" ON prompt_versions;
CREATE POLICY "Admins full access versions"
  ON prompt_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE brokers.user_id = auth.uid()
      AND brokers.user_role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Brokers read versions" ON prompt_versions;
CREATE POLICY "Brokers read versions"
  ON prompt_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brokers WHERE brokers.user_id = auth.uid()
    )
  );

-- Broker assignments: Brokers can only see their own
ALTER TABLE broker_prompt_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access assignments" ON broker_prompt_assignments;
CREATE POLICY "Admins full access assignments"
  ON broker_prompt_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brokers 
      WHERE brokers.user_id = auth.uid()
      AND brokers.user_role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Brokers see own assignments" ON broker_prompt_assignments;
CREATE POLICY "Brokers see own assignments"
  ON broker_prompt_assignments FOR SELECT
  USING (
    broker_id = (
      SELECT id FROM brokers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Brokers update own variables" ON broker_prompt_assignments;
CREATE POLICY "Brokers update own variables"
  ON broker_prompt_assignments FOR UPDATE
  USING (
    broker_id = (
      SELECT id FROM brokers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    broker_id = (
      SELECT id FROM brokers WHERE user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE prompts IS 'Main prompt registry';
COMMENT ON TABLE prompt_versions IS 'Versioned prompt content with structured sections';
COMMENT ON TABLE prompt_deployments IS 'Deployment history and rollback tracking';
COMMENT ON TABLE broker_prompt_assignments IS 'Assign prompts to brokers with custom variables';
COMMENT ON TABLE prompt_version_performance IS 'Performance metrics per version';
COMMENT ON TABLE prompt_audit_log IS 'Complete audit trail of all prompt changes';

COMMENT ON COLUMN prompts.is_base_prompt IS 'Mark as default prompt for new brokers';
COMMENT ON COLUMN prompt_versions.content IS 'Structured JSON with sections (role, personality, context, etc.)';
COMMENT ON COLUMN prompt_versions.variables IS 'Array of template variables used in content';
COMMENT ON COLUMN broker_prompt_assignments.custom_variables IS 'Broker-specific variable overrides (name, NMLS, company, etc.)';

