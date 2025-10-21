# Live Transcript Streaming with Supabase Realtime

## ✅ Yes - Supabase Has Realtime!

You can stream live transcripts as Barbara speaks.

---

## How It Works

### Architecture:

```
Barbara Call
    ↓
User speaks → OpenAI Whisper → Transcript
    ↓
Barbara speaks → OpenAI TTS → Transcript
    ↓
Bridge saves to Supabase
    ↓
Supabase Realtime broadcasts
    ↓
Dashboard updates in real-time
```

---

## Two Approaches

### Approach 1: Stream to `interactions` Table (Simple)

**Pros:**
- ✅ Uses existing table
- ✅ Simple setup
- ✅ Data persists automatically

**Cons:**
- ❌ Only updates when call ends (not truly live during call)
- ❌ Can't stream partial transcripts during call

### Approach 2: New `live_transcripts` Table (Recommended)

**Pros:**
- ✅ Real-time streaming during call
- ✅ Updates as each sentence spoken
- ✅ Dashboard shows live conversation
- ✅ Can delete after call ends (keeps DB clean)

**Cons:**
- ❌ Requires new table
- ❌ More complex setup

---

## Recommended Implementation

### Step 1: Create `live_transcripts` Table

```sql
CREATE TABLE live_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id),
  broker_id UUID REFERENCES brokers(id),
  role TEXT CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  sequence_number INTEGER,  -- Order of utterances
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by call
CREATE INDEX idx_live_transcripts_call_id ON live_transcripts(call_id, sequence_number);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE live_transcripts;
```

### Step 2: Update `audio-bridge.js` to Stream

**When user speaks:**
```javascript
case 'conversation.item.input_audio_transcription.completed':
  const userTranscript = event.transcript;
  
  // Save to in-memory array (as before)
  this.conversationTranscript.push({
    role: 'user',
    text: userTranscript,
    timestamp: new Date().toISOString()
  });
  
  // Stream to Supabase for live viewing
  if (this.callId && userTranscript) {
    const sb = require('./tools').initSupabase();
    await sb.from('live_transcripts').insert({
      call_id: this.callId,
      lead_id: this.leadId,
      broker_id: this.brokerId,
      role: 'user',
      text: userTranscript,
      sequence_number: this.conversationTranscript.length
    });
  }
  break;
```

**When Barbara speaks:**
```javascript
case 'response.audio_transcript.done':
  const barbaraTranscript = this.currentResponseTranscript || event.transcript || '';
  
  // Save to in-memory array (as before)
  this.conversationTranscript.push({
    role: 'assistant',
    text: barbaraTranscript,
    timestamp: new Date().toISOString()
  });
  
  // Stream to Supabase for live viewing
  if (this.callId && barbaraTranscript) {
    const sb = require('./tools').initSupabase();
    await sb.from('live_transcripts').insert({
      call_id: this.callId,
      lead_id: this.leadId,
      broker_id: this.brokerId,
      role: 'assistant',
      text: barbaraTranscript,
      sequence_number: this.conversationTranscript.length
    });
  }
  
  this.currentResponseTranscript = '';
  break;
```

### Step 3: Dashboard Subscribes to Realtime

**Vue/React Dashboard:**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Subscribe to live transcripts for this call
const subscription = supabase
  .channel('live-call-transcripts')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'live_transcripts',
      filter: `call_id=eq.${callId}`
    },
    (payload) => {
      const newUtterance = payload.new;
      
      // Update UI in real-time
      if (newUtterance.role === 'user') {
        addToTranscript(`User: ${newUtterance.text}`);
      } else {
        addToTranscript(`Barbara: ${newUtterance.text}`);
      }
    }
  )
  .subscribe()

// Cleanup when call ends
subscription.unsubscribe()
```

### Step 4: Cleanup After Call Ends

**When call ends, delete live transcript rows:**
```javascript
// In cleanup() method or when save_interaction is called
const sb = require('./tools').initSupabase();
await sb.from('live_transcripts')
  .delete()
  .eq('call_id', this.callId);
