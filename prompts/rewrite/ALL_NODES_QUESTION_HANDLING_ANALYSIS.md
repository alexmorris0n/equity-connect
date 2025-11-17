# All Nodes Question Handling Analysis

**Date:** 2025-01-19  
**Source:** Database (via MCP Supabase)  
**Purpose:** Analyze how each node handles questions when asked by the user

---

## 📊 Summary Table

| Node | Has `search_knowledge`? | Has `answer` in `valid_contexts`? | Mentions Questions in Instructions? | Current Behavior |
|------|-------------------------|-----------------------------------|-------------------------------------|------------------|
| **greet** | ✅ YES | ✅ YES | ❌ NO | **UNPREDICTABLE** - No guidance |
| **verify** | ✅ YES | ✅ YES | ❌ NO | **UNPREDICTABLE** - No guidance |
| **qualify** | ✅ YES | ✅ YES | ❌ NO | **UNPREDICTABLE** - No guidance |
| **quote** | ✅ YES | ✅ YES | ❌ NO | **UNPREDICTABLE** - No guidance |
| **book** | ✅ YES | ✅ YES | ❌ NO | **UNPREDICTABLE** - No guidance |
| **answer** | ✅ YES | ✅ YES (self) | ✅ YES | **DESIGNED FOR QUESTIONS** |
| **objections** | ✅ YES | ✅ YES | ❌ NO | **UNPREDICTABLE** - No guidance |
| **exit** | ✅ YES | ✅ YES | ✅ YES | **EXPLICIT: Routes to ANSWER** |

---

## 🔍 Detailed Node Analysis

### 1. **GREET** Node

**Tools Available:**
- ✅ `search_knowledge` (available)
- ✅ `get_lead_context` (available - has routing logic)

**Valid Contexts:**
- `verify`, `exit`, `answer`, `objections`

**Instructions Analysis:**
- ❌ **NO mention of question handling**
- ❌ **NO mention of `search_knowledge` tool**
- ❌ **NO mention of routing to `answer` for questions**
- Only says: "Next Context: `verify` (new callers) or `qualify` (returning verified callers)"

**Current Behavior:**
- **UNPREDICTABLE** - LLM could:
  1. Use `search_knowledge` directly in `greet` (tool available)
  2. Route to `answer` via `valid_contexts` (can route)
  3. Call `get_lead_context` which might route via `switchcontext("answer")` (if called)

**Issue:** No explicit guidance on what to do when user asks a question.

---

### 2. **VERIFY** Node

**Tools Available:**
- ✅ `search_knowledge` (available)
- ✅ `get_lead_context` (available - has routing logic)

**Valid Contexts:**
- `qualify`, `exit`, `answer`, `objections`

**Instructions Analysis:**
- ❌ **NO mention of question handling**
- ❌ **NO mention of `search_knowledge` tool**
- ❌ **NO mention of routing to `answer` for questions**
- Focus: Identity verification, contact info validation

**Current Behavior:**
- **UNPREDICTABLE** - Same as `greet`: Could use `search_knowledge` directly or route to `answer`.

**Issue:** No explicit guidance on what to do when user asks a question during verification.

---

### 3. **QUALIFY** Node

**Tools Available:**
- ✅ `search_knowledge` (available)
- ❌ `get_lead_context` (NOT available - removed in strategic rollback)

**Valid Contexts:**
- `quote`, `exit`, `answer`, `objections`

**Instructions Analysis:**
- ❌ **NO mention of question handling**
- ❌ **NO mention of `search_knowledge` tool**
- ❌ **NO mention of routing to `answer` for questions**
- Focus: Collecting 4 gate criteria (age, residence, mortgage, value)

**Current Behavior:**
- **UNPREDICTABLE** - Could use `search_knowledge` directly or route to `answer`.

**Issue:** No explicit guidance. Also, `get_lead_context` is NOT available here (strategic rollback), so no automatic routing via tool.

---

### 4. **QUOTE** Node

**Tools Available:**
- ✅ `search_knowledge` (available)
- ❌ `get_lead_context` (NOT available - removed in strategic rollback)

**Valid Contexts:**
- `answer`, `book`, `exit`, `objections`

