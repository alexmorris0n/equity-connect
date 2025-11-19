# Conversation Data Flags

This document defines all flags stored in `conversation_state.conversation_data` JSONB field.

## Core Flow Flags (Currently Implemented)

| Flag | Type | Set By | Purpose | Trace Scenarios |
|------|------|--------|---------|-----------------|
| `greeted` | boolean | `mark_greeted()` | Caller has been greeted | All |
| `verified` | boolean | `mark_verified()` | Identity verified | All |
| `qualified` | boolean | `mark_qualification_result()` | Qualification status | 1, 2, 2B, 2C, 8 |
| `quote_presented` | boolean | `mark_quote_presented()` | Quote has been given | 1, 2, 2B, 2C |
| `appointment_booked` | boolean | `book_appointment()` | Appointment scheduled | 1, 1B, 2C, 10 |
| `ready_to_book` | boolean | `mark_ready_to_book()` | Caller ready for appointment | 1, 3 |
| `has_objections` | boolean | `mark_has_objection()` | Objection raised | 4, 5, 6 |
| `objection_handled` | boolean | `mark_objection_handled()` | Objection resolved | 4, 5 |
| `wrong_person` | boolean | `mark_wrong_person()` | Wrong person answered | 7 |
| `right_person_available` | boolean | `mark_wrong_person()` | Correct person available | 7 |

## Missing Flags (Need Implementation)

### Returning Caller Intelligence
| Flag | Type | Purpose | Trace Scenarios |
|------|------|---------|-----------------|
| `quote_reaction` | string | Caller's reaction to quote (positive/negative/skeptical/neutral) | 2, 2B, 9 |
| `questions_answered` | boolean | Questions have been answered in ANSWER node | 1B, 2B, 2C |

### Edge Case Handling
| Flag | Type | Purpose | Trace Scenarios |
|------|------|---------|-----------------|
| `borderline_equity` | boolean | Low net proceeds case (< $20k) | 9 |
| `pending_birthday` | boolean | Almost 62 (< 3 months to birthday) | 8 |
| `interrupted_at` | string | Node name where flow was interrupted (for resume) | 6 |
| `objection_types` | array | List of objection types handled | 5 |
| `objection_count` | integer | Number of objections raised | 5 |

### Failure Mode Handling
| Flag | Type | Purpose | Trace Scenarios |
|------|------|---------|-----------------|
| `manual_booking_required` | boolean | Tool failure, needs manual follow-up | 11 |
| `kb_search_failed` | boolean | Knowledge base timeout | 12 |
| `tool_failure_reason` | string | Description of tool failure | 11, 12 |

### Additional Context
| Flag | Type | Purpose | Trace Scenarios |
|------|------|---------|-----------------|
| `appointment_datetime` | string (ISO 8601) | Scheduled appointment time | 1, 2C, 10 |
| `appointment_duration` | integer | Appointment length in minutes (30/60) | 3 |
| `advisor_included` | boolean | Third-party advisor joining | 3 |
| `disqualified_reason` | string | Why they don't qualify | 13 |
| `needs_family_buy_in` | boolean | Needs to discuss with family | 4 |
| `follow_up_scheduled` | boolean | Follow-up call scheduled | 8 |

## Flag Usage Patterns

### Happy Path Flow
```
greeted → verified → qualified=true → quote_presented → 
quote_reaction=positive → appointment_booked
```

### Returning Caller (Scenario 2B)
```
Check: qualified=true, quote_presented=true, quote_reaction=positive
→ Start at ANSWER node
```

### Objection Flow (Scenario 4)
```
quote_presented → has_objections=true → objection_types=['third_party_approval'] → 
objection_handled=true → needs_family_buy_in=true
```

### Failure Mode (Scenario 11)
```
ready_to_book → manual_booking_required=true → 
tool_failure_reason="check_broker_availability timeout"
```

## Implementation Notes

1. **JSONB Flexibility**: Flags are stored in `conversation_data` JSONB, no schema changes needed
2. **Backward Compatible**: New flags won't break existing code - they're optional
3. **Both Platforms**: SignalWire and LiveKit both read/write to same flags
4. **Tool Responsibility**: Tools should set appropriate flags when called
5. **Routing Logic**: Routers can check flags to determine next node
6. **Portal Visibility**: Vue portal can display these flags for debugging

## Next Steps

1. ✅ Document all flags (this file)
2. 🔄 Update tool handlers to set missing flags
3. 🔄 Update routing logic to check new flags
4. 🔄 Update Vue portal to display new flags
5. 🔄 Test all 13 trace scenarios

