# SignalWire: step_criteria & valid_contexts - Official Documentation
**Date:** November 24, 2025  
**Source:** SignalWire SWML Documentation

---

## **1. `step_criteria` - Step Completion Criteria**

### **Definition**
From SignalWire docs (line 530):
> **"The criteria that must be met for the AI to proceed to the next step. The criteria is an instruction given to the AI. It's highly recommended you create a custom criteria for the step to get the intended behavior."**

### **Key Properties**
- **Type**: `string` (optional)
- **Default**: None (AI decides when to proceed)
- **Purpose**: Instructs the AI on **when** the current step is complete
- **Enforcement**: **AI-interpreted** (not a hard technical constraint, but a strong instruction to the LLM)

### **How It Works**
1. The AI reads `step_criteria` as part of the step instructions
2. The AI evaluates if the criteria is met based on conversation state
3. When met, the AI signals completion and routing logic activates
4. If NOT met, the AI stays in the current step

### **Best Practices**
✅ **DO:**
- Be explicit: "Identity confirmed. IF verified=false MUST route to VERIFY"
- Include routing logic: "Route to QUOTE if quote_presented=false"
- Specify flags: "All 3 tools called (mark_phone_verified, mark_email_verified, mark_address_verified)"
- Use conditionals: "IF user says 'no' → route to GOODBYE"

❌ **DON'T:**
- Be vague: "Greeting complete" (What does "complete" mean?)
- Omit routing: "Question answered" (Where should it go next?)
- Rely on inference: "User is satisfied" (How does AI know?)

---

## **2. `valid_contexts` - Context Routing Whitelist**

### **Definition**
From SignalWire docs (line 532):
> **"An array of context names that the AI can transition to from this step. This must be a valid `contexts.name` that is present in your contexts object."**

### **Key Properties**
- **Type**: `string[]` (array of context names, optional)
- **Default**: Cannot transition to other contexts (stays within current context)
- **Purpose**: **HARD CONSTRAINT** - defines which contexts are **technically allowed** for routing
- **Enforcement**: **System-enforced** (SignalWire blocks transitions not in this list)

### **How It Works**
1. When AI wants to switch contexts, SignalWire checks `valid_contexts` array
2. If target context is in the array → ✅ Transition allowed
3. If target context is NOT in the array → ❌ Transition blocked (stays in current context)
4. This is a **whitelist**, not a suggestion

### **Critical Understanding**
- `valid_contexts` is NOT about "what should happen"
- `valid_contexts` is about "what CAN happen"
- It's a **permission system**, not routing logic
- The AI still needs `step_criteria` instructions to know **when/why** to route

### **Example from Docs (lines 293-295)**
```yaml
- name: transfer
  text: You will now successfully transfer the user to the Star Wars or Star Trek expert.
  step_criteria: If the user has chosen a valid context, transfer them to the appropriate expert.
  valid_contexts:
    - starwars
    - startrek
```

**This means:**
- ✅ AI **CAN** route to `starwars` or `startrek` (whitelisted)
- ❌ AI **CANNOT** route to any other context (e.g., `billing`, `support`) - blocked by system
- `step_criteria` tells AI **when** to route ("user has chosen a valid context")

---

## **3. How They Work Together**

### **The Two-Layer System**

**Layer 1: `step_criteria` (AI Decision Layer)**
- "What needs to happen for this step to complete?"
- "Where should we go next?"
- AI interprets and makes routing decisions

**Layer 2: `valid_contexts` (System Enforcement Layer)**
- "What contexts are physically allowed?"
- "Block any transitions not in this list"
- System enforces hard constraints

### **Example: GREET Node**

**WRONG Approach (Before Fix):**
```json
{
  "step_criteria": "Identity confirmed",
  "valid_contexts": ["verify", "qualify", "answer", "quote", "book", "goodbye"]
}
```
**Problem:** AI sees 6 options, treats `verify` as optional, defaults to `answer`

