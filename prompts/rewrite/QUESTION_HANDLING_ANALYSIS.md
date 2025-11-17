# Question Handling Analysis: What Happens in `greet`?

**Date:** 2025-01-19  
**Question:** If user asks a question in `greet`, does it route to `answer` or use `search_knowledge` directly?

---

## 🔍 Current State Analysis

### `greet` Context Configuration:

**Tools Available:**
- ✅ `search_knowledge` - Can answer questions directly
- ✅ `get_lead_context` - Has routing logic (`switchcontext("answer")` if question detected)

**Routing Options:**
- ✅ `answer` in `valid_contexts` - Can route to answer context

**Instructions:**
- ❌ **NO mention of question handling**
- ❌ **NO mention of `search_knowledge` tool**
- ❌ **NO mention of `answer` context for questions**
- Only says: "Next Context: `verify` (new callers) or `qualify` (returning verified callers)"

---

## ⚠️ The Problem: Unpredictable Behavior

When a user asks a question in `greet`, the LLM has **3 possible paths** with **no explicit guidance**:

### Path A: Use `search_knowledge` Directly
**What happens:**
- LLM sees `search_knowledge` tool is available
- Uses it directly to answer question in `greet` context
- Stays in `greet` context
- **Pros:** Fast, no routing overhead, immediate answer
- **Cons:** `greet` isn't designed for Q&A (no specific instructions)

### Path B: Route to `answer` Context
**What happens:**
- LLM sees `answer` is in `valid_contexts`
- Routes to `answer` context (dedicated for questions)
- Uses `search_knowledge` in `answer` context
- **Pros:** Uses dedicated Q&A context with proper instructions
- **Cons:** Extra routing step, might seem slower

### Path C: Call `get_lead_context` → Auto-Route
**What happens:**
- LLM calls `get_lead_context` (maybe to get lead data)
- `get_lead_context` detects question in conversation history
- Calls `switchcontext("answer")` programmatically
- Routes to `answer` context
- **Pros:** Automatic routing, ensures consistency
- **Cons:** Only works if `get_lead_context` is called, indirect

---

## 🎯 Recommended Solution: Explicit Instructions

### Option 1: Answer Directly in `greet` (Simpler)

**Add to `greet` instructions:**
```
## Handling Questions

If the caller asks a question during greeting:
1. Use `search_knowledge(question)` to find the answer
2. Answer conversationally (1-2 sentences)
3. After answering, continue with normal greet flow (verify/qualify)
4. If they have more questions, you can continue answering or route to ANSWER context

**Example:**
- User: "Hi, before we start, what exactly is a reverse mortgage?"
- You: [Use search_knowledge] → Answer → Continue greeting → Route to verify/qualify
```

**Pros:**
- ✅ Simple, fast (no routing)
- ✅ Natural conversation flow
- ✅ Works immediately

**Cons:**
- ⚠️ `greet` context becomes more complex
- ⚠️ Might need multiple Q&A exchanges in `greet`

---

### Option 2: Route to `answer` Context (More Consistent)

**Add to `greet` instructions:**
```
## Handling Questions

If the caller asks a question during greeting:
1. Acknowledge briefly: "Great question! Let me answer that for you."
2. Route to ANSWER context (use ANSWER context for question handling)
3. After questions are answered in ANSWER context, you can route back to greet/verify

**CRITICAL:** If caller asks a question, route to ANSWER context immediately.
```

**Pros:**
- ✅ Uses dedicated Q&A context (`answer` has proper instructions)
- ✅ Consistent question handling across all contexts
- ✅ Better separation of concerns

**Cons:**
- ⚠️ Extra routing step
- ⚠️ More context transitions

---

### Option 3: Hybrid (Smart Routing)

**Add to `greet` instructions:**
```
## Handling Questions

If the caller asks a question during greeting:
- **Simple questions** (1 quick question): Use `search_knowledge` directly in greet
- **Complex questions or multiple questions**: Route to ANSWER context
- **After answering**: Continue with normal greet flow (verify/qualify)

**Decision:**
- Single, simple question → Answer directly with `search_knowledge`
- Complex/multiple questions → Route to ANSWER context
```

**Pros:**
- ✅ Flexible, adapts to situation
- ✅ Simple questions stay fast
- ✅ Complex questions get dedicated handling

**Cons:**
- ⚠️ LLM needs to make decision (might be inconsistent)
- ⚠️ More complex instructions

---

## 💡 My Recommendation: Option 2 (Route to `answer`)

**Rationale:**
1. **Consistency:** Same question handling everywhere (route to `answer`)
2. **Dedicated Context:** `answer` context is designed for Q&A with proper instructions
3. **Escape Hatch Pattern:** We just implemented escape hatches - routing to `answer` from any context fits this pattern
4. **Simpler Instructions:** Clear rule: "Questions → Route to `answer`"

**The instruction should be:**
```
## Handling Questions

**CRITICAL:** If the caller asks ANY question during greeting:
1. Acknowledge briefly: "That's a great question! Let me answer that for you."
2. **Route immediately to ANSWER context** (ANSWER is designed for question handling)
3. After questions are answered in ANSWER context, caller can route back to verify/qualify as needed
```

---

## 🧪 How to Test

After adding instructions, test this scenario:

**Test Case:**
1. Call starts in `greet`
2. User: "Hi, I have a question - what exactly is a reverse mortgage?"
3. **Expected:** Barbara acknowledges → Routes to `answer` → Uses `search_knowledge` → Answers → Asks if ready to continue → Routes back to verify/qualify if needed

**What to check:**
- ✅ Does it route to `answer`? (check logs for context switch)
- ✅ Does it use `search_knowledge` in `answer` context?
- ✅ Does it answer correctly?
- ✅ Does it route back appropriately after answering?

---

## 🚀 Next Step

**Recommendation:** Add explicit question handling instructions to `greet` context following Option 2 (route to `answer`).

This ensures:
- ✅ Predictable behavior
- ✅ Consistent question handling
- ✅ Uses dedicated Q&A context
- ✅ Aligns with escape hatch pattern

Would you like me to:
1. Add the question handling instructions to `greet` context?
2. Test to see what currently happens?
3. Do both?

