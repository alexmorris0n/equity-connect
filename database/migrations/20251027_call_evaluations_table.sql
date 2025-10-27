-- Create call_evaluations table for automated post-call analysis
-- This enables data-driven prompt optimization and quality monitoring

CREATE TABLE IF NOT EXISTS call_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to the interaction being evaluated
  interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  
  -- Evaluation scores (0-10 scale)
  opening_effectiveness INTEGER CHECK (opening_effectiveness >= 0 AND opening_effectiveness <= 10),
  property_discussion_quality INTEGER CHECK (property_discussion_quality >= 0 AND property_discussion_quality <= 10),
  objection_handling INTEGER CHECK (objection_handling >= 0 AND objection_handling <= 10),
  booking_attempt_quality INTEGER CHECK (booking_attempt_quality >= 0 AND booking_attempt_quality <= 10),
  tone_consistency INTEGER CHECK (tone_consistency >= 0 AND tone_consistency <= 10),
  overall_call_flow INTEGER CHECK (overall_call_flow >= 0 AND overall_call_flow <= 10),
  
  -- Composite score (average of all metrics)
  overall_score NUMERIC(4,2) GENERATED ALWAYS AS (
    (COALESCE(opening_effectiveness, 0) + 
     COALESCE(property_discussion_quality, 0) + 
     COALESCE(objection_handling, 0) + 
     COALESCE(booking_attempt_quality, 0) + 
     COALESCE(tone_consistency, 0) + 
     COALESCE(overall_call_flow, 0)) / 6.0
  ) STORED,
  
  -- AI-generated analysis
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure: {
  --   "strengths": ["..."],
  --   "weaknesses": ["..."],
  --   "objections_handled": ["..."],
  --   "booking_opportunities_missed": ["..."],
  --   "red_flags": ["..."],
  --   "summary": "..."
  -- }
  
  -- Prompt version tracking (for A/B testing and optimization)
  prompt_version TEXT,
  prompt_registry_id TEXT, -- PromptLayer prompt ID if using PromptLayer
  
  -- Model used for evaluation
  evaluation_model TEXT DEFAULT 'gpt-4o-mini',
  
  -- Metadata
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluation_duration_ms INTEGER, -- How long evaluation took
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_call_evaluations_interaction_id ON call_evaluations(interaction_id);
CREATE INDEX idx_call_evaluations_evaluated_at ON call_evaluations(evaluated_at DESC);
CREATE INDEX idx_call_evaluations_prompt_version ON call_evaluations(prompt_version) WHERE prompt_version IS NOT NULL;
CREATE INDEX idx_call_evaluations_overall_score ON call_evaluations(overall_score DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_call_evaluations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER call_evaluations_updated_at
  BEFORE UPDATE ON call_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_call_evaluations_updated_at();

-- RLS Policies (same as interactions table - broker can see their own)
ALTER TABLE call_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can view their own call evaluations"
  ON call_evaluations FOR SELECT
  USING (
    interaction_id IN (
      SELECT id FROM interactions WHERE broker_id = auth.uid()
    )
  );

CREATE POLICY "Service role has full access to call evaluations"
  ON call_evaluations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE call_evaluations IS 'Automated AI evaluations of call quality for continuous prompt optimization';
COMMENT ON COLUMN call_evaluations.interaction_id IS 'Links to the interaction record being evaluated';
COMMENT ON COLUMN call_evaluations.overall_score IS 'Average of all metric scores (0-10)';
COMMENT ON COLUMN call_evaluations.analysis IS 'JSON object with detailed AI analysis of the call';
COMMENT ON COLUMN call_evaluations.prompt_version IS 'Version identifier of the prompt used during this call';

