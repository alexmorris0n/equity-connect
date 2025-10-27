# Apply Voice Selection Migration

## Step 1: Run the SQL Migration in Supabase

1. Open your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `022_add_voice_to_prompts.sql`
4. Paste and run the query

This will:
- Add a `voice` column to the `prompts` table with default value 'alloy'
- Add a constraint to ensure only valid voices are used
- Create an index for voice queries
- Update existing prompts to use the default voice

## Step 2: Verify Migration

Run this SQL to verify:

```sql
-- Check the voice column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'prompts'
AND column_name = 'voice';

-- Check existing prompts have the default voice
SELECT name, voice
FROM prompts;
```

## Step 3: Test in the Portal

1. Refresh your browser (Ctrl + Shift + R)
2. Navigate to Prompt Management
3. Select a prompt
4. Click the **Settings** tab
5. Select a voice from the dropdown
6. The voice should save automatically and show a success message

## Available Voices

- alloy (default)
- echo
- shimmer
- ash
- ballad
- coral
- sage
- verse
- cedar
- marin

These match the OpenAI Realtime API voices.