**Instructions Analysis:**
- ❌ **NO mention of question handling**
- ❌ **NO mention of `search_knowledge` tool**
- ✅ **DOES mention routing to `answer`** - Says: "Positive but immediately asks a question: mark reaction `positive`, answer their question by routing to Answer before trying to book."
- But this is only for "immediately after quote" - what about questions mid-quote?

**Current Behavior:**
- **PARTIALLY GUIDED** - Instructions mention routing to `answer` for questions, but only in specific scenario (after quote presentation).

**Issue:** Guidance exists but is scenario-specific, not universal.

---

### 5. **BOOK** Node

**Tools Available:**
- ✅ `search_knowledge` (available)
- ❌ `get_lead_context` (NOT available - removed in strategic rollback)

**Valid Contexts:**
- `exit`, `answer`, `objections`

**Instructions Analysis:**
- ❌ **NO mention of question handling**
- ❌ **NO mention of `search_knowledge` tool**
- ❌ **NO mention of routing to `answer` for questions**
- Focus: Scheduling appointment, checking availability

**Current Behavior:**
- **UNPREDICTABLE** - Could use `search_knowledge` directly or route to `answer`.

**Issue:** No explicit guidance on what to do when user asks a question during booking.

---

### 6. **ANSWER** Node

**Tools Available:**
- ✅ `search_knowledge` (available - PRIMARY TOOL)

**Valid Contexts:**
- `book`, `exit`, `greet`, `objections`, `answer` (self-loop)

**Instructions Analysis:**
- ✅ **EXPLICITLY DESIGNED FOR QUESTIONS**
- ✅ **Mentions `search_knowledge` tool extensively**
- ✅ **Has clear question handling flow**
- Instructions: "Acknowledge Question" → "Decide Whether to Search" → "Answer in ≤2 Sentences"

**Current Behavior:**
- **DESIGNED FOR QUESTIONS** - This is the dedicated Q&A context.

**Status:** ✅ **GOOD** - This node is correctly configured.

---

### 7. **OBJECTIONS** Node

**Tools Available:**
- ✅ `search_knowledge` (available)

**Valid Contexts:**
- `answer`, `book`, `exit`, `greet`, `objections` (self-loop)

**Instructions Analysis:**
- ❌ **NO explicit mention of question handling**
- ✅ **Mentions `search_knowledge` tool** - But only for "factual reassurance" (non-recourse, FHA insurance)
- ✅ **DOES mention routing to `answer`** - Says: "New questions → ANSWER"

**Current Behavior:**
- **PARTIALLY GUIDED** - Instructions mention routing to `answer` for "new questions", but not clear if this means "questions vs objections" or "any question".

**Issue:** Guidance exists but could be clearer.

---

### 8. **EXIT** Node

**Tools Available:**
- ✅ `search_knowledge` (available)
- ✅ `get_lead_context` (available - has routing logic)

**Valid Contexts:**
- `answer`, `greet`, `objections`, `book`, `qualify`, `quote`

**Instructions Analysis:**
- ✅ **EXPLICIT QUESTION HANDLING SECTION**
- ✅ **Clear routing instruction**: "CRITICAL: If the caller asks ANY question: Route to the ANSWER context immediately"
- ✅ **Explicit tool guidance**: "Do NOT try to answer questions in this context - you don't have the knowledge search tool here" (NOTE: This is INCORRECT - `search_knowledge` IS available, but the intent is clear: route to ANSWER)
- ✅ **Explicit `get_lead_context` handling**: "When get_lead_context tool completes AND user asked a question: IMMEDIATELY route to ANSWER context"

**Current Behavior:**
- **EXPLICITLY GUIDED** - Clear instructions to route to `answer` for questions.

**Status:** ✅ **GOOD** - This node has explicit question handling (though the "don't have search_knowledge" note is technically incorrect, the intent is clear).

---

## 🎯 Key Findings

### ✅ **What's Working:**
1. **ANSWER node** - Explicitly designed for questions, has clear flow
2. **EXIT node** - Has explicit question handling instructions
3. **All nodes have `search_knowledge` available** - Universal tool access
4. **All nodes have `answer` in `valid_contexts`** - Escape hatch routing available

