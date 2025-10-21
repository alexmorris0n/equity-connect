# Call Transcript Logging - Complete Guide

## ✅ How Transcripts Are Captured

### Real-Time Transcription

**OpenAI Realtime API automatically transcribes:**
- 👤 Everything the user says (via Whisper)
- 🤖 Everything Barbara says (via TTS transcript)

### Transcript Storage (In Memory During Call)

**File:** `bridge/audio-bridge.js`

```javascript
// Initialize at call start
this.conversationTranscript = [];
this.callStartTime = Date.now();

// As user speaks
this.conversationTranscript.push({
  role: 'user',
  text: 'I need money for my husband's surgery',
  timestamp: '2025-10-21T14:32:15.123Z'
});

// As Barbara speaks
this.conversationTranscript.push({
  role: 'assistant',
  text: 'I understand. That sounds like an important need. How much do you need?',
  timestamp: '2025-10-21T14:32:18.456Z'
});
```

---

## Complete Conversation Transcript Structure

```javascript
conversationTranscript = [
  {
    role: 'assistant',
    text: 'Hi John, this is Barbara - how are you doing today?',
    timestamp: '2025-10-21T14:30:00.000Z'
  },
  {
    role: 'user',
    text: 'I'm doing okay, thanks.',
    timestamp: '2025-10-21T14:30:03.120Z'
  },
  {
    role: 'assistant',
    text: 'Wonderful! What got you interested in learning more about reverse mortgages?',
    timestamp: '2025-10-21T14:30:05.300Z'
  },
  {
    role: 'user',
    text: 'My husband needs heart surgery and we need about $75,000.',
    timestamp: '2025-10-21T14:30:12.450Z'
  },
  {
    role: 'assistant',
    text: 'I understand. That sounds urgent. Can I ask you a few questions to make sure this is a good fit?',
    timestamp: '2025-10-21T14:30:18.600Z'
  },
  // ... continues for entire call
]
```

---

## Saved to Database

### When Call Ends

**Barbara calls:**
```javascript
save_interaction({
  lead_id: "abc-123",
  broker_id: "broker-456",
  duration_seconds: 180,
  outcome: "appointment_booked",
  content: "Lead interested in reverse mortgage for medical expenses",
  
  transcript: this.conversationTranscript,  // ← Full conversation!
  
  metadata: {
    money_purpose: "medical",
    specific_need: "Husband needs surgery - $75k",
    // ... other metadata
  }
})
```

### Stored in Supabase

```sql
INSERT INTO interactions (
  lead_id,
  broker_id,
  duration_seconds,
  outcome,
  content,
  metadata
)
VALUES (
  'abc-123',
  'broker-456',
  180,
  'appointment_booked',
  'Lead interested in reverse mortgage for medical expenses',
  '{
    "ai_agent": "barbara",
    "version": "2.0",
    "conversation_transcript": [
      {
        "role": "assistant",
        "text": "Hi John, this is Barbara...",
        "timestamp": "2025-10-21T14:30:00.000Z"
      },
      {
        "role": "user",
        "text": "I'm doing okay, thanks.",
        "timestamp": "2025-10-21T14:30:03.120Z"
      }
      // ... full conversation
    ],
    "money_purpose": "medical",
    "specific_need": "Husband needs surgery - $75k"
  }'
);
```

---

## Use Cases for Transcripts

### 1. Quality Monitoring
```sql
-- Get all conversations mentioning specific topics
SELECT 
  lead_id,
  created_at,
  metadata->'conversation_transcript' as transcript
FROM interactions
WHERE metadata->'conversation_transcript'::text ILIKE '%surgery%';
```

### 2. Training Data
- Review successful calls (appointment_booked)
- Identify what Barbara said that worked
- Train new versions

### 3. Compliance Auditing
- Verify Barbara followed scripts
- Check for TCPA compliance
- Review objection handling

### 4. Dispute Resolution
- Lead says "Barbara promised X"
- Pull transcript to verify
- Clear accountability

### 5. Context for Human Takeover
- Lead asks for human
- Agent reads transcript
- Picks up exactly where Barbara left off

---

## Querying Transcripts

### Get Full Transcript
```sql
SELECT 
  lead_id,
  broker_id,
  created_at,
  outcome,
  jsonb_pretty(metadata->'conversation_transcript') as transcript
FROM interactions
WHERE lead_id = 'abc-123'
ORDER BY created_at DESC
LIMIT 1;
```

