# Barbara MCP - Nylas Tools Added

## ✅ What Was Added

Added 3 new Nylas/calendar tools to Barbara MCP so n8n can use them directly:

### 1. `check_broker_availability`
**What it does:** Checks broker calendar using Nylas Free/Busy API
**Parameters:**
- `broker_id` (required)
- `preferred_day` (optional): monday, tuesday, wednesday, thursday, friday, any
- `preferred_time` (optional): morning, afternoon, any

**Returns:**
- Available slots for next 14 days
- Smart prioritization (today > tomorrow > next week)
- Business hours: 10 AM - 5 PM, 2-hour minimum notice

### 2. `book_appointment`
**What it does:** Books appointment using Nylas Events API
**Parameters:**
- `lead_id` (required)
- `broker_id` (required)
- `scheduled_for` (required): ISO 8601 format (e.g., "2025-10-22T10:00:00Z")
- `notes` (optional): Notes about appointment

**Returns:**
- Appointment confirmation
- Calendar invite status (sent if email exists)

### 3. `update_lead_info`
**What it does:** Updates lead contact information
**Parameters:**
- `lead_id` (required)
- `primary_phone` (optional)
- `primary_email` (optional)
- `first_name`, `last_name`, `city`, `state`, `zipcode` (optional)
- `age`, `property_value`, `mortgage_balance` (optional)

**Returns:**
- Updated fields confirmation

---

## How It Works

### Architecture:

```
n8n Workflow
    ↓
Barbara MCP (HTTP endpoint /mcp)
    ↓
Bridge API (/api/tools/*)
    ↓
bridge/tools.js (actual implementation)
    ↓
Nylas API / Supabase
```

### Example n8n Flow:

**1. Check Availability**
```
n8n → Barbara MCP.check_broker_availability({
  broker_id: "uuid",
  preferred_day: "tuesday",
  preferred_time: "morning"
})
→ Returns: Available Tuesday morning slots
```

**2. Book Appointment**
```
n8n → Barbara MCP.book_appointment({
  lead_id: "uuid",
  broker_id: "uuid",
  scheduled_for: "2025-10-22T10:00:00Z",
  notes: "Interested in medical expenses"
})
→ Creates calendar event + sends invite
```

**3. Update Lead**
```
n8n → Barbara MCP.update_lead_info({
  lead_id: "uuid",
  primary_email: "john@example.com",
  last_name: "Smith"
})
→ Updates lead record
```

---

## Environment Variables

Add to `barbara-mcp/.env`:

```bash
NYLAS_API_KEY=your_api_key_here
NYLAS_API_URL=https://api.us.nylas.com  # Optional, defaults to this
BRIDGE_URL=https://bridge.northflank.app
BRIDGE_API_KEY=your_bridge_key_here
```

---

## File Changes

### `barbara-mcp/index.js`:
- Added Nylas environment variables (lines 44-54)
- Added 3 new tool definitions (lines 153-256)
- Added 3 new tool implementations (lines 325-464)

**Total tools now: 4**
1. `check_broker_availability` ← NEW
2. `book_appointment` ← NEW
3. `update_lead_info` ← NEW
4. `create_outbound_call` (existing)

---

## Use Cases

### n8n Can Now:

**1. Standalone Appointment Booking**
- Check broker availability
- Book appointment directly
- No Barbara call needed

**2. Pre-Call Setup**
- Update lead info before Barbara calls
- Verify contact details
- Set up appointment in advance

**3. Post-Call Processing**
- Book appointment after Barbara qualifies lead
- Update lead info from Barbara's call notes
- Schedule follow-ups

**4. Calendar Management Workflows**
- Daily availability checks
- Automated rescheduling
- Appointment reminders

---

## Testing

### Test from n8n:

**1. Check Availability:**
```json
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "check_broker_availability",
    "arguments": {
      "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
      "preferred_day": "tuesday",
      "preferred_time": "morning"
    }
  }
}
```

**2. Book Appointment:**
```json
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "book_appointment",
    "arguments": {
      "lead_id": "lead-uuid",
      "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
      "scheduled_for": "2025-10-22T10:00:00Z",
      "notes": "Qualified, ready to discuss equity options"
    }
  }
}
```

---

## Bridge API Endpoints Needed

The barbara-mcp calls these bridge endpoints (need to be implemented if not already):

```javascript
// In bridge API
POST /api/tools/check_broker_availability
POST /api/tools/book_appointment
POST /api/tools/update_lead_info
```

These should call the same functions in `bridge/tools.js` that Barbara uses during calls.

---

## Benefits

**✅ Nylas integration accessible from n8n**
- No need to duplicate code
- Same logic Barbara uses
- Consistent behavior

**✅ Flexible workflows**
- Barbara can book during call
- n8n can book separately
- Hybrid approaches

**✅ Centralized calendar management**
- One source of truth (Nylas)
- All bookings in broker's calendar
- Calendar invites always sent

**✅ Revenue opportunities**
- Automated follow-up bookings
- Re-engagement campaigns
- Appointment optimization

---

## Next Steps

1. **Deploy barbara-mcp** with new tools
2. **Add bridge API endpoints** (if not already implemented)
3. **Test from n8n** with real broker/lead IDs
4. **Build n8n workflows** using new tools
5. **Monitor and optimize**

**Nylas tools are now available to n8n via Barbara MCP!** 🎯
