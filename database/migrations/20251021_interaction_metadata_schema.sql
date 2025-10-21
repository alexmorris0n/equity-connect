-- Migration: Interaction Metadata Schema Documentation
-- Date: 2024-10-21
-- Purpose: Document the rich metadata structure for interactions table
-- Note: The metadata column (JSONB) already exists, this documents the schema

-- ============================================================================
-- INTERACTIONS TABLE - METADATA COLUMN SCHEMA
-- ============================================================================

-- The metadata column in interactions table stores rich context about calls
-- This enables intelligent follow-up calls and analytics

-- METADATA STRUCTURE:
-- {
--   // System info
--   "ai_agent": "barbara",
--   "version": "2.0",
--   "saved_at": "2025-10-21T10:00:00Z",
--
--   // Lead context (for next call)
--   "money_purpose": "medical" | "home_repair" | "debt_consolidation" | "help_family" | "other",
--   "specific_need": "Husband needs heart surgery - $75k",
--   "amount_needed": 75000,
--   "timeline": "urgent" | "1-3_months" | "3-6_months" | "exploring",
--
--   // Objections raised (array of strings)
--   "objections": ["fees_concern", "spouse_approval", "leaving_home_to_kids"],
--
--   // Questions asked (array of strings)
--   "questions_asked": ["Can I leave house to kids?", "What are monthly costs?"],
--
--   // Important details (array of strings)
--   "key_details": ["Retiring in 6 months", "Daughter getting married in June", "Wife name is Mary"],
--
--   // Appointment tracking
--   "appointment_scheduled": true,
--   "appointment_datetime": "2025-10-22T10:00:00Z",
--
--   // Contact verification
--   "email_verified": true,
--   "phone_verified": true,
--   "email_collected": true,
--
--   // Commitment tracking
--   "commitment_points_completed": 8,
--   "text_reminder_consented": true,
--
--   // Call quality metrics
--   "interruptions": 2,
--   "tool_calls_made": ["check_broker_availability", "book_appointment", "update_lead_info"],
--
--   // Direction (inbound/outbound)
--   "direction": "inbound" | "outbound"
-- }

-- ============================================================================
-- EXAMPLE QUERIES
-- ============================================================================

-- Get all leads who mentioned medical expenses
-- SELECT * FROM interactions 
-- WHERE metadata->>'money_purpose' = 'medical';

-- Get leads with fee concerns (for targeted follow-up)
-- SELECT * FROM interactions 
-- WHERE metadata->'objections' ? 'fees_concern';

-- Get leads who completed 8 commitment points (high quality)
-- SELECT * FROM interactions 
-- WHERE (metadata->>'commitment_points_completed')::int >= 8;

-- Get leads who consented to text reminders
-- SELECT * FROM interactions 
-- WHERE metadata->>'text_reminder_consented' = 'true';

-- Get all questions asked across all calls (analytics)
-- SELECT jsonb_array_elements_text(metadata->'questions_asked') as question, count(*)
-- FROM interactions
-- WHERE metadata ? 'questions_asked'
-- GROUP BY question
-- ORDER BY count DESC;

-- ============================================================================
-- INDEXES FOR COMMON QUERIES (Optional - add if needed)
-- ============================================================================

-- Index on money_purpose for targeted campaigns
-- CREATE INDEX IF NOT EXISTS idx_interactions_money_purpose 
-- ON interactions ((metadata->>'money_purpose'));

-- Index on appointment_scheduled for follow-up workflows
-- CREATE INDEX IF NOT EXISTS idx_interactions_appointment_scheduled 
-- ON interactions ((metadata->>'appointment_scheduled'));

-- Index on timeline for urgency-based routing
-- CREATE INDEX IF NOT EXISTS idx_interactions_timeline 
-- ON interactions ((metadata->>'timeline'));

-- GIN index for objections array searching
-- CREATE INDEX IF NOT EXISTS idx_interactions_objections 
-- ON interactions USING GIN ((metadata->'objections'));

-- ============================================================================
-- NOTES
-- ============================================================================

-- The interactions.metadata column is already JSONB and can store any JSON
-- No schema changes needed - this is just documentation
-- The saveInteraction() function in bridge/tools.js now populates this rich metadata
-- Next calls can query this metadata via get_lead_context to personalize conversations

-- Example: Barbara's next call can say:
-- "Hi John, I know you mentioned needing help with your husband's surgery last time..."
-- (Retrieved from: metadata->>'specific_need')

-- ============================================================================
-- COMPLETE! No migration needed - just documentation
-- ============================================================================
