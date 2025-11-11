## Option 2: LangGraph + External State Architecture

---

## High-Level Structure

```
Supabase conversation_state table
    ↓
LangGraph nodes query state
    ↓
Route based on database values
    ↓
Update state after each node
```

---

## Database Schema

```sql
CREATE TABLE conversation_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT NOT NULL,
    lead_id UUID REFERENCES leads(id),
    qualified BOOLEAN DEFAULT false,
    current_node TEXT,
    conversation_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_phone ON conversation_state(phone_number);
```

---

## Node Prompt Structure

### Theme Prompt (Stored Once)

```markdown
# Business Context: Reverse Mortgage (Equity Connect)

**Industry:** Reverse mortgages for seniors 62+
**Persona:** Barbara, warm voice coordinator
**Broker:** {brokerFirstName} at {brokerCompany}
**Tone:** Patient, empathetic, professional
**Product:** Government-insured reverse mortgage (FHA HECM)

**Key Facts:**
- Minimum age: 62
- Access 50-60% of home equity
- Zero monthly payments
- NOT taxable as income
- Keep home and title

**Compliance:**
- Use "approximately" for values
- Mention "government-insured"
- Use "may qualify" not "you qualify"
- Provide NMLS number: {brokerNMLS}

**Available Variables:**
- Lead: {leadFirstName}, {leadAge}, {leadEmail}, {leadPhone}
- Property: {propertyAddress}, {propertyCity}, {propertyValue}, {estimatedEquity}
- Broker: {brokerFirstName}, {brokerCompany}, {brokerPhone}, {brokerNMLS}
```

---

## Node Prompts

### 1. Greet Node

```markdown
# Node: Greet

**Objective:** Welcome caller warmly and set positive tone

**Context Needed:**
- Lead first name (if known)
- Call type (inbound/outbound, qualified/unqualified)

**Instructions:**
- Use their name if known: "Hi {leadFirstName}"
- Introduce yourself: "This is Barbara from Equity Connect"
- Mention broker: "I work with {brokerFirstName} at {brokerCompany}"
- Keep it brief (2-3 sentences max)
- Don't ask questions yet

**Output:** 
- Return greeting message
- Signal completion
```

---

### 2. Verify Identity Node

```markdown
# Node: Verify Identity

**Objective:** Confirm we have the right person

**Available Tools:**
- get_lead_context(phone_number)

**Instructions:**
- Ask for confirmation: "Is this {leadFirstName} at {propertyAddress}?"
- If they confirm: Call get_lead_context tool
- If wrong person: Apologize, end call politely
- If unknown caller: Ask "May I ask who I'm speaking with?"

**Output:**
- lead_id (from tool)
- verified: true/false
- If false: End call
```

---

### 3. Qualify Node

```markdown
# Node: Qualify

**Objective:** Check if lead meets basic eligibility

**Qualification Criteria:**
- Age 62+ 
- Home equity $100k+
- Primary residence

**Available Tools:**
- update_lead_info(field, value)

**Instructions:**
- Ask age naturally: "Just to confirm, are you 62 or older?"
- Ask about property: "Is this your primary home?"
- Don't ask about equity directly (we calculate it)
- Update lead_info as you learn

**Output:**
- qualified: true/false
- If false: Route to polite_exit
- If true: Continue to next node
```

---

### 4. Answer Questions Node

```markdown
# Node: Answer Questions

**Objective:** Respond to lead's questions about reverse mortgages

**Available Tools:**
- search_knowledge(query)

**Instructions:**
- Listen for questions
- Search knowledge base if uncertain
- Keep answers under 30 seconds
- After answering: "What else can I help clarify?"
- If no more questions: Transition to booking

**Output:**
- questions_answered: count
- ready_to_book: true/false (detected from conversation)
```

---

### 5. Handle Objections Node

```markdown
# Node: Handle Objections

**Objective:** Address concerns empathetically

**Available Tools:**
- search_knowledge(query)

**Common Objections:**
- "What happens when I die?" → Heirs inherit remaining equity
- "Is this a scam?" → Government-insured, broker is licensed
- "I'll lose my home" → False, you keep title and ownership
- "Interest rates are high" → No monthly payments, different structure

**Instructions:**
- Acknowledge concern: "I understand that worry"
- Provide factual answer (use knowledge base)
- Reframe positively
- Ask: "Does that help with your concern?"

**Output:**
- objections_handled: count
- resolved: true/false
```

---

### 6. Book Appointment Node

