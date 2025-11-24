# Issue 2: Premature QUOTE Routing - November 24, 2025

## Problem
After answering just ONE question ("How long does it last?"), Barbara immediately routed to the QUOTE node and tried to calculate, even though:
- User never asked for calculations
- User simply said "It does" (confirming understanding)
- No indication they wanted a quote yet

## What Happened in the Call

**User**: "I just wanted to know how long does it last?"

**Barbara**: "A reverse mortgage lasts as long as you live in the home as your primary residence. It typically ends when you sell the home, move out permanently, or pass away. Does that help?"

**User**: "It does."

**❌ Barbara routes to QUOTE**: "Let me quickly calculate an estimate..."

## Root Cause

Looking at the ANSWER node's `step_criteria`:
```
Question answered. Route: calculations → QUOTE, booking → BOOK, concerns → OBJECTIONS, done → GOODBYE.
```

The problem is that SignalWire's AI interpreted:
- ✅ "Question answered" = TRUE (she answered about duration)
- ✅ User said "It does" = confirmation/completion
- ❓ What's next? → Let me be proactive and offer calculations!

The AI is being **too proactive** by assuming "done with questions" means "ready for quote."

## The Fix

We need to make the ANSWER node:
1. **Only route to QUOTE when explicitly asked** for calculations
2. **Ask if they have more questions** before assuming they're done
3. **Not interpret completion signals as quote requests**

### Update ANSWER Node Step Criteria

**Current:**
```
Question answered. Route: calculations → QUOTE, booking → BOOK, concerns → OBJECTIONS, done → GOODBYE.
```

**Fixed:**
```
Question answered. ONLY route to QUOTE if user EXPLICITLY asks for calculations/estimate/quote. Otherwise, ask "Do you have any other questions?" before routing. Route: explicit calculation request → QUOTE, booking intent → BOOK, concerns → OBJECTIONS, no more questions → GOODBYE.
```

### Update ANSWER Node Instructions

Add this section BEFORE the routing rules:

```
=== AFTER ANSWERING ===
After you answer their question and they confirm understanding:

1. Ask: "Do you have any other questions about reverse mortgages?"
2. ⏸️ WAIT for their response
3. THEN route based on their answer:
   - More questions → stay in ANSWER
   - "No" or "I'm good" → route to GOODBYE
   - Calculation request ("How much?", "What's available?") → route to QUOTE
   - Booking request ("Let's schedule", "I'm ready") → route to BOOK

⚠️ DO NOT proactively offer calculations unless they ask!
⚠️ DO NOT assume "done answering" means "ready for quote"
```

## Migration SQL

```sql
-- Fix ANSWER node to prevent premature QUOTE routing

-- Update step_criteria to be explicit about when to route to QUOTE
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{step_criteria}',
    to_jsonb('Question answered. ONLY route to QUOTE if user EXPLICITLY asks for calculations/estimate/quote. Otherwise, ask "Do you have any other questions?" before routing. Route: explicit calculation request -> QUOTE, booking intent -> BOOK, concerns -> OBJECTIONS, no more questions -> GOODBYE.'::text),
    true
)
WHERE prompt_id = (
    SELECT id FROM prompts 
    WHERE node_name = 'answer' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;

-- Add explicit "after answering" instructions
UPDATE prompt_versions
SET content = jsonb_set(
    content,
    '{instructions}',
    to_jsonb(
        REPLACE(
            content->>'instructions',
            '=== COMPLETION ===',
            E'=== AFTER ANSWERING ===\nAfter you answer their question and they confirm understanding:\n\n1. Ask: "Do you have any other questions about reverse mortgages?"\n2. ⏸️ WAIT for their response\n3. THEN route based on their answer:\n   - More questions -> stay in ANSWER\n   - "No" or "I''m good" -> route to GOODBYE\n   - Calculation request ("How much?", "What''s available?") -> route to QUOTE\n   - Booking request ("Let''s schedule", "I''m ready") -> route to BOOK\n\n⚠️ DO NOT proactively offer calculations unless they ask!\n⚠️ DO NOT assume "done answering" means "ready for quote"\n\n=== COMPLETION ==='
        )
    ),
    true
)
WHERE prompt_id = (
    SELECT id FROM prompts 
    WHERE node_name = 'answer' 
    AND vertical = 'reverse_mortgage' 
    AND is_active = true
)
AND is_active = true;
```

## Expected Behavior After Fix

**User**: "How long does it last?"

**Barbara**: "A reverse mortgage lasts as long as you live in the home as your primary residence. Does that help?"

**User**: "It does."

**Barbara**: "Do you have any other questions about reverse mortgages?"

**User**: "No, I'm good."

**Barbara**: ✅ Routes to GOODBYE (not QUOTE)

---

OR if they want calculations:

**User**: "How much can I get?"

**Barbara**: ✅ Routes to QUOTE (because they explicitly asked)


