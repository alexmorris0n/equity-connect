# Phase 3 Advanced Features - Status Report
**Date:** 2025-11-22  
**Status:** Checking what we have vs. what we need

---

## Feature Status Summary

| Feature | Status | What We Have | What We Need |
|---------|--------|--------------|--------------|
| **1. Late Disqualification in QUOTE** | ❌ **MISSING** | `route_to_goodbye()` exists | `mark_qualification_result` tool in QUOTE |
| **2. Skip to QUOTE from GREET** | ✅ **DONE** | `route_to_quote()` in GREET | Nothing - complete |
| **3. Borderline Equity Handling** | ❌ **MISSING** | `equity_qualified` column exists | `borderline_equity` flag + logic |
| **4. Error Handling (BOOK)** | ⚠️ **PARTIAL** | Try/catch in calendar tools | Fallback messaging in BOOK agent |
| **5. Error Handling (KB)** | ❓ **UNKNOWN** | `search_knowledge()` exists | Timeout handling verification needed |

---

## Detailed Analysis

### ✅ Feature 2: Skip to QUOTE from GREET

**Status:** ✅ **COMPLETE**

**What We Have:**
- `route_to_quote()` tool in `greet.py` (line 262)
- Tool documentation explains when to use it (calculation questions)
- Matches Scenario 2 requirements

**No Action Needed**

---

### ❌ Feature 1: Late Disqualification in QUOTE

**Status:** ❌ **MISSING**

**What We Have:**
- ✅ `route_to_goodbye()` tool in QUOTE (line 350)
- ✅ Tool documentation mentions disqualification scenarios
- ❌ **MISSING:** `mark_qualification_result` tool in QUOTE

**What We Need:**
1. Add `mark_qualification_result` tool to QUOTE
2. Tool should:
   - Call `mark_qualification_result(qualified=False, reason="...")` from `tools/conversation_flags.py`
   - Route to GOODBYE with `reason="disqualified"`
3. Update QUOTE database prompt to mention late disqualification detection

**Impact:** High - Scenario 13 won't work without this

---

### ❌ Feature 3: Borderline Equity Handling

**Status:** ❌ **MISSING**

**What We Have:**
- ✅ `equity_qualified` column in database (boolean)
- ✅ `estimated_equity` column in database (numeric)
- ❌ **MISSING:** `borderline_equity` column/flag
- ❌ **MISSING:** Logic to set `borderline_equity` flag
- ❌ **MISSING:** Special messaging in QUOTE for low equity

**What We Need:**
1. Add `borderline_equity` column to `leads` table (boolean)
2. Add logic in QUALIFY to set `borderline_equity=true` when:
   - Equity is low (e.g., < $50k after mortgage payoff)
   - But still qualifies (has some equity)
3. Update QUOTE prompt to:
   - Check `borderline_equity` flag
   - Use special reframing script for low equity scenarios
   - Emphasize mortgage payment elimination benefit

**Impact:** Medium - Scenario 9 won't work without this

---

### ⚠️ Feature 4: Error Handling in BOOK

**Status:** ⚠️ **PARTIAL**

**What We Have:**
- ✅ Try/catch blocks in `calendar.py` tools (`check_broker_availability`, `book_appointment`)
- ✅ Error messages returned in JSON responses
- ❌ **MISSING:** Fallback messaging in BOOK agent prompt
- ❌ **MISSING:** `manual_booking_required` flag setting

**What We Need:**
1. Update BOOK database prompt to include:
   - Fallback script when `check_broker_availability` fails
   - Fallback script when `book_appointment` fails
   - Instructions to set `manual_booking_required=true` flag
2. Add `manual_booking_required` flag to conversation state
3. Update GOODBYE prompt to handle `manual_booking_required` scenario

**Impact:** Medium - Scenario 11 partially works (tools handle errors) but agent doesn't have fallback messaging

---

### ❓ Feature 5: Error Handling in Knowledge Base

**Status:** ❓ **UNKNOWN**

**What We Have:**
- ✅ `search_knowledge()` tool exists in `tools/knowledge.py`
- ❓ **UNKNOWN:** Does it have timeout handling?
- ❓ **UNKNOWN:** Does it have fallback responses?

**What We Need:**
1. Check `tools/knowledge.py` for timeout handling
2. If missing, add timeout (e.g., 20 seconds)
3. Update ANSWER database prompt with fallback responses for common questions
4. Add logic to detect KB failures and use fallback

**Impact:** Low-Medium - Scenario 12 may work if KB has timeout, but fallback responses needed

---

## Priority Order (Based on Impact)

### 🔴 High Priority (Must Fix)

**1. Late Disqualification in QUOTE**
- **Why:** Scenario 13 completely broken without this
- **Effort:** ~15 minutes
- **Files:** `livekit-agent/agents/quote.py`, database prompt

### 🟡 Medium Priority (Should Fix)

**2. Error Handling in BOOK**
- **Why:** Tools handle errors but agent doesn't have fallback messaging
- **Effort:** ~10 minutes
- **Files:** Database prompts (BOOK, GOODBYE)

**3. Borderline Equity Handling**
- **Why:** Scenario 9 won't work without this
- **Effort:** ~20 minutes (database migration + code + prompt)
- **Files:** Database migration, `livekit-agent/agents/qualify.py`, database prompt (QUOTE)

### 🟢 Low Priority (Nice to Have)

**4. Error Handling in Knowledge Base**
- **Why:** May already work, just need to verify
- **Effort:** ~10 minutes (verification + fallback responses)
- **Files:** `livekit-agent/tools/knowledge.py`, database prompt (ANSWER)

---

## Recommendation

**Start with Feature 1 (Late Disqualification in QUOTE)** because:
1. Highest impact (Scenario 13 completely broken)
2. Quickest to implement (~15 minutes)
3. Already have `route_to_goodbye()` - just need the disqualification tool
4. No database changes needed

**Then tackle Feature 2 (Error Handling in BOOK)** because:
1. Medium impact (tools work but agent needs messaging)
2. Quick to implement (~10 minutes)
3. No code changes - just database prompt updates

**Then Feature 3 (Borderline Equity)** if time permits.

---

**Last Updated:** 2025-11-22


