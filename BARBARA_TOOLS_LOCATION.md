# Barbara's Tools - Where They Live

## Location: `bridge/tools.js`

All of Barbara's tools live in a single file: **`bridge/tools.js`**

---

## Tool Structure

### 1. Tool Definitions (Lines 36-262)
**What:** OpenAI-compatible function definitions
**Format:** JSON schema with name, description, parameters

```javascript
const toolDefinitions = [
  {
    type: 'function',
    name: 'check_broker_availability',
    description: 'Check broker calendar availability...',
    parameters: { ... }
  },
  {
    type: 'function',
    name: 'book_appointment',
    description: 'Book an appointment...',
    parameters: { ... }
  },
  // ... etc
]
```

### 2. Tool Functions (Throughout File)
**What:** Actual implementation of each tool

**Lines:**
- `updateLeadInfo` - Line 353
- `checkBrokerAvailability` - Line 449
- `bookAppointment` - Line 724
- `assignTrackingNumber` - Line 889
- `saveInteraction` - Line 939

### 3. Tool Executor (Bottom of File)
**What:** Router that calls the right function based on tool name

```javascript
async function executeTool(toolName, args) {
  switch (toolName) {
    case 'check_broker_availability':
      return await checkBrokerAvailability(args);
    case 'book_appointment':
      return await bookAppointment(args);
    // ... etc
  }
}
```

### 4. Exports (Line 1078-1082)
```javascript
module.exports = {
  toolDefinitions,  // For Barbara to know what tools exist
  executeTool,      // For Barbara to call the tools
  initSupabase      // Helper for database access
};
```

---

## Calendar/Booking Tools in Detail

### 1. `check_broker_availability`
**Definition:** Lines 144-169
**Implementation:** Lines 449-542
**What it does:**
- Calls Nylas Free/Busy API
- Gets broker's busy times
- Calculates available slots
- Returns smart prioritized suggestions (today > tomorrow > next week)

### 2. `book_appointment`
**Definition:** Lines 170-197
**Implementation:** Lines 724-887
**What it does:**
- Creates Nylas calendar event
- Sends calendar invite to lead (if email exists)
- Updates lead record in Supabase
- Creates interaction record
- Creates billing event

### 3. `update_lead_info`
**Definition:** Lines 85-143
**Implementation:** Lines 353-447
**What it does:**
- Updates lead record in Supabase
- Can update: phone, email, last_name, city, age, property_value, etc.
- Used during contact verification

### 4. `assign_tracking_number`
**Definition:** Lines 198-225
**Implementation:** Lines 889-937
**What it does:**
- Assigns SignalWire number to lead/broker pair
- Enables call tracking for billing verification
- Creates tracking record in database

### 5. `save_interaction`
**Definition:** Lines 226-262
**Implementation:** Lines 939-1039
**What it does:**
- Saves call details to database
- Stores metadata (money_purpose, objections, questions_asked)
- Used for context in future calls

---

## How Barbara Uses These Tools

### Flow:

1. **Barbara's AI receives tool definitions** from `toolDefinitions`
2. **Barbara decides which tool to call** based on conversation
3. **Barbara sends tool call** with tool name + arguments
4. **Bridge receives tool call** and routes to `executeTool()`
5. **executeTool() calls the right function** (e.g., `checkBrokerAvailability()`)
6. **Function executes** (calls Nylas API, updates database, etc.)
7. **Result returns to Barbara** who speaks it to the lead

### Example:

```
Lead: "Can we schedule for Tuesday?"

Barbara (thinking): I need to check availability
Barbara (calls tool): check_broker_availability({
  broker_id: "uuid",
  preferred_day: "tuesday",
  preferred_time: "morning"
})

Bridge executes: checkBrokerAvailability() -> calls Nylas API
Nylas returns: Busy times
Function calculates: Available slots
Returns to Barbara: {
  available_slots: [...],
  message: "I have 2 slots available tomorrow. The earliest is 10:00 AM."
}

Barbara (speaks): "Let me check what's available... I have 2 slots available tomorrow. The earliest is 10:00 AM. Does that work?"
```

---

## File Organization

```
bridge/
├── tools.js                 ← ALL TOOLS LIVE HERE
│   ├── toolDefinitions      (Lines 36-262)
│   ├── Tool Functions       (Lines 353-1039)
│   │   ├── updateLeadInfo           (353)
│   │   ├── checkBrokerAvailability  (449)
│   │   ├── bookAppointment          (724)
│   │   ├── assignTrackingNumber     (889)
│   │   └── saveInteraction          (939)
│   ├── executeTool          (Lines 1041-1076)
│   └── module.exports       (Lines 1078-1082)
│
├── audio-bridge.js          ← Uses tools.js
│   └── Imports: toolDefinitions, executeTool
│
└── other files...
```

---

## Key Points

**Single Source of Truth:**
- ✅ All tools in ONE file: `bridge/tools.js`
- ✅ Easy to maintain
- ✅ Easy to add new tools

**Nylas Integration:**
- ✅ `checkBrokerAvailability` calls Nylas Free/Busy API
- ✅ `bookAppointment` calls Nylas Events API
- ✅ Both use `NYLAS_API_KEY` from environment

**Database Integration:**
- ✅ All tools use Supabase client
- ✅ Updates brokers, leads, interactions, billing tables

**Barbara's Access:**
- ✅ Barbara sees all tools via `toolDefinitions`
- ✅ Barbara calls tools via OpenAI function calling
- ✅ Bridge executes via `executeTool()`

**Everything Barbara needs is in `bridge/tools.js`!** 🎯
