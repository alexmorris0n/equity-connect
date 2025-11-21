"""
Prompt for extracting core completion logic from mixed step criteria.

This is Phase 1 of the conversion process - cleaning the input before 
generating platform-specific versions.
"""

EXTRACTION_PROMPT = """You are extracting CORE completion logic from step criteria that may contain multiple types of instructions.

## Input Structure

The input may contain three types of information mixed together:
1. ✅ COMPLETION CRITERIA - What must be true/accomplished (KEEP THIS)
2. ❌ ROUTING LOGIC - "Then route to...", "If X go to Y" (REMOVE THIS)
3. ❌ NEXT ACTIONS - Instructions for after completion (REMOVE THIS)

## Your Task

Extract ONLY #1 (completion criteria). Remove routing and next actions.

Focus on:
- What state must be reached?
- What must be true or accomplished?
- What flags/conditions determine completion?

## Examples

### Example 1: Greet Node
INPUT:
"Complete after greeting and initial rapport. Route based on their response: 
If they ask about amounts → QUOTE. If they ask questions → ANSWER."

ANALYSIS:
- Completion: "after greeting and initial rapport" ✅
- Routing: "Route based on their response: If they ask..." ❌

OUTPUT:
"Initial greeting and rapport established"

---

### Example 2: Verify Node
INPUT:
"Complete when caller confirms their info is correct OR you've updated 
incorrect info. Then route based on their response: If they ask about 
loan amounts → QUOTE. If they have general questions → ANSWER."

ANALYSIS:
- Completion: "caller confirms their info OR you've updated incorrect info" ✅
- Routing: "Then route based on their response..." ❌

OUTPUT:
"Caller confirms identity and information is verified or updated"

---

### Example 3: Qualify Node
INPUT:
"Complete when you've gathered all missing qualification info, updated 
the database, and called mark_qualification_result. Then route based on 
qualified status and their response: If objections → OBJECTIONS. 
If qualified=true → QUOTE."

ANALYSIS:
- Completion: "gathered all missing qualification info, updated database, called mark_qualification_result" ✅
- Routing: "Then route based on qualified status..." ❌

OUTPUT:
"All qualification information gathered and qualification result recorded"

---

### Example 4: Answer Node
INPUT:
"Complete when you have answered their question. CRITICAL: If they ask 
about loan amounts/calculations → IMMEDIATELY route to QUOTE (do NOT 
answer yourself). For other questions: answer using CALLER INFORMATION 
or search_knowledge, then ask if they have more questions."

ANALYSIS:
- Completion: "answered their question" ✅
- Routing/Instructions: Everything about routing to QUOTE, how to answer ❌

OUTPUT:
"User's question has been answered"

---

### Example 5: Quote Node
INPUT:
"Complete when you've presented the equity estimate, gauged their reaction, 
and called mark_quote_presented. Route based on their reaction."

ANALYSIS:
- Completion: "presented the equity estimate, gauged reaction, called mark_quote_presented" ✅
- Routing: "Route based on their reaction" ❌

OUTPUT:
"Equity estimate presented and user reaction gauged"

---

### Example 6: Book Node (Simple)
INPUT:
"Appointment booked or declined"

ANALYSIS:
- Completion: All of it ✅
- No routing to remove

OUTPUT:
"Appointment booked or declined"

---

## Guidelines

1. Keep it concise - one sentence maximum
2. Remove ALL routing/transition logic
3. Remove procedural instructions
4. Focus on the STATE that indicates completion
5. Use past tense or "has been" construction
6. Don't add information not in the input

---

INPUT:
Node: {node_name}
Source: {step_criteria_source}

OUTPUT (just the extracted completion logic, one sentence, no explanation):
"""

