# Apply Prompt Management Migration

## Step 1: Run the SQL Migration in Supabase

1. Open your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `021_prompt_management.sql`
4. Paste and run the query

This will create:
- `prompts` table (main registry)
- `prompt_versions` table (structured content with sections)
- `prompt_deployments` table (deployment history)
- `broker_prompt_assignments` table (assign prompts to brokers)
- `prompt_version_performance` table (metrics)
- `prompt_audit_log` table (audit trail)
- RLS policies (admin sees all, brokers see only their own)
- Indexes for performance

## Step 2: Set Your Admin Role

Run this SQL to set your user as admin:

```sql
-- Replace with your email
UPDATE brokers 
SET user_role = 'admin',
    user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com')
WHERE email = 'your@email.com';
```

## Step 3: Verify Tables Created

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'prompt%';

-- Should return:
-- prompts
-- prompt_versions
-- prompt_deployments
-- broker_prompt_assignments
-- prompt_version_performance
-- prompt_audit_log
```

## What's Next

After running this migration:
- Backend API endpoints will be created (Phase 3)
- Migration script will parse your existing .md prompts (Phase 9)
- Vue portal will connect to these tables

## Tables Created

### `prompts`
Main prompt registry with name, description, category, and base prompt flag.

### `prompt_versions`
Structured JSON content by section:
- role
- personality
- lead_context
- broker_context
- conversation_flow
- tools
- objection_handling
- safety
- compliance

### `broker_prompt_assignments`
Links brokers to prompts with custom variables (broker name, NMLS, company, etc.)

### RLS Policies
- Admins: Full access to everything
- Brokers: Read-only prompts, can update own custom variables
- Brokers: See only their own leads and interactions

