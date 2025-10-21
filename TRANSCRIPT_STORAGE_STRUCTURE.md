# Transcript Storage Structure

## Where Transcripts Are Saved

### ✅ **Saved to `interactions` Table**

**Not in leads table!** Each call is a separate interaction record.

---

## Database Structure

### `interactions` Table
```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),      -- Links to lead
  broker_id UUID REFERENCES brokers(id),  -- Links to broker
  type interaction_type,                  -- 'ai_call'
  direction TEXT,                         -- 'inbound' or 'outbound'
  content TEXT,                           -- Brief summary
  duration_seconds INTEGER,
  outcome TEXT,                           -- 'appointment_booked', 'interested', etc.
  recording_url TEXT,                     -- Audio recording URL (if available)
  metadata JSONB,                         -- ⭐ TRANSCRIPT LIVES HERE!
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `metadata` Column Contains Everything
```json
{
  "ai_agent": "barbara",
  "version": "2.0",
  
  "conversation_transcript": [           // ← Full transcript array
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
  "specific_need": "Husband needs surgery - $75k",
  "objections": ["fees_concern"],
  // ... other metadata
}
```

---

## Why `interactions` Table (Not `leads`)?

### Leads Table = Current State
```sql
SELECT * FROM leads WHERE id = 'abc-123';

{
  id: 'abc-123',
  first_name: 'John',
  last_name: 'Smith',
  primary_email: 'john@example.com',
  status: 'appointment_set',         -- Current status
  last_contact: '2025-10-21T14:35:00Z',  -- When last contacted
  interaction_count: 3               -- Total calls
}
```

### Interactions Table = Full History
```sql
SELECT * FROM interactions WHERE lead_id = 'abc-123' ORDER BY created_at DESC;

[
  {
    id: 'interaction-3',
    lead_id: 'abc-123',
    created_at: '2025-10-21T14:30:00Z',
    outcome: 'appointment_booked',
    metadata: {
      conversation_transcript: [ ... ],  -- Full call 3 transcript
      money_purpose: 'medical'
    }
  },
  {
    id: 'interaction-2',
    lead_id: 'abc-123',
    created_at: '2025-10-18T10:15:00Z',
    outcome: 'interested',
    metadata: {
      conversation_transcript: [ ... ],  -- Full call 2 transcript
      objections: ['fees_concern']
    }
  },
  {
    id: 'interaction-1',
    lead_id: 'abc-123',
    created_at: '2025-10-15T09:00:00Z',
    outcome: 'callback_requested',
    metadata: {
      conversation_transcript: [ ... ]   -- Full call 1 transcript
    }
  }
]
```

---

## Relationship Diagram

```
┌─────────────────────┐
│  leads              │
│  id: abc-123        │  (Current state)
│  first_name: John   │
│  status: contacted  │
│  interaction_count: 3│
└──────────┬──────────┘
           │
           │ One lead → Many interactions
           │
           ▼
┌─────────────────────────────────────────┐
│  interactions                           │
├─────────────────────────────────────────┤
│  Call 1 (Oct 15)                        │
│  - outcome: callback_requested          │
│  - transcript: [...]                    │
│  - metadata: { objections: [] }         │
├─────────────────────────────────────────┤
│  Call 2 (Oct 18)                        │
│  - outcome: interested                  │
│  - transcript: [...]                    │
│  - metadata: { objections: ['fees'] }   │
├─────────────────────────────────────────┤
│  Call 3 (Oct 21)                        │
│  - outcome: appointment_booked          │
│  - transcript: [...]                    │
│  - metadata: { appointment: true }      │
└─────────────────────────────────────────┘
```

---

## How Barbara Uses This

### When Call Starts:
**Barbara calls:**
```javascript
get_lead_context({ phone: "+16505300051" })
```

**Returns:**
```javascript
{
  lead_id: 'abc-123',
  first_name: 'John',
  // ... lead data
  
  last_call: {
    // Metadata from most recent interaction
    money_purpose: 'medical',
    objections: ['fees_concern'],
    // Does NOT include full transcript (too big for injection)
  }
}
```

**Barbara gets:**
- ✅ Lead's current state (from leads table)
- ✅ Last call's metadata (from last interaction)
- ❌ **Not** full transcript (too big, not needed for conversation)

### If Human Agent Needs Transcript:
```sql
-- Query full conversation history
SELECT 
  created_at,
  outcome,
  duration_seconds,
  metadata->'conversation_transcript' as transcript
FROM interactions
WHERE lead_id = 'abc-123'
ORDER BY created_at DESC;
```

---

## Storage Benefits

### Separate `interactions` Table:
✅ **History preserved** - Every call logged separately
✅ **Scalable** - Can store millions of interactions
✅ **Queryable** - Easy to search transcripts
✅ **Auditable** - Full compliance trail
✅ **Analyzable** - Trends over time

### vs. Storing in `leads`:
❌ Only stores last call (loses history)
❌ Bloats leads table (huge JSONB)
❌ Hard to query (all transcripts in one field)
❌ No audit trail

---

## Real-World Example

### Lead John Smith has 3 calls:

**leads table (current state):**
```json
{
  id: 'abc-123',
  first_name: 'John',
  status: 'appointment_set',
  interaction_count: 3
}
```

**interactions table (full history):**
```json
[
  {
    id: 'int-1',
    lead_id: 'abc-123',
    created_at: '2025-10-15',
    outcome: 'callback_requested',
    metadata: {
      conversation_transcript: [
        { role: 'assistant', text: '...', timestamp: '...' },
        { role: 'user', text: '...', timestamp: '...' }
      ],
      money_purpose: 'medical'
    }
  },
  {
    id: 'int-2',
    lead_id: 'abc-123',
    created_at: '2025-10-18',
    outcome: 'interested',
    metadata: {
      conversation_transcript: [ ... ],
      objections: ['fees_concern']
    }
  },
  {
    id: 'int-3',
    lead_id: 'abc-123',
    created_at: '2025-10-21',
    outcome: 'appointment_booked',
    metadata: {
      conversation_transcript: [ ... ],
      appointment_scheduled: true
    }
  }
]
```

---

## Summary

**Transcripts are saved to `interactions` table, NOT `leads` table.**

**Why:**
- ✅ Preserves full history (multiple calls)
- ✅ Keeps leads table lean (current state only)
- ✅ Easy to query specific calls
- ✅ Scalable and performant

**Each call = One row in `interactions` with full transcript in metadata!** 📊

**Structure:**
- `leads` = Who they are (current state)
- `interactions` = What they said (full history)

🎯