**CORRECT Approach (After Fix):**
```json
{
  "step_criteria": "Identity confirmed. IF verified=false MUST route to VERIFY. IF verified=true: qualified=false → QUALIFY, else → ANSWER",
  "valid_contexts": ["verify", "qualify", "answer", "quote", "book", "goodbye"]
}
```
**Solution:** `step_criteria` explicitly tells AI the routing logic with conditionals

---

## **4. Common Patterns from Docs**

### **Pattern 1: Sequential Flow with Choice**
```yaml
- name: question
  text: Ask user to choose between Jedi Order or The Force
  step_criteria: User must provide a valid answer to continue
  valid_steps:
    - jedi_order
    - force
  valid_contexts:
    - startrek  # Can also switch to other expert
```

### **Pattern 2: Completion with Mandatory Route**
```yaml
- name: greeting
  text: Greet the user and determine their need
  step_criteria: If they need technical support, transfer to support context
  valid_contexts:
    - support
```

### **Pattern 3: Topic-Specific with Return**
```yaml
- name: jedi_order
  text: Limit the topic to the Jedi Order
  step_criteria: The user says they want to change the topic
  valid_steps:
    - question  # Can return to question step
```

---

## **5. Our Implementation Strategy**

### **For Each Node:**

1. **`step_criteria` = Routing Logic + Completion Condition**
   - Explicit IF/THEN conditions
   - Flag checks (e.g., "IF phone_verified=false")
   - Tool call requirements (e.g., "All 3 tools called")
   - Routing instructions (e.g., "MUST route to VERIFY")

2. **`valid_contexts` = All Possible Destinations**
   - List every context the node might need to reach
   - Think about all scenarios (happy path, error path, user-driven)
   - Missing a context = hard block by SignalWire

### **Example: ANSWER Node**

**`step_criteria`:**
```
"Question answered. ONLY route to QUOTE if user EXPLICITLY asks for calculations.
Otherwise, ask 'Do you have any other questions?' before routing.
Route: explicit calculation request -> QUOTE, booking -> BOOK, concerns -> OBJECTIONS, no questions -> GOODBYE."
```

**`valid_contexts`:**
```json
["quote", "book", "objections", "goodbye", "verify", "qualify"]
```
- Includes `verify` and `qualify` in case user reveals they're not verified/qualified during conversation

---

## **6. Debugging Checklist**

When Barbara routes incorrectly:

**Step 1: Check `valid_contexts`**
- [ ] Is the target context in the array?
- [ ] If NO → Add it to `valid_contexts`

**Step 2: Check `step_criteria`**
- [ ] Does it explicitly state routing conditions?
- [ ] Does it use IF/THEN logic for flags?
- [ ] Is it clear when to route vs. stay?
- [ ] If NO → Update `step_criteria` with explicit logic

**Step 3: Check Tool Availability**
- [ ] Are required tools in the `tools` array?
- [ ] Do tool calls match the tool definitions?
- [ ] Are ENTRY CHECKs evaluating the right flags?

---

## **7. Key Takeaways**

✅ **`step_criteria`** = "What should happen and when" (AI-interpreted instructions)
✅ **`valid_contexts`** = "What CAN happen" (System-enforced whitelist)
✅ **Both are required** for correct routing
✅ **`step_criteria` must be explicit** with conditionals and routing logic
✅ **`valid_contexts` must be complete** to avoid hard blocks
✅ **ENTRY CHECKs in instructions** prevent redundant actions
✅ **Tool call instructions** must match tool definitions exactly

---

## **Files to Review**
- `swaig-agent/services/contexts.py` - Builds `contexts` structure from DB
- `prompts` table in DB - Stores `step_criteria`, `valid_contexts`, `instructions` for each node
- `SIgnalWire Docs/ai.prompt` - Official SWML documentation

---

## **Related Fixes**
- GREET routing fix: Added explicit "IF verified=false MUST route to VERIFY"
- ANSWER routing fix: Added "ONLY route to QUOTE if EXPLICITLY asked"
- VERIFY tools fix: Fixed parameter mismatch in verification tool calls
- QUOTE tool fix: Changed `mortgage_balance` to `equity` parameter
- QUALIFY data collection: Now asks for property value + mortgage, calculates equity


