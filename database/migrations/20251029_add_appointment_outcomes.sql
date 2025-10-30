-- Migration: Add cancel and reschedule outcomes to interactions table
-- Purpose: Support new cancel_appointment and reschedule_appointment tools
-- Date: 2025-10-29

-- Add new outcome values for appointment cancellation and rescheduling
-- Add new type value for audit notes
-- Note: PostgreSQL doesn't have ALTER TYPE ADD VALUE in all versions,
-- so we check if constraint exists and recreate it

DO $$
BEGIN
    -- Drop existing outcome constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'interactions_outcome_check'
    ) THEN
        ALTER TABLE interactions DROP CONSTRAINT interactions_outcome_check;
    END IF;

    -- Add updated outcome constraint with new values
    ALTER TABLE interactions ADD CONSTRAINT interactions_outcome_check
        CHECK (outcome IN (
            'positive',
            'neutral', 
            'negative',
            'no_response',
            'appointment_booked',
            'not_interested',
            'cancelled',
            'appointment_rescheduled'
        ));

    -- Drop existing type constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'interactions_type_check'
    ) THEN
        ALTER TABLE interactions DROP CONSTRAINT interactions_type_check;
    END IF;

    -- Add updated type constraint with new values
    ALTER TABLE interactions ADD CONSTRAINT interactions_type_check
        CHECK (type IN (
            'email_sent',
            'email_opened',
            'email_clicked',
            'email_replied',
            'ai_call',
            'appointment',
            'sms_sent',
            'sms_replied',
            'note'
        ));
END $$;

-- Add comments explaining new values
COMMENT ON COLUMN interactions.outcome IS 'Interaction outcome. New values: cancelled (appointment cancelled by lead), appointment_rescheduled (appointment moved to new time)';
COMMENT ON COLUMN interactions.type IS 'Interaction type. New value: note (audit trail for system actions like cancellations/reschedules)';


