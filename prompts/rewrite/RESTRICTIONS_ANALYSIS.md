# Restrictions Analysis: Are We Being Too Restrictive?

**Date:** 2025-01-19  
**Purpose:** Analyze current tool and routing restrictions against "loose coupling" best practices

---

## 📊 Current Configuration Analysis

### Tool Availability Matrix

| Context | `search_knowledge` | `get_lead_context` | `verify_caller_identity` | Can Route to `answer` |
|---------|-------------------|-------------------|-------------------------|----------------------|
| **greet** | ❌ NO | ❌ NO | ✅ YES | ✅ YES |
| **verify** | ❌ NO | ✅ YES | ❌ NO | ✅ YES |
| **qualify** | ✅ YES | ❌ NO | ❌ NO | ✅ YES |
| **quote** | ✅ YES | ❌ NO | ❌ NO | ✅ YES |
| **book** | ✅ YES | ❌ NO | ❌ NO | ✅ YES |
| **answer** | ✅ YES | ❌ NO | ❌ NO | ❌ N/A (self) |
| **objections** | ✅ YES | ❌ NO | ❌ NO | ✅ YES |
| **exit** | ✅ YES | ❌ NO | ❌ NO | ✅ YES |

### Current Valid Contexts

| Context | Valid Next Contexts |
|---------|-------------------|
| **greet** | `["verify", "exit", "answer"]` ✅ |
| **verify** | `["qualify", "exit", "answer"]` ✅ |
| **qualify** | `["quote", "exit", "answer"]` ✅ |
| **quote** | `["answer", "book", "exit"]` ✅ |
| **book** | `["exit", "answer"]` ✅ |
| **answer** | `["objections", "book", "exit"]` ⚠️ |
| **objections** | `["answer", "book", "exit"]` ✅ |
| **exit** | `["answer", "greet"]` ✅ |

---

## 🔍 Identified Restrictions & Gaps

### ❌ **CRITICAL: Missing Core Tools**

#### 1. `search_knowledge` Not Available in Early Contexts
**Issue:** Users often ask questions during initial stages, but `search_knowledge` is only available in:
- ✅ `qualify`, `quote`, `book`, `answer`, `objections`, `exit`
- ❌ **MISSING from:** `greet`, `verify`

**Real-World Impact:**
- User in `greet`: "Hi, I have a question about reverse mortgages..."
  - Currently: Must route to `answer` (extra step)
  - Better: Can answer directly with `search_knowledge`

- User in `verify`: "Before we continue, can you explain how this works?"
  - Currently: Must route to `answer` or continue without answering
  - Better: Can answer directly

**Recommendation:** Add `search_knowledge` to `greet` and `verify` contexts.

---

#### 2. `get_lead_context` Only in One Context
**Issue:** Only `verify` has `get_lead_context` tool.

**Real-World Impact:**
- User calls back mid-flow (e.g., in `quote`): Tool not available to refresh lead data
- If lead data gets stale, can't refresh without routing to `verify`
- The `get_lead_context` tool has `switchcontext("answer")` logic for question routing, but it's not available when questions are asked

**Current Usage:**
- `get_lead_context` has special logic: If it detects a question, it calls `switchcontext("answer")`
- But if `get_lead_context` isn't available in the current context, this routing logic never triggers

**Recommendation:** 
- Option A: Add `get_lead_context` to more contexts (especially `exit`, `greet`)
- Option B: Keep `get_lead_context` only in `verify`, but ensure `search_knowledge` + `answer` routing is available everywhere

---

#### 3. `verify_caller_identity` Only in `greet`
**Issue:** If verification fails mid-call or caller identity needs re-verification, tool not available.

**Real-World Impact:**
- User in `quote`: "Wait, I need to check with my spouse who owns the home"
  - Can't re-verify identity without routing back to `greet`

**Recommendation:** 
- Generally OK - verification usually happens once at the start
- But consider: Should `exit` have it for wrong-person scenarios?

---

### ⚠️ **ROUTING RESTRICTIONS**

#### 1. `answer` Context Cannot Route to Itself or `greet`
**Issue:** `answer` has `valid_contexts: ["objections", "book", "exit"]` - **NO `greet` or `answer`**

**Real-World Impact:**
- User in `answer` asks a question that requires starting over: Can't route to `greet`
- User asks multiple questions in sequence: Must route through other contexts first
- User wants to restart conversation: No direct path to `greet`

**Recommendation:** Add `greet` and possibly `answer` (self) to `answer`'s `valid_contexts`.

