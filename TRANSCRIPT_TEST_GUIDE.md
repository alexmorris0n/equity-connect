# Testing Transcript Capture - Verification Guide

## Quick Verification Checklist

After deploying Barbara v3 with transcript capture, verify it's working:

### ✅ Step 1: Check Logs During Call

When Barbara is on a call, watch for these log entries:

```bash
fly logs --app barbara-v3-voice
```

**Expected Output:**
```
📝 Session ID: session-1730123456789-abc123def
💬 Barbara: "Equity Connect, Barbara speaking. How are you today?"
💬 User: "Hi, I'm calling about the letter I received"
💬 Barbara: "Wonderful! Let me pull up your information real quick."
💬 User: "Okay"
...
💾 Saving interaction for lead: uuid-here
📝 Retrieved transcript with 12 messages
✅ Interaction saved: uuid (24 metadata fields)
🧹 Cleaned up transcript for session: session-1730123456789-abc123def
```

**Key Indicators:**
- ✅ `📝 Session ID:` appears when call starts
- ✅ `💬 Barbara:` appears when Barbara speaks
- ✅ `💬 User:` appears when user speaks
- ✅ `Retrieved transcript with N messages` (N should be > 0)
- ✅ `🧹 Cleaned up transcript` when call ends

---

### ✅ Step 2: Verify in Supabase

#### Option A: Quick Check (Supabase Dashboard)

1. Go to Supabase Dashboard → Table Editor
2. Select `interactions` table
3. Find recent calls
4. Click on `metadata` column
5. Look for `conversation_transcript` array

**Should see:**
```json
{
  "ai_agent": "barbara",
  "version": "3.0",
  "conversation_transcript": [
    {
      "role": "assistant",
      "content": "Equity Connect, Barbara speaking...",
      "timestamp": "2025-10-27T10:15:23.456Z"
    },
    {
      "role": "user",
      "content": "Hi, I'm calling about...",
      "timestamp": "2025-10-27T10:15:26.789Z"
    }
  ]
}
```

#### Option B: SQL Query

```sql
-- Get latest 5 calls with transcript info
SELECT 
  id,
  lead_id,
  outcome,
  duration_seconds,
  created_at,
  metadata->>'ai_agent' as agent,
  metadata->>'version' as version,
  jsonb_array_length(metadata->'conversation_transcript') as message_count
FROM interactions
WHERE metadata->'conversation_transcript' IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
```
id                | lead_id           | outcome            | message_count
------------------|-------------------|--------------------|--------------
uuid-123          | uuid-456          | appointment_booked | 14
uuid-789          | uuid-abc          | positive           | 8
```

---

### ✅ Step 3: Detailed Transcript Check

```sql
-- View full transcript for a specific call
SELECT 
  id,
  lead_id,
  outcome,
  jsonb_pretty(metadata->'conversation_transcript') as transcript
FROM interactions
WHERE id = 'your-call-id-here';
```

**Expected Output:**
```json
[
  {
    "role": "assistant",
    "content": "Equity Connect, Barbara speaking. How are you today?",
    "timestamp": "2025-10-27T10:15:23.456Z"
  },
  {
    "role": "user",
    "content": "Hi, I got your letter about my home equity",
    "timestamp": "2025-10-27T10:15:26.789Z"
  },
  {
    "role": "assistant",
    "content": "Wonderful! Let me pull up your information real quick.",
    "timestamp": "2025-10-27T10:15:28.123Z"
  }
  // ... more messages
]
```

---

### ✅ Step 4: Validate Both Sides of Conversation

```sql
-- Check that both user and assistant messages are captured
WITH transcript_messages AS (
  SELECT 
    id,
    jsonb_array_elements(metadata->'conversation_transcript') as message
  FROM interactions
  WHERE created_at >= NOW() - INTERVAL '1 day'
    AND metadata->'conversation_transcript' IS NOT NULL
  LIMIT 100
)
SELECT 
  message->>'role' as role,
  COUNT(*) as count
FROM transcript_messages
GROUP BY message->>'role';
```

**Expected Result:**
```
role      | count
----------|------
user      | 45
assistant | 52
```

Both roles should have counts (not just one side).

---

## Common Issues & Fixes

### ❌ Issue: "Retrieved transcript with 0 messages"

**Possible Causes:**
1. `save_interaction` called before conversation starts
2. Events not firing
3. Session ID mismatch

**Debug Steps:**
```bash
# Watch logs during call
fly logs --app barbara-v3-voice --follow