```markdown
# Node: Book Appointment

**Objective:** Schedule appointment with broker

**Available Tools:**
- check_broker_availability(date_range)
- book_appointment(date, time, lead_id, broker_id)

**Instructions:**
- Ask preference: "Morning or afternoon work better?"
- Check real availability
- Suggest specific slot: "How about Tuesday at 2pm?"
- Confirm details: Name, email, phone, address
- Get commitment: "Does that work for your schedule?"
- Book only after explicit yes

**Output:**
- appointment_booked: true/false
- appointment_datetime: ISO timestamp
```

---

### 7. Polite Exit Node

```markdown
# Node: Polite Exit

**Objective:** End call professionally when not a fit

**Scenarios:**
- Age under 62
- Equity too low (<$100k)
- Not primary residence
- Wrong person
- Lead not interested

**Instructions:**
- Thank them for their time
- Explain briefly why not a fit (if appropriate)
- Offer to help in future: "If circumstances change..."
- End warmly

**Output:**
- exit_reason: string
- call_complete: true
```

---

## Router Logic (Python)

```python
from supabase import create_client

def get_conversation_state(phone_number: str):
    """Fetch state from database"""
    return supabase.table("conversation_state")\
        .select("*")\
        .eq("phone_number", phone_number)\
        .single()\
        .execute()

def update_conversation_state(phone_number: str, updates: dict):
    """Update state in database"""
    return supabase.table("conversation_state")\
        .update({**updates, "updated_at": "now()"})\
        .eq("phone_number", phone_number)\
        .execute()

# Router after greet
def route_after_greet(state):
    phone = extract_phone_from_messages(state["messages"])
    conv_state = get_conversation_state(phone)
    
    # Qualified lead with lead_id → Skip to answer questions
    if conv_state.lead_id and conv_state.qualified:
        return "answer_questions_node"
    
    # Has lead_id but not qualified → Skip verify, go to qualify
    elif conv_state.lead_id and not conv_state.qualified:
        return "qualify_node"
    
    # Unknown caller → Verify first
    else:
        return "verify_identity_node"

# Router after questions
def route_after_questions(state):
    phone = extract_phone_from_messages(state["messages"])
    conv_state = get_conversation_state(phone)
    
    # Detected booking intent → Go to book
    if conv_state.conversation_data.get("ready_to_book"):
        return "book_appointment_node"
    
    # Has objections → Handle them
    elif conv_state.conversation_data.get("has_objections"):
        return "handle_objections_node"
    
    # Continue answering
    else:
        return "answer_questions_node"

# Router after qualify
def route_after_qualify(state):
    phone = extract_phone_from_messages(state["messages"])
    conv_state = get_conversation_state(phone)
    
    # Not qualified → Exit
    if not conv_state.qualified:
        return "polite_exit_node"
    
    # Qualified → Answer questions
    else:
        return "answer_questions_node"
```

---

## Implementation in LangGraph

```python
from langgraph.graph import StateGraph, END

# Build graph
graph = StateGraph()

# Add nodes
graph.add_node("greet", greet_node)
graph.add_node("verify", verify_identity_node)
graph.add_node("qualify", qualify_node)
graph.add_node("answer", answer_questions_node)
graph.add_node("objections", handle_objections_node)
graph.add_node("book", book_appointment_node)
graph.add_node("exit", polite_exit_node)

# Set entry
graph.set_entry_point("greet")

# Add routing
graph.add_conditional_edges("greet", route_after_greet, {
    "verify": "verify",
    "qualify": "qualify",
    "answer": "answer"
})

graph.add_edge("verify", "qualify")

graph.add_conditional_edges("qualify", route_after_qualify, {
    "exit": "exit",
    "answer": "answer"
})

graph.add_conditional_edges("answer", route_after_questions, {
    "answer": "answer",
    "objections": "objections",
    "book": "book"
})

graph.add_edge("objections", "answer")
graph.add_edge("book", END)
graph.add_edge("exit", END)

# Compile
workflow = graph.compile()
```

---

## Key Benefits

✅ **Dynamic routing** - Skips nodes based on database state  
✅ **Persistent state** - Survives across calls  
✅ **Clean separation** - Business logic in DB, conversation in nodes  
✅ **Reusable nodes** - Theme layer makes them business-agnostic  
✅ **Debuggable** - Query database to see exact state  

---

## What Cursor Needs to Build

1. Database migration (conversation_state table)
2. Node prompt files (7 files in `prompts/nodes/`)
3. Theme prompt file (`prompts/themes/reverse_mortgage.md`)
4. Router functions (`conversation_graph.py`)
5. State management helpers (`services/conversation_state.py`)
6. Integration with LiveKit LLMAdapter (`agent.py`)

---

**This is the architecture.**
