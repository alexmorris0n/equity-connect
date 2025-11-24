# SignalWire Payload Size Analysis

**Date**: November 24, 2025

---

## Current Node Sizes

| Node | Instructions | Step Criteria | Role | Total | Tools | Contexts |
|------|-------------|---------------|------|-------|-------|----------|
| **GOODBYE** | 2,396 chars | 184 | 560 | **3,140** | 1 | 2 |
| **QUOTE** | 1,747 chars | 286 | 629 | **2,662** | 4 | 5 |
| **OBJECTIONS** | 1,923 chars | 109 | 577 | **2,609** | 3 | 4 |
| **QUALIFY** | 2,271 chars | 123 | 119 | **2,513** | 6 | 4 |
| **BOOK** | 2,151 chars | 80 | 57 | **2,288** | 3 | 3 |
| **VERIFY** | 1,929 chars | 70 | 59 | **2,058** | 5 | 5 |
| **GREET** | 1,560 chars | 180 | 93 | **1,833** | 2 | 7 |
| **ANSWER** | 1,522 chars | 102 | 116 | **1,740** | 2 | 5 |

**Total per-node content**: ~18,843 characters

---

## Full SWML Payload Estimate

### What Gets Sent to SignalWire:

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [{
      "answer": {},
      "ai": {
        "post_prompt_url": "...",
        "prompt": {
          "text": "[THEME + CALLER CONTEXT]",  // ~2,000 chars
          "temperature": 0.6,
          "contexts": {
            "greet": { "steps": [...] },      // ~1,833 chars
            "verify": { "steps": [...] },     // ~2,058 chars
            "qualify": { "steps": [...] },    // ~2,513 chars
            "answer": { "steps": [...] },     // ~1,740 chars
            "quote": { "steps": [...] },      // ~2,662 chars
            "objections": { "steps": [...] }, // ~2,609 chars
            "book": { "steps": [...] },       // ~2,288 chars
            "goodbye": { "steps": [...] }     // ~3,140 chars
          }
        },
        "params": {
          "ai_model": "...",
          "openai_asr_engine": "...",
          // ... behavior params
        },
        "languages": [{
          "name": "English",
          "code": "en-US",
          "voice": "..."
        }],
        "SWAIG": {
          "defaults": {},
          "functions": [
            // ~40 function definitions @ ~200 chars each = ~8,000 chars
          ]
        }
      }
    }]
  }
}
```

### Size Breakdown:

| Component | Estimated Size |
|-----------|----------------|
| Theme + Caller Context | ~2,000 chars |
| 8 Node Contexts | ~18,843 chars |
| SWAIG Functions (40 tools) | ~8,000 chars |
| SWML Structure (JSON) | ~2,000 chars |
| Params + Config | ~1,000 chars |
| **TOTAL ESTIMATE** | **~31,843 chars** |

**In KB**: ~31 KB (raw) → ~40-50 KB (formatted JSON with whitespace)

---

## SignalWire Limits

**Unknown official limit**, but typical HTTP/JSON API limits:
- Most APIs: 100 KB - 1 MB request body
- SignalWire likely: 100-500 KB (estimate)

**Our payload**: ~40-50 KB = **Well under typical limits** ✅

---

## If Payload is Too Big (Contingency Plan)

### Priority 1: Remove Redundant Role Fields

**Current**: Each node has a `role` field (avg 300 chars)
**Issue**: Role is often redundant with instructions
**Savings**: 8 nodes × 300 chars = ~2,400 chars

```sql
-- Remove role fields if needed
UPDATE prompt_versions
SET content = content - 'role'
WHERE id IN (SELECT pv.id FROM prompt_versions pv 
             JOIN prompts p ON pv.prompt_id = p.id 
             WHERE p.is_active = true);
```

---

### Priority 2: Shorten GOODBYE (Largest Node)

**Current**: 3,140 chars (2,396 instructions + 560 role)
**Target**: ~2,000 chars

**What to trim**:
- ❌ Remove example scenarios (keep structure only)
- ❌ Simplify handoff detection (remove redundant examples)
- ✅ Keep: Core scenarios, tool calls, routing

**Example reduction**:
```
BEFORE (verbose):
"### 5. WRONG PERSON → HANDOFF TO CORRECT PERSON
This is the NEW scenario we're handling.