### Search for Specific Phrases
```sql
SELECT 
  lead_id,
  created_at,
  elem->>'text' as said,
  elem->>'role' as speaker
FROM interactions,
  jsonb_array_elements(metadata->'conversation_transcript') elem
WHERE elem->>'text' ILIKE '%heart surgery%';
```

### Count User Interruptions
```sql
SELECT 
  lead_id,
  jsonb_array_length(
    jsonb_path_query_array(
      metadata->'conversation_transcript',
      '$[*] ? (@.role == "user")'
    )
  ) as user_utterances
FROM interactions
WHERE outcome = 'appointment_booked';
```

### Find Calls Where User Asked About Fees
```sql
SELECT *
FROM interactions
WHERE metadata->'conversation_transcript'::text ILIKE '%fees%'
  OR metadata->'conversation_transcript'::text ILIKE '%cost%';
```

---

## Transcript Analytics

### Average Call Length by Outcome
```sql
SELECT 
  outcome,
  AVG(duration_seconds) as avg_duration,
  AVG(jsonb_array_length(metadata->'conversation_transcript')) as avg_turns
FROM interactions
WHERE metadata ? 'conversation_transcript'
GROUP BY outcome;
```

### Most Common User Questions
```sql
SELECT 
  elem->>'text' as question,
  COUNT(*) as frequency
FROM interactions,
  jsonb_array_elements(metadata->'conversation_transcript') elem
WHERE elem->>'role' = 'user'
  AND elem->>'text' LIKE '%?%'
GROUP BY elem->>'text'
ORDER BY frequency DESC
LIMIT 20;
```

---

## Privacy & Compliance

### TCPA Compliance
- ✅ Full transcript proves consent was obtained
- ✅ Can show lead agreed to appointment
- ✅ Audit trail for call recording disclosure

### Data Retention
```sql
-- Auto-delete transcripts after 90 days (compliance)
DELETE FROM interactions
WHERE created_at < NOW() - INTERVAL '90 days'
  AND metadata ? 'conversation_transcript';
```

### Redaction (If Needed)
```sql
-- Remove sensitive data from transcripts
UPDATE interactions
SET metadata = metadata - 'conversation_transcript'
WHERE lead_id = 'abc-123'
  AND created_at < NOW() - INTERVAL '30 days';
```

---

## What's Now Complete

### ✅ Capture
- User speech transcribed (Whisper)
- Barbara speech transcribed (OpenAI TTS)
- Stored in memory during call

### ✅ Storage
- `conversationTranscript` array built in real-time
- Passed to `save_interaction()` at end of call
- Saved to `interactions.metadata.conversation_transcript`

### ✅ Retrieval
- Can query full transcripts
- Can search specific phrases
- Can analyze conversation patterns

---

## Example Full Transcript

```json
{
  "conversation_transcript": [
    {
      "role": "assistant",
      "text": "Hi John, this is Barbara - how are you doing today?",
      "timestamp": "2025-10-21T14:30:00.000Z"
    },
    {
      "role": "user",
      "text": "I'm doing okay, thanks.",
      "timestamp": "2025-10-21T14:30:03.120Z"
    },
    {
      "role": "assistant",
      "text": "Wonderful! What got you interested in learning more about reverse mortgages?",
      "timestamp": "2025-10-21T14:30:05.300Z"
    },
    {
      "role": "user",
      "text": "My husband needs heart surgery and we need about seventy five thousand dollars.",
      "timestamp": "2025-10-21T14:30:12.450Z"
    },
    {
      "role": "assistant",
      "text": "I understand. That sounds like an important need. Can I ask you a few questions to make sure this is a good fit?",
      "timestamp": "2025-10-21T14:30:18.600Z"
    },
    {
      "role": "user",
      "text": "Sure, go ahead.",
      "timestamp": "2025-10-21T14:30:21.200Z"
    }
    // ... continues for entire call
  ]
}
```

---

## Files Updated

1. ✅ `bridge/audio-bridge.js` - Tracks transcript in real-time
2. ✅ `bridge/tools.js` - Saves transcript to metadata
3. ✅ `database/migrations/20251021_interaction_metadata_schema.sql` - Documents schema

**Full conversation transcripts are now captured and saved!** 📝✨

---

## Summary

**✅ Transcripts are automatically:**
- Captured in real-time (user + Barbara)
- Stored in memory during call
- Saved to database at end of call
- Stored in `metadata.conversation_transcript`
- Queryable for analytics, compliance, quality

**No additional work needed - it's automatic!** 🎯
