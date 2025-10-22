# Barbara Appointment Booking Fix

**Date:** October 22, 2025  
**Issue:** Appointment booking tool calls were failing and causing Barbara to disconnect during calls

## 🐛 Problems Identified

### 1. Tool Timeout Too Short (2.5 seconds)
**Location:** `bridge/audio-bridge.js` line 2196

The `book_appointment` tool was timing out because it needs to:
- Query Supabase for broker information
- Query Supabase for lead information
- Make POST request to Nylas API to create calendar event
- Log interaction to Supabase
- Update lead status in Supabase
- Create billing event in Supabase

All of these operations take **more than 2.5 seconds**, causing the tool to timeout and fail.

**Symptoms:**
- Barbara says "I'm running into a little hiccup booking that appointment"
- Function call arguments stream (`response.function_call_arguments.delta`)
- OpenAI WebSocket closes (state: 3 = CLOSED)
- Error: "Cannot forward audio - OpenAI socket state: 3"

### 2. Incorrect Nylas API Endpoint
**Location:** `bridge/tools.js` line 801

Was using:
```javascript
const createEventUrl = `${NYLAS_API_URL}/v3/me/events?calendar_id=primary`;
```

This endpoint requires **user authentication**, not API key authentication.

**Correct endpoint:**
```javascript
const createEventUrl = `${NYLAS_API_URL}/v3/grants/${broker.nylas_grant_id}/events?calendar_id=primary`;
```