# Look for these patterns:
# - Are 💬 messages appearing during the call?
# - Is session ID consistent throughout?
# - Is save_interaction happening at the END?
```

**Fix:**
- Ensure Barbara's prompt calls `save_interaction` at the end of call (after conversation)
- Check if `RESPONSE_DONE` and `TRANSCRIPTION_COMPLETED` events are firing

---

### ❌ Issue: "Only seeing Barbara's words"

**Possible Causes:**
1. User transcription events not firing
2. OpenAI not returning user transcripts

**Debug:**
```bash
# Look specifically for user messages
fly logs --app barbara-v3-voice | grep "💬 User:"
```

**Fix:**
- Check if `TRANSCRIPTION_COMPLETED` event includes `.transcript` field
- Verify OpenAI Realtime API is configured for transcriptions
- Check audio format settings (g711_ulaw vs pcm16)

---

### ❌ Issue: "conversation_transcript is null"

**Possible Causes:**
1. `getCurrentTranscript()` returning null
2. Session not registered in store
3. Transcript cleared before save

**Debug:**
```javascript
// Add this log in save-interaction.tool.ts (line 37)
logger.info(`Session transcript: ${JSON.stringify(conversationTranscript)}`);
```

**Fix:**
- Verify `setTranscript()` is called early in streaming.ts
- Check if session ID is being set correctly
- Ensure cleanup isn't happening too early

---

## Manual Test Procedure

### 1. Make a Test Call

**Option A: Inbound Call**
- Call one of Barbara's SignalWire numbers
- Have a short conversation
- Let Barbara call `save_interaction`

**Option B: Trigger Outbound Call**
```bash
curl -X POST https://barbara-v3-voice.fly.dev/api/trigger-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+15555551234",
    "from": "+14244851544",
    "lead_id": "uuid-here",
    "broker_id": "uuid-here"
  }'
```

### 2. Watch Logs Live

```bash
fly logs --app barbara-v3-voice --follow
```

### 3. Check Supabase Immediately

```sql
SELECT * FROM interactions 
ORDER BY created_at DESC 
LIMIT 1;
```

### 4. Verify Transcript Structure

```sql
SELECT 
  metadata->'conversation_transcript'->0 as first_message,
  metadata->'conversation_transcript'->1 as second_message
FROM interactions
ORDER BY created_at DESC
LIMIT 1;
```

Should show:
```json
first_message: {"role": "assistant", "content": "...", "timestamp": "..."}
second_message: {"role": "user", "content": "...", "timestamp": "..."}
```

---

## Performance Metrics

After 10 test calls, verify:

### Storage Impact
```sql
SELECT 
  AVG(pg_column_size(metadata)) as avg_metadata_size_bytes,
  AVG(jsonb_array_length(metadata->'conversation_transcript')) as avg_messages
FROM interactions
WHERE created_at >= NOW() - INTERVAL '1 hour'
  AND metadata->'conversation_transcript' IS NOT NULL;
```

**Expected:**
- Average metadata size: 2-5 KB
- Average messages: 6-15

### Memory/CPU (from Fly.io)
```bash
fly status --app barbara-v3-voice
```

Should show NO increase in memory usage (transcript stored in DB, not memory long-term).

---

## Success Criteria ✅

You can consider transcript capture working if:

1. ✅ Logs show `💬 Barbara:` and `💬 User:` during calls
2. ✅ `Retrieved transcript with N messages` where N > 0
3. ✅ Supabase shows `conversation_transcript` array with both roles
4. ✅ Timestamps are sequential and match call duration
5. ✅ Cleanup logs (`🧹`) appear when calls end
6. ✅ No errors in Fly logs related to transcript storage

---

## Next Steps After Verification

Once transcripts are confirmed working:

1. **Deploy Call Evaluation System**
   - Create `call_evaluations` table
   - Build GPT-4o-mini evaluation function
   - Link to prompt versions

2. **Add Analytics Queries**
   - Average call duration
   - Common opening phrases
   - Booking patterns

3. **Enable A/B Testing**
   - Compare prompt versions using transcript data
   - Measure which prompts lead to better outcomes

---

## Quick Test Command

Run this after your next call to verify everything:

```sql
-- One-liner verification
SELECT 
  CASE 
    WHEN COUNT(*) > 0 AND MIN(jsonb_array_length(metadata->'conversation_transcript')) > 0 
    THEN '✅ TRANSCRIPT CAPTURE WORKING!'
    ELSE '❌ No transcripts found'
  END as status
FROM interactions
WHERE created_at >= NOW() - INTERVAL '5 minutes'
  AND metadata->'conversation_transcript' IS NOT NULL;
```

**Expected:** `✅ TRANSCRIPT CAPTURE WORKING!`