⚠️ CRITICAL: When correct person gets on the phone after wrong person answered:

**DETECTION SIGNALS**:
- User says \"This is [FirstName]\" where FirstName matches lead_first_name
- User says \"I'm [FirstName]\" where FirstName matches lead_first_name  
- User says \"It's [FirstName]\" where FirstName matches lead_first_name
- User says \"[FirstName] here\" where FirstName matches lead_first_name

**IMMEDIATE ACTION**:
⚠️ IMMEDIATELY call mark_handoff_complete(new_person_name=\"[FirstName]\")

**Example 1**:
Lead: John Smith
User: \"This is John\"
→ mark_handoff_complete(new_person_name=\"John\")

**Example 2**:
Lead: Mary Johnson  
User: \"I'm Mary\"
→ mark_handoff_complete(new_person_name=\"Mary\")

**Example 3**:
Lead: Robert Williams
User: \"Robert here\"
→ mark_handoff_complete(new_person_name=\"Robert\")

DO NOT call mark_handoff_complete if:
- Name doesn't match lead
- Person is still getting the lead
- You're unsure who is speaking
- They're asking for callback later"

AFTER (concise - saves ~800 chars):
"### 5. WRONG PERSON → HANDOFF
When correct person gets on phone:
⚠️ Call mark_handoff_complete(new_person_name=\"[FirstName]\") when user says \"This is [Name]\" / \"I'm [Name]\" / \"[Name] here\" and name matches lead.
DO NOT call if unsure or person still getting lead."
```

**Savings**: ~1,000 chars from GOODBYE alone

---

### Priority 3: Consolidate Tool Descriptions

**Current**: 40 tools × ~200 chars each = ~8,000 chars
**Issue**: Some descriptions are verbose
**Target**: Shorten to ~100 chars each = ~4,000 chars

**Example**:
```python
# BEFORE (verbose)
"mark_phone_verified": {
    "description": "Mark that caller's phone number has been verified. Call after confirming phone number with caller.",
    ...
}

# AFTER (concise)
"mark_phone_verified": {
    "description": "Mark phone verified after confirmation.",
    ...
}
```

**Savings**: ~4,000 chars

---

### Priority 4: Remove Emoji/Formatting

**Current**: Heavy use of ⚠️, ✅, ⏸️, →, etc.
**Savings**: ~500-1,000 chars across all nodes

---

### Priority 5: Simplify Step Criteria

**Current**: Detailed routing in step_criteria (avg 150 chars)
**Alternative**: Minimal criteria (avg 50 chars)

```
BEFORE:
"Route: calculations → QUOTE, booking → BOOK, wrong_person → GOODBYE, verified=false → VERIFY, qualified=false → QUALIFY, else → ANSWER"

AFTER:
"Greeting complete, identity confirmed"
```

**Note**: This removes routing guidance but keeps completion criteria
**Savings**: ~800 chars total
**Trade-off**: Less explicit, AI has to infer routing from valid_contexts

---

## Recommended Order (If Needed)

1. **Test first** - Deploy and check if SignalWire accepts it ✅
2. **If rejected** → Remove `role` fields (-2,400 chars)
3. **If still too big** → Condense GOODBYE (-1,000 chars)
4. **If still too big** → Shorten tool descriptions (-4,000 chars)
5. **Last resort** → Remove emojis + simplify criteria (-1,500 chars)

**Total available reduction**: ~8,900 chars (28% reduction)

---

## Current Status

✅ **Estimated payload**: ~40-50 KB  
✅ **Well under typical API limits** (100-500 KB)  
⚠️ **No action needed unless we get errors**

**Recommendation**: Deploy as-is and monitor. Only optimize if SignalWire rejects the payload.

---

## Monitoring Plan

### After deployment, watch for:

1. **HTTP 413 (Payload Too Large)** errors in logs
2. **Timeout errors** during SWML generation
3. **Truncated contexts** in SignalWire dashboard
4. **Performance issues** (slow context loading)

### If errors occur:

1. Check exact error message
2. Apply Priority 1 fix (remove roles)
3. Re-deploy and test
4. Escalate to Priority 2-5 if needed

---

## Bottom Line

**Current payload**: ~40-50 KB  
**Risk level**: **LOW** ✅  
**Action**: Deploy and monitor  
**Backup plan**: 5-step reduction strategy ready if needed

We're good to go! 🚀