```

**Permanent transcript is saved in `interactions.metadata.conversation_transcript`**

---

## Dashboard UI Example

### Live Call Monitor
```
┌────────────────────────────────────────────┐
│  🔴 LIVE CALL: John Smith                 │
│  Duration: 2:34                            │
│  Broker: Walter Richards                   │
├────────────────────────────────────────────┤
│                                            │
│  Barbara: Hi John, this is Barbara -       │
│           how are you doing today?         │
│                                            │
│  John:    I'm doing okay, thanks.          │
│                                            │
│  Barbara: Wonderful! What got you          │
│           interested in learning more?     │
│                                            │
│  John:    My husband needs surgery.        │
│                                            │
│  Barbara: I understand. That sounds        │
│           important. Can I ask you a       │
│           few questions?                   │
│                                            │
│  John:    Sure, go ahead.                  │
│                                            │
│  ⏳ Barbara is typing...                   │
│                                            │
└────────────────────────────────────────────┘
```

**Updates in real-time as conversation happens!**

---

## Alternative: Lighter Approach (No New Table)

If you don't want a new table, you could:

### Option A: Store in-progress transcript in `metadata` field

**Create temporary record:**
```javascript
// At call start
await sb.from('interactions').insert({
  id: callId,
  lead_id: leadId,
  broker_id: brokerId,
  type: 'ai_call',
  direction: 'outbound',
  outcome: 'in_progress',  // Mark as in-progress
  metadata: {
    conversation_transcript: [],
    call_status: 'active'
  }
});

// During call, update transcript
await sb.from('interactions')
  .update({
    metadata: {
      conversation_transcript: this.conversationTranscript,
      call_status: 'active'
    }
  })
  .eq('id', callId);

// At call end, finalize
await sb.from('interactions')
  .update({
    outcome: 'appointment_booked',
    duration_seconds: duration,
    metadata: {
      conversation_transcript: this.conversationTranscript,
      call_status: 'completed',
      // ... other metadata
    }
  })
  .eq('id', callId);
```

**Dashboard subscribes:**
```javascript
supabase
  .channel('live-calls')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'interactions',
      filter: `outcome=eq.in_progress`
    },
    (payload) => {
      updateTranscriptDisplay(payload.new.metadata.conversation_transcript);
    }
  )
  .subscribe()
```

---

## Comparison

### Separate `live_transcripts` Table:
**Pros:**
- ✅ Fast inserts (small records)
- ✅ True real-time (insert per utterance)
- ✅ Clean (delete after call)
- ✅ No update conflicts

**Cons:**
- ❌ New table to maintain
- ❌ More complex cleanup

### Update `interactions` Record:
**Pros:**
- ✅ No new table
- ✅ Uses existing structure
- ✅ Simple cleanup (just set outcome)

**Cons:**
- ❌ Updating large JSONB repeatedly (slower)
- ❌ Potential update conflicts
- ❌ More database load

---

## My Recommendation

### For MVP/Testing:
**Use `interactions` table with updates**
- Simpler to implement
- No new migrations
- Good enough for monitoring 5-10 concurrent calls

### For Production:
**Use dedicated `live_transcripts` table**
- Cleaner architecture
- Better performance at scale
- Handles 100+ concurrent calls

---

## Supabase Realtime Setup

### Enable Realtime on Table

```sql
-- For interactions table approach
ALTER PUBLICATION supabase_realtime ADD TABLE interactions;

-- OR for dedicated table approach
ALTER PUBLICATION supabase_realtime ADD TABLE live_transcripts;
```

### Client Subscription (Frontend)

```javascript
const supabase = createClient(url, key, {
  realtime: {
    params: {
      eventsPerSecond: 10  // Rate limit for updates
    }
  }
})

// Subscribe
const channel = supabase
  .channel('live-calls')
  .on('postgres_changes', { ... }, (payload) => {
    // Update UI
  })
  .subscribe()
```

---

## What You Get

**Live call monitoring dashboard showing:**
- 📞 Active calls in progress
- 💬 Real-time transcript as conversation happens
- ⏱️ Call duration
- 🎯 Detected intent (medical, home repair, etc.)
- 🚫 Objections raised
- ✅ Appointment status

**Updates live as Barbara talks!** 

**Want me to implement the `live_transcripts` table approach or the simpler `interactions` update approach?** 🎯
