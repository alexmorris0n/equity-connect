# Scenario 11: Tool Failure Handling - Flow Documentation

## Current State (What Happens Now)

**When `handle_booking` or `handle_check_broker_availability` fails:**

1. ✅ Error is logged to console
2. ✅ Returns error message to Barbara
3. ❌ **NO flag is set** (`manual_booking_required` doesn't exist)
4. ❌ **NO task/note is created** for broker to manually book
5. ❌ GOODBYE doesn't know to follow up

**Barbara says:** "I'm having trouble accessing the calendar. Let me connect you with our team..."

**But then:** Nothing happens. No follow-up. No record for broker.

---

## What SHOULD Happen (Proposed Flow)

### Step 1: Booking Tool Fails
**File:** `swaig-agent/tools/booking.py` (lines 117-124)

**When exception occurs:**
```python
except Exception as e:
    logger.error(f"[BOOKING] Error creating appointment: {e}")
    
    # STEP 1A: Set flag in conversation state
    await update_conversation_state(phone, {
        "conversation_data": {
            "manual_booking_required": True,
            "booking_error": str(e)
        }
    })
    
    # STEP 1B: Create interaction record (for tracking)
    # TODO: Add interaction creation here
    
    # STEP 1C: Create task/note for broker
    # TODO: Add task creation here
    
    return {
        "response": "I'm having trouble accessing the calendar. Let me have someone call you directly...",
        "action": [{
            "set_meta_data": {
                "manual_booking_required": True
            }
        }]
    }
```

### Step 2: Continue to GOODBYE Node
**File:** `swaig-agent/services/routing.py` - `route_after_book()`

**Current logic:**
- If `appointment_booked` → GOODBYE ✅
- If error → stays in BOOK ❌

**Should be:**
- If `appointment_booked` → GOODBYE ✅
- If `manual_booking_required` → GOODBYE ✅ (so we can tell them someone will call)

### Step 3: GOODBYE Node Sees Flag
**File:** Database prompt for `goodbye` node

**Should add:**
```
=== MANUAL BOOKING FOLLOW-UP ===
If conversation_data shows manual_booking_required=true:
- Say: "I've noted your information, and someone from our team will call you within 24 hours to schedule your appointment. Is this the best number to reach you at?"
- Confirm their phone number
- Deliver warm goodbye with reassurance
```

### Step 4: Create Task/Note for Broker
**File:** `swaig-agent/tools/booking.py` - Add function

**Options:**

**Option A: Create interaction record**
```python
# Create interaction with type="appointment" and outcome="manual_booking_required"
sb.table('interactions').insert({
    "lead_id": lead_id,
    "broker_id": broker_id,
    "type": "appointment",
    "direction": "outbound",
    "outcome": "manual_booking_required",
    "content": "Automated booking failed - manual booking required",
    "metadata": {
        "error": str(e),
        "requested_time": args.get('scheduled_for'),
        "notes": args.get('notes')
    }
}).execute()
```

**Option B: Create note in leads.notes field**
```python
# Append note to leads.notes
current_notes = lead.get('notes', '') or ''
new_note = f"\n[MANUAL BOOKING REQUIRED - {datetime.now().strftime('%Y-%m-%d %H:%M')}] Automated booking failed. Please call lead to schedule.\nError: {str(e)}\n"
sb.table('leads').update({
    "notes": current_notes + new_note,
    "status": "appointment_requested"  # Or keep as "qualified"
}).eq('id', lead_id).execute()
```

**Option C: Trigger n8n webhook** ✅ **RECOMMENDED - Already have webhook pattern**

**Existing webhooks in env.template:**
- `N8N_AVAILABILITY_WEBHOOK` - Already exists
- `N8N_BOOKING_WEBHOOK` - Already exists

**Add new webhook:**
```env
N8N_MANUAL_BOOKING_WEBHOOK=https://n8n.instaroute.com/webhook/manual-booking-required
```

**Implementation pattern (matches existing code):**
```python
import os
import httpx

# In handle_booking error handler:
webhook_url = os.getenv("N8N_MANUAL_BOOKING_WEBHOOK")
if webhook_url:
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                webhook_url,
                json={
                    "lead_id": lead_id,
                    "broker_id": broker_id,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "phone": phone,
                    "requested_time": args.get('preferred_time'),
                    "notes": args.get('notes'),
                    "timestamp": datetime.utcnow().isoformat()
                },
                timeout=10.0
            )
            logger.info(f"[WEBHOOK] Manual booking webhook triggered for lead {lead_id}")
    except Exception as webhook_error:
        logger.error(f"[WEBHOOK] Failed to trigger manual booking webhook: {webhook_error}")
        # Don't fail the whole function if webhook fails
```

**Option D: Update lead status** (simplest)
```python
# Just mark as "appointment_requested" so broker knows to follow up
sb.table('leads').update({
    "status": "appointment_requested",  # Custom status
    "last_engagement": datetime.utcnow().isoformat()
}).eq('id', lead_id).execute()
```

---

## Recommended Flow (Using n8n Webhook) ✅

### 1. **Set Flag** (conversation_data)
- Set `manual_booking_required=true`
- Allows GOODBYE to detect it

### 2. **Trigger n8n Webhook** (Option C - RECOMMENDED)
- Sends webhook to n8n workflow
- n8n can: create task, send Slack notification, update database, etc.
- Follows existing pattern (`N8N_AVAILABILITY_WEBHOOK`, `N8N_BOOKING_WEBHOOK`)

### 3. **GOODBYE Follow-up** (Prompt update)
- Tell caller someone will call within 24 hours
- Confirm phone number

---

## What Needs to Be Added

1. ✅ **Flag setting** in error handlers (already planned)
2. ❌ **Interaction creation** when booking fails
3. ❌ **Lead status update** to `appointment_requested`
4. ❌ **GOODBYE prompt update** to handle flag

---

## Implementation Plan ✅

**Using Option C (n8n Webhook) - RECOMMENDED**

### Step 1: Add Webhook URL to env.template
```env
N8N_MANUAL_BOOKING_WEBHOOK=https://n8n.instaroute.com/webhook/manual-booking-required
```

### Step 2: Update `handle_booking` Error Handler
- Set `manual_booking_required` flag
- Trigger n8n webhook with error details

### Step 3: Update `handle_check_broker_availability` Error Handler
- Same pattern: set flag + trigger webhook

### Step 4: Update GOODBYE Prompt
- Check for `manual_booking_required` flag
- Deliver follow-up messaging

### Step 5: Create n8n Workflow (you'll do this)
- Create webhook node: `manual-booking-required`
- Can create task, send Slack, update database, etc.

---

## Next Steps:

Once you decide on task/note creation method, I'll:
1. Add flag setting to error handlers
2. Add task/note creation (your chosen method)
3. Update GOODBYE prompt
4. Test the flow

