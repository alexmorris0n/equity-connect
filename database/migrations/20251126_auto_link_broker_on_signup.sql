-- ============================================================================
-- Auto-link new auth users to their broker record on signup
-- ============================================================================
-- When a user signs up, if their email matches a broker, auto-create
-- user_profiles record linking them as role='broker'
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matching_broker_id uuid;
BEGIN
  -- Check if this email matches an existing broker
  SELECT id INTO matching_broker_id
  FROM brokers
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;
  
  IF matching_broker_id IS NOT NULL THEN
    -- Broker found - create user_profiles as broker
    INSERT INTO user_profiles (user_id, role, broker_id)
    VALUES (NEW.id, 'broker', matching_broker_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE LOG 'Auto-linked user % to broker %', NEW.email, matching_broker_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-creates user_profiles record when new user signs up. If email matches a broker, links them as role=broker.';