According to [Nylas v3 Calendar API docs](https://developer.nylas.com/docs/v3/calendar/using-the-events-api/), you must use the grant-specific endpoint when using Bearer token (API key) authentication.

### 3. Missing Error Diagnostics
**Location:** `bridge/tools.js` line 844-849

When Nylas API calls failed, there wasn't enough diagnostic information to debug what went wrong.

### 4. Socket State Not Checked Before Tool Execution
**Location:** `bridge/audio-bridge.js` line 2206

Tool calls were attempting to execute even when the OpenAI socket was already closed, causing cascading errors.

## ✅ Fixes Applied

### 1. Increased Tool Timeout: 2.5s → 10s
**File:** `bridge/audio-bridge.js` line 2196

```javascript
// Before
withTimeout(promise, ms = 2500)

// After
withTimeout(promise, ms = 10000)
```

**Impact:** Gives appointment booking enough time to complete all API calls and database operations.

### 2. Fixed Nylas API Endpoint
**File:** `bridge/tools.js` line 801

```javascript
// Before
const createEventUrl = `${NYLAS_API_URL}/v3/me/events?calendar_id=primary`;

// After
const createEventUrl = `${NYLAS_API_URL}/v3/grants/${broker.nylas_grant_id}/events?calendar_id=primary`;
```

**Impact:** Uses the correct grant-specific endpoint for Bearer token authentication.

### 3. Enhanced Error Diagnostics
**File:** `bridge/tools.js` lines 846-848

Added detailed error logging:
```javascript
console.error('❌ Nylas create event failed:', response.status, errorText);
console.error('❌ Request URL:', createEventUrl);
console.error('❌ Request body:', JSON.stringify(eventBody, null, 2));
```

**Impact:** Makes it easier to debug Nylas API issues in production logs.

### 4. Added Socket State Validation
**File:** `bridge/audio-bridge.js` lines 2213-2218, 2245-2250, 2292-2297

Added checks before tool execution:
```javascript
// Check socket before executing tool
if (!this.openaiSocket || this.openaiSocket.readyState !== WebSocket.OPEN) {
  console.error('❌ Cannot execute tool - OpenAI socket not connected');
  return;
}

// Check socket before sending result
if (this.openaiSocket.readyState !== WebSocket.OPEN) {
  console.error('❌ Socket closed during tool execution - cannot send result');
  return;
}
```

**Impact:** Prevents tool execution errors from propagating when socket is already closed.

### 5. Wrapped Error Response Sending in Try-Catch
**File:** `bridge/audio-bridge.js` lines 2300-2318

```javascript
try {
  this.openaiSocket.send(JSON.stringify({ /* error response */ }));
  this.enqueueResponse({});
} catch (sendErr) {
  console.error('❌ Failed to send error response to OpenAI:', sendErr);
}
```

**Impact:** Prevents secondary errors when sending error responses back to OpenAI.

## 🧪 Testing Recommendations

### Test 1: Successful Booking
1. Call Barbara
2. Ask to book an appointment
3. Verify appointment is created in broker's Nylas calendar
4. Verify lead receives calendar invite (if email exists)
5. Verify Barbara stays connected throughout

### Test 2: Timeout Handling
1. Temporarily set timeout back to 2500ms
2. Call Barbara and try to book appointment
3. Verify Barbara gracefully handles timeout with fallback message
4. Verify Barbara stays connected (doesn't disconnect)

### Test 3: Missing Grant ID
1. Set a broker's `nylas_grant_id` to null in database
2. Call Barbara and try to book appointment
3. Verify Barbara responds with fallback message
4. Verify Barbara stays connected

### Test 4: Invalid Grant ID
1. Set a broker's `nylas_grant_id` to invalid value
2. Call Barbara and try to book appointment
3. Check logs for detailed Nylas error
4. Verify Barbara responds with fallback message

## 📊 Expected Behavior Now

**When booking succeeds:**
1. ✅ Calendar event created in broker's Nylas calendar
2. ✅ Calendar invite sent to lead (if email exists)
3. ✅ Interaction logged to Supabase
4. ✅ Lead status updated to `appointment_set`
5. ✅ Billing event created ($50 pending)
6. ✅ Barbara confirms appointment to caller
7. ✅ Barbara stays connected (no disconnect)

**When booking fails:**
1. ✅ Error logged to console with full diagnostics
2. ✅ Barbara tells caller: "I'm having trouble accessing the calendar right now. Let me have one of our specialists call you back to schedule that. What's the best number to reach you?"
3. ✅ Barbara stays connected (graceful degradation)
4. ✅ No crash, no disconnect

## 🔧 Environment Variables Required

Ensure these are set in production:

```bash
# Nylas API Configuration
NYLAS_API_KEY=your_api_key_here
NYLAS_API_URL=https://api.us.nylas.com  # Optional, defaults to this

# Supabase (for broker/lead data)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

## 📚 Nylas API v3 Reference

- **Free/Busy Check:** `POST /v3/calendars/free-busy` (no grant needed)
- **Create Event:** `POST /v3/grants/{grant_id}/events?calendar_id=primary`
- **Auth:** Bearer token with API key in Authorization header
- **Docs:** https://developer.nylas.com/docs/v3/calendar/

## 🎯 Related Files

- `bridge/audio-bridge.js` - Tool execution timeout and error handling
- `bridge/tools.js` - Nylas API integration and appointment booking logic
- `barbara-mcp/index.js` - MCP endpoint (not used by Barbara during calls, only for n8n)
- `BARBARA_MCP_NYLAS_TOOLS.md` - Documentation of Nylas tools

## ✨ Benefits

1. **Reliability:** Appointments now book successfully without timing out
2. **Resilience:** Barbara stays connected even when tools fail
3. **Debuggability:** Full error diagnostics in logs
4. **User Experience:** Graceful fallback messages instead of abrupt disconnects
5. **Billing Accuracy:** Proper event logging for revenue tracking

## 🚀 Deployment

After testing, deploy changes:
1. Commit changes to git
2. Push to repository
3. Northflank will auto-deploy (CI/CD enabled)
4. Monitor logs for first few appointment bookings
5. Verify calendar events appear in broker Nylas calendars

---

**Fixed by:** Claude (Cursor AI)  
**Tested by:** [Pending]  
**Deployed by:** [Pending]  
**Status:** ✅ Ready for Testing

