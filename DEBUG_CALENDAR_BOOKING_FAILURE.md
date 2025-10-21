# Debug: Calendar Booking Failure

## What Happened

**Barbara said:**
> "Looks like I'm having a little trouble locking that time in. Let me have Walter reach out to you directly to find a good time. What's the best number for him to call you on?"

**This means:** `book_appointment` tool returned an error

---

## Possible Causes

### 1. **Missing nylas_grant_id**
```javascript
// In book_appointment function:
if (!broker.nylas_grant_id) {
  return { success: false, error: 'Broker calendar not synced' };
}
```

**Check:**
```sql
SELECT id, contact_name, nylas_grant_id, email 
FROM brokers 
WHERE id = '6a3c5ed5-664a-4e13-b019-99fe8db74174';
```

**If nylas_grant_id is NULL:**
- Barbara can't book (no calendar access)
- Need to set Walter's grant_id

### 2. **Invalid scheduled_for Format**
```javascript
// Barbara might have passed bad datetime
scheduled_for: "Tuesday at 10 AM"  // ❌ Wrong format

// Should be:
scheduled_for: "2025-10-22T10:00:00Z"  // ✅ ISO 8601
```

### 3. **Nylas API Error**
- API key invalid
- Grant ID revoked
- Calendar access removed
- Network error

### 4. **Missing Lead Email**
- Lead doesn't have email
- Barbara tried to send invite
- Nylas rejected (though this shouldn't fail booking)

---

## How to Debug

### Check Bridge Logs for Tool Call

**Look for:**
```
🔧 Tool call: book_appointment
❌ Nylas calendar event creation failed: [error message]
```

**Or:**
```
🔧 Tool call: book_appointment
❌ Error: Broker calendar not synced
```

### Check Broker Grant ID

```sql
SELECT 
  id,
  contact_name, 
  nylas_grant_id,
  email,
  calendar_synced_at
FROM brokers
WHERE contact_name LIKE '%Walter%';
```

**Expected:**
```
nylas_grant_id: c18c3f0f-2cb2-4b39-bc87-3a72ee4f10aa
email: alex@instaroute.com
```

**If NULL:**
- We need to update Walter's record with grant_id

---

## Most Likely Issue

**You're testing with Walter, but did we update HIS record with the grant_id?**

**We updated THIS broker:**
```sql
-- We did this earlier
UPDATE brokers 
SET nylas_grant_id = 'c18c3f0f-2cb2-4b39-bc87-3a72ee4f10aa',
    email = 'alex@instaroute.com'
WHERE id = '6a3c5ed5-664a-4e13-b019-99fe8db74174';
```

**But is that Walter Richards? Let me check:**

---

## Immediate Fix

**Option 1: Verify Walter has grant_id**
```sql
SELECT id, contact_name, nylas_grant_id 
FROM brokers;
```

**Option 2: Update Walter with grant_id (if missing)**
```sql
UPDATE brokers
SET nylas_grant_id = 'c18c3f0f-2cb2-4b39-bc87-3a72ee4f10aa',
    email = 'alex@instaroute.com',
    calendar_synced_at = NOW(),
    calendar_provider = 'google'
WHERE contact_name LIKE '%Walter%';
```

---

## Why This Shows PromptLayer Would Help

**Current debugging:**
1. See Barbara's error message ✅
2. Search bridge logs manually ❌ (time consuming)
3. Figure out which tool failed ⏱️ (trial and error)
4. Find root cause 🔍 (dig through code)
5. Fix and redeploy 🚀

**With PromptLayer:**
1. See Barbara's error message ✅
2. Click call in PromptLayer dashboard ✅
3. See exact tool call + error ✅
4. See tool parameters that failed ✅
5. Fix immediately ✅

**PromptLayer shows:**
```
Tool Call: book_appointment
Input: {
  lead_id: "abc-123",
  broker_id: "walter-uuid",
  scheduled_for: "2025-10-22T10:00:00Z"
}
Error: "Broker calendar not synced"
Root Cause: nylas_grant_id is NULL
```

**Debug time: 30 seconds vs 30 minutes** 🎯

---

## Next Steps

**Let me check Walter's broker record to fix this specific issue.**

Want me to query Supabase to see if Walter has nylas_grant_id set?

