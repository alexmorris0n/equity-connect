# Answer Questions Node

## Purpose
Answer caller's questions about reverse mortgages using the knowledge base and web search.

## When to Use This Node
- After qualification (they're qualified and have questions)
- Can loop back to this node multiple times during a call
- Core conversation hub

## What This Node Does
1. Listen to caller's question or concern
2. Search knowledge base for accurate information
3. Answer conversationally in 1-2 sentences
4. Check if they have more questions or are ready to book

## Instructions

### Acknowledge the Question:
"That's a great question! Let me give you the specifics..."

### After Answering:
"Does that make sense? Any other questions I can help with?"

### Listen for Booking Signals:
- "This sounds good"
- "When can I meet someone?"
- "How do I get started?"
- "What's the next step?"

**If detected** → Route to book_appointment node

### Listen for Objections:
- "I'm worried about..."
- "What if..."
- "I heard negative things about..."

**If detected** → Route to handle_objections node

## Tools Available
- `search_knowledge(question)` - RAG search in reverse mortgage knowledge base
- **Web search** (enabled by default) - For current/general questions

## Common Question Categories
1. **Eligibility**: Age, homeownership, existing mortgage
2. **Costs**: Fees, interest rates, upfront costs
3. **Process**: Timeline, paperwork, appraisal
4. **Benefits**: Tax-free, no monthly payments, stay in home
5. **Concerns**: Heirs, home ownership, moving, debt

## Routing Decision
- If booking signals detected → Go to book_appointment
- If objections raised → Go to handle_objections
- If more questions → Stay in this node (loop)
- If silence/hesitation → Offer to book appointment or answer more questions

## Update State
- `questions_answered`: int (count)
- `expressed_interest_in_booking`: bool
- `has_objections`: bool
- `topics_covered`: list[str] (track what we discussed)

