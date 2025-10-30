-- =====================================================
-- USER PREFERENCES (THEME & NOTIFICATIONS)
-- =====================================================
--
-- Purpose: Persist per-user UI preferences (theme + email notifications)
-- outside of auth.user_metadata so they can be managed and queried
-- consistently across services.
--
-- Created: 2025-10-30
-- =====================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE user_preferences
  OWNER TO postgres;

ALTER TABLE user_preferences
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their preferences"
  ON user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their preferences"
  ON user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their preferences"
  ON user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional upsert helper so updated_at stays fresh
CREATE OR REPLACE FUNCTION public.touch_user_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON user_preferences;

CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_preferences();

-- =====================================================
-- DATA BACKFILL FROM AUTH USERS
-- =====================================================

INSERT INTO user_preferences (user_id, theme, email_notifications)
SELECT
  id AS user_id,
  CASE
    WHEN raw_user_meta_data ? 'theme' AND raw_user_meta_data ->> 'theme' IN ('light', 'dark', 'auto')
      THEN raw_user_meta_data ->> 'theme'
    ELSE 'light'
  END AS theme,
  CASE
    WHEN raw_user_meta_data ? 'email_notifications'
      THEN COALESCE((raw_user_meta_data ->> 'email_notifications')::BOOLEAN, TRUE)
    ELSE TRUE
  END AS email_notifications
FROM auth.users
ON CONFLICT (user_id)
DO UPDATE
SET
  theme = EXCLUDED.theme,
  email_notifications = EXCLUDED.email_notifications,
  updated_at = timezone('utc', now());

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ user_preferences table ready';
  RAISE NOTICE '';
  RAISE NOTICE 'Theme distribution (sanity check):';
END $$;

SELECT theme, COUNT(*)
FROM user_preferences
GROUP BY theme
ORDER BY theme;

-- =====================================================
-- NEXT STEPS / NOTES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Update the portal to read/write theme + notifications via user_preferences';
  RAISE NOTICE '2. Ensure any backend services rely on this table (not auth metadata) for preference-aware logic';
  RAISE NOTICE '3. Consider job to periodically sync legacy metadata if other apps still read it';
  RAISE NOTICE '';
END $$;