---

#### 2. `exit` Cannot Route to Most Contexts
**Issue:** `exit` has `valid_contexts: ["answer", "greet"]` - Very limited.

**Real-World Impact:**
- User in `exit` decides they want to book after all: Can't route to `book` directly
- User wants to ask more questions about qualification: Must route through `answer` → `qualify` (indirect)
- User changes their mind: Can't easily get back into the flow

**Recommendation:** Consider adding more contexts to `exit`'s `valid_contexts` (e.g., `book`, `qualify`, `quote`).

---

## 🎯 Research Advice vs. Current State

### Research Recommendation: "Loose Coupling" with Strategic Defaults

**Key Principle:** 
> "Make critical tools (like `search_knowledge`, `verify_caller_identity`, etc.) available in *multiple* relevant contexts—especially in fallback or 'exit' contexts."

### Our Current State:

✅ **GOOD:**
- Most contexts can route to `answer` (escape hatch)
- `search_knowledge` is in 6/8 contexts (75%)
- `exit` has `search_knowledge` (good fallback)

❌ **TOO RESTRICTIVE:**
- `search_knowledge` NOT in `greet` or `verify` (early questions can't be answered directly)
- `get_lead_context` only in 1/8 contexts (12.5%) - but it has critical routing logic
- `answer` cannot route to `greet` (can't restart conversation)
- `exit` very limited routing options (only `answer`, `greet`)

---

## 🔧 Recommended Changes

### Priority 1: High Impact, Low Risk

1. **Add `search_knowledge` to `greet` and `verify`**
   - **Rationale:** Questions often come up early. Better to answer directly than route.
   - **Impact:** Faster question handling, fewer routing steps
   - **Risk:** Low - tool is safe to use anywhere

2. **Add `greet` to `answer`'s `valid_contexts`**
   - **Rationale:** Users might want to restart or ask basic questions
   - **Impact:** Better conversation flow, no dead ends
   - **Risk:** Low - just adds routing option

### Priority 2: Medium Impact, Medium Risk

3. **Add `get_lead_context` to `exit` and possibly `greet`**
   - **Rationale:** `get_lead_context` has critical `switchcontext("answer")` logic for question routing
   - **Impact:** Ensures question routing logic is available when questions are asked
   - **Risk:** Medium - tool might be called unnecessarily, but it toggles itself off after first use

4. **Consider adding more contexts to `exit`'s `valid_contexts`**
   - **Options:** Add `book`, `qualify`, `quote`
   - **Rationale:** Users in `exit` might change their mind or want to continue
   - **Impact:** More flexible conversation flow
   - **Risk:** Medium - might confuse LLM about when to use `exit` vs other contexts

### Priority 3: Low Priority

5. **Add `answer` (self) to `answer`'s `valid_contexts`**
   - **Rationale:** Multiple questions in sequence
   - **Impact:** Minor - usually not needed if other contexts work
   - **Risk:** Low

---

## 📝 Summary

**Current Restrictiveness Score: 6/10** (0 = too restrictive, 10 = fully open)

**Main Issues:**
1. `search_knowledge` missing from early contexts (`greet`, `verify`)
2. `get_lead_context` only in 1 context (but has critical routing logic)
3. `answer` context can't route to `greet` (no restart option)
4. `exit` context very limited routing

**Alignment with Research Advice:**
- ✅ Most contexts have escape hatches (`answer`, `exit`)
- ❌ Core tools not available in all relevant contexts
- ⚠️ Some routing paths too restrictive

**Recommended Action:**
- Start with Priority 1 changes (add `search_knowledge` to `greet`/`verify`, add `greet` to `answer`)
- Test impact before adding Priority 2 changes
- Monitor for tool misuse or LLM confusion

---

## 🧪 Testing Scenarios to Validate Changes

After making changes, test these scenarios:

1. **Early Question in `greet`:**
   - User: "Hi, before we start, can you explain how reverse mortgages work?"
   - Expected: Can use `search_knowledge` directly, or route to `answer`

2. **Question During Verification:**
   - User in `verify`: "Before I give you my info, what happens if I move?"
   - Expected: Can use `search_knowledge` directly, or route to `answer`

3. **Multiple Questions in `answer`:**
   - User asks question → gets answer → asks follow-up
   - Expected: Can stay in `answer` or route to `greet` if needed

4. **Change of Mind in `exit`:**
   - User in `exit`: "Actually, I want to book after all"
   - Expected: Can route to `book` (if we add it to `exit`'s `valid_contexts`)

