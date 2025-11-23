# LiveKit Agent Routing Rules
**Date:** 2025-11-22  
**Status:** ✅ Implemented

---

## Core Routing Principles

1. **Every call starts in GREET**
2. **Verify/Qualify are required** (unless already complete)
3. **OBJECTIONS is the exception** - can be accessed from anywhere, including before verify/qualify
4. **No routing back to GREET** - once you leave greet, you never return

---

## Routing Matrix

### From GREET Node

| Condition | Routes To |
|-----------|-----------|
| Not verified | → **VERIFY** (required) |
| Verified but not qualified | → **QUALIFY** (required) |
| Verified AND qualified | → **ANSWER** |
| User has objections/concerns | → **OBJECTIONS** (exception - can skip verify/qualify) |
| User wants to book | → **BOOK** |

**Tools Available:**
- `mark_greeted(reason_summary)` - Routes based on verified/qualified status
- `route_to_objections()` - **NEW** - Routes to objections before verify/qualify
- `mark_wrong_person()` - Routes to goodbye

---

### From VERIFY Node

| Condition | Routes To |
|-----------|-----------|
| After verification complete | → **QUALIFY** (if not qualified) OR **ANSWER** (if qualified) |
| User has questions | → **ANSWER** |
| User has objections | → **OBJECTIONS** |
| User wants quote | → **QUOTE** |
| User wants to book | → **BOOK** |

**Tools Available:**
- `mark_phone_verified()`
- `mark_email_verified()`
- `mark_address_verified()`
- `update_lead_info()`
- `find_broker_by_territory()`
- `route_to_answer()` - (if implemented)
- `route_to_objections()` - (if implemented)
- `route_to_quote()` - (if implemented)
- `route_to_booking()` - (if implemented)

---

### From QUALIFY Node

| Condition | Routes To |
|-----------|-----------|
| After qualification complete | → **ANSWER** |
| User has questions | → **ANSWER** |
| User has objections | → **OBJECTIONS** |
| User wants quote | → **QUOTE** |
| User wants to book | → **BOOK** |
| Not qualified | → **GOODBYE** (disqualified) |

**Tools Available:**
- `mark_age_qualified()`
- `mark_homeowner_qualified()`
- `mark_primary_residence_qualified()`
- `mark_equity_qualified()`
- `update_lead_info()`
- `route_to_answer()`
- `route_to_objections()`
- `route_to_quote()`
- `route_to_booking()`
- `route_to_goodbye()`

---

### From ANSWER Node

| Condition | Routes To |
|-----------|-----------|
| User asks calculation question | → **QUOTE** |
| User has objections | → **OBJECTIONS** |
| User wants to book | → **BOOK** |
| More questions | → **ANSWER** (loop) |

**Tools Available:**
- `search_knowledge(question)`
- `route_to_quote()`
- `route_to_objections()`
- `route_to_booking()`
- `mark_ready_to_book()`
- `mark_has_objection()`

---

### From OBJECTIONS Node

| Condition | Routes To |
|-----------|-----------|
| Objection resolved, user ready | → **BOOK** |
| User has more questions | → **ANSWER** |
| Objection unresolved | → **GOODBYE** |

**Tools Available:**
- `search_knowledge(objection_topic)`
- `mark_objection_handled()`
- `mark_has_objection()`
- `route_to_answer()`
- `route_to_booking()`
- `route_to_goodbye()`

---

### From QUOTE Node

| Condition | Routes To |
|-----------|-----------|
| Quote presented, user has questions | → **ANSWER** |
| Quote presented, user has concerns | → **OBJECTIONS** |
| Quote presented, user ready | → **BOOK** |

**Tools Available:**
- `calculate_reverse_mortgage()`
- `mark_quote_presented()`
- `update_lead_info()`
- `route_to_answer()`
- `route_to_objections()`
- `route_to_booking()`

---

### From BOOK Node

| Condition | Routes To |
|-----------|-----------|
| After booking complete | → **GOODBYE** |
| User has questions | → **ANSWER** |
| User has concerns | → **OBJECTIONS** |
| User wants calculations | → **QUOTE** |

**Tools Available:**
- `check_broker_availability()`
- `book_appointment()`
- `route_to_answer()`
- `route_to_objections()`
- `route_to_quote()`
- `route_to_goodbye()`

---

### From GOODBYE Node

| Condition | Routes To |
|-----------|-----------|
| User asks question | → **ANSWER** |
| Otherwise | → **END CALL** |

**Tools Available:**
- `route_to_answer()` - Only if user asks question during goodbye

---

## Key Rules Summary

### ✅ Allowed Routes:
- **GREET** → VERIFY, QUALIFY, ANSWER, OBJECTIONS, BOOK
- **VERIFY** → QUALIFY, ANSWER, OBJECTIONS, QUOTE, BOOK
- **QUALIFY** → ANSWER, OBJECTIONS, QUOTE, BOOK, GOODBYE
- **ANSWER** → QUOTE, OBJECTIONS, BOOK, ANSWER (loop)
- **OBJECTIONS** → ANSWER, BOOK, GOODBYE
- **QUOTE** → ANSWER, OBJECTIONS, BOOK
- **BOOK** → ANSWER, OBJECTIONS, QUOTE, GOODBYE
- **GOODBYE** → ANSWER (if question asked)

### ❌ Forbidden Routes:
- **NO NODE** → GREET (once you leave greet, you never return)
- **VERIFY** → VERIFY (can't loop)
- **QUALIFY** → QUALIFY (can't loop)
- **GOODBYE** → Any node except ANSWER (if question asked)

### 🎯 Special Exception:
- **OBJECTIONS** can be accessed from **ANYWHERE**, including **GREET** before verify/qualify
- Reason: People won't give personal information if they have objections

---

## Implementation Status

### ✅ Completed:
- [x] GREET routes to VERIFY if not verified
- [x] GREET routes to QUALIFY if verified but not qualified
- [x] GREET routes to ANSWER if verified and qualified
- [x] GREET has `route_to_objections()` tool (NEW - added 2025-11-22)
- [x] No nodes route back to GREET
- [x] All other nodes have routing tools to other nodes

### 📝 Notes:
- Routing tools are implemented as `@function_tool()` decorators
- Each routing tool returns the next agent instance
- Database status (verified/qualified) is checked in GREET's `mark_greeted()` tool
- OBJECTIONS exception is documented in GREET's `route_to_objections()` tool

---

**Last Updated:** 2025-11-22