### ⚠️ **What's Missing:**
1. **GREET, VERIFY, QUALIFY, QUOTE, BOOK, OBJECTIONS** - No explicit question handling instructions
2. **Inconsistent guidance** - Some nodes mention routing to `answer` in specific scenarios, but not universally
3. **Tool confusion** - EXIT says "you don't have search_knowledge" but it's actually available (intent is clear though)

---

## 💡 Recommendations

### **Option 1: Universal Question Handling Pattern (Recommended)**

Add this section to **ALL nodes** (except `answer` and `exit` which already have it):

```markdown
## Handling Questions

**CRITICAL:** If the caller asks ANY question:
1. Acknowledge briefly: "That's a great question! Let me answer that for you."
2. **Route immediately to ANSWER context** (ANSWER is designed for question handling with search_knowledge tool)
3. After questions are answered in ANSWER context, caller can route back to continue the flow

**DO NOT** try to answer questions in this context - route to ANSWER for proper handling.
```

**Nodes to update:**
- ✅ `greet` - Add question handling section
- ✅ `verify` - Add question handling section
- ✅ `qualify` - Add question handling section
- ✅ `quote` - Enhance existing guidance (make it universal, not scenario-specific)
- ✅ `book` - Add question handling section
- ✅ `objections` - Enhance existing guidance (make it clearer)

**Rationale:**
- Consistent behavior across all nodes
- Uses dedicated Q&A context (`answer` has proper instructions)
- Aligns with escape hatch pattern we implemented
- Clear, simple rule: "Questions → Route to `answer`"

---

### **Option 2: Hybrid Approach (More Complex)**

**For early nodes (greet, verify, qualify):**
- Simple questions → Answer directly with `search_knowledge`
- Complex/multiple questions → Route to `answer`

**For later nodes (quote, book, objections):**
- All questions → Route to `answer`

**Rationale:**
- Faster for simple questions in early flow
- More consistent for complex scenarios

**Downside:**
- LLM needs to make decision (might be inconsistent)
- More complex instructions

---

## 🚀 Implementation Priority

### **High Priority (Do Now):**
1. ✅ Add question handling to `greet` (most common entry point)
2. ✅ Add question handling to `verify` (early in flow)
3. ✅ Add question handling to `qualify` (mid-flow)

### **Medium Priority:**
4. ✅ Enhance `quote` guidance (make universal, not scenario-specific)
5. ✅ Add question handling to `book` (late in flow)
6. ✅ Enhance `objections` guidance (make clearer)

### **Low Priority:**
7. ✅ Fix EXIT node note (it says "don't have search_knowledge" but it's available - though intent is clear)

---

## 🧪 Test Scenarios

After implementing, test these scenarios:

1. **Question in GREET:**
   - User: "Hi, before we start, what exactly is a reverse mortgage?"
   - Expected: Route to `answer` → Use `search_knowledge` → Answer → Route back to `greet`/`verify`

2. **Question in VERIFY:**
   - User: "Why do you need my email?"
   - Expected: Route to `answer` → Answer → Route back to `verify`

3. **Question in QUALIFY:**
   - User: "Why does age matter?"
   - Expected: Route to `answer` → Answer → Route back to `qualify`

4. **Question in QUOTE:**
   - User: "How are these fees calculated?"
   - Expected: Route to `answer` → Answer → Route back to `quote`/`book`

5. **Question in BOOK:**
   - User: "What should I bring to the appointment?"
   - Expected: Route to `answer` → Answer → Route back to `book`/`exit`

6. **Question in EXIT (already working):**
   - User: "If I die, can my wife stay in the house?"
   - Expected: Route to `answer` → Answer → Route back to `exit` if needed

---

## 📝 Next Steps

1. **Review this analysis** - Confirm the universal routing pattern is the right approach
2. **Implement question handling** - Add explicit instructions to all nodes
3. **Test scenarios** - Verify routing works correctly
4. **Update trace tests** - Add question scenarios to trace_test.md

---

## 🔗 Related Documents

- `trace_test.md` - Test scenarios including question handling
- `trace_results.md` - Results of trace tests
- `QUESTION_HANDLING_ANALYSIS.md` - Initial analysis for `greet` node
- `PUSHBACK_ANALYSIS.md` - Strategic tool placement analysis

