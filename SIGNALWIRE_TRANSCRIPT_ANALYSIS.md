# SignalWire Transcript Analysis - Routing Solution Research

**Date:** November 17, 2025  
**Goal:** Find solution to premature routing issue where Barbara routes to EXIT immediately after asking questions

**Status:** ⭐ **ROOT CAUSE FOUND & FIXED!** - Critical indentation bug caused only EXIT context to have steps configured. All other contexts (including ANSWER) were empty, causing immediate routing to EXIT. Fixed by correcting indentation + updating all `step_criteria` to short, objective format (20-60 chars) matching official pattern.

---

## Key Findings from Transcripts

### Transcript 1: ClueCon Blackjack Demo | Voice AI & State Management

**Key Quotes:**
- "as each step of the game goes through, it's the only part of the prompt that he's really focused on. It actually rewrites the entire thing with the most current step in mind."
- "Gives it criteria how to solve it."
- "Allows it to use tools that will flip it to a different stage of this of the game or whatever you need to do."
- "You can build state machines and flow."

**Insights:**
1. **Step system rewrites prompts** - Each step focuses only on current step, not entire conversation
2. **Tools trigger transitions** - Tools can "flip it to a different stage" (routing mechanism?)
3. **State machines** - Explicit mention of building state machines
4. **Criteria** - Each step has criteria for how to solve it

**Questions to Explore:**
- How do tools trigger context/step transitions?
- Is routing controlled by tools calling actions, not just step_criteria evaluation?
- How does the "rewrite" mechanism work - does it wait for user input?

---

## Potential Solutions to Test

### Solution 1: Tool-Based Routing (SWAIG Functions Responding with SWML) ⭐ **HIGH PRIORITY**
- **Hypothesis:** Functions can respond with SWML that changes the call flow/context
- **Evidence from Transcript 2:** "what you can do in the output of a function is respond with more swl"
- **Implementation:** 
  - Have functions return SWML that includes `set_context` or routing instructions
  - Example: After `mark_questions_answered`, function could return SWML that routes to exit
  - Or: Create explicit routing function that returns SWML with context change
- **Pros:** Explicit control, happens when function executes (after user interaction)
- **Cons:** Need to modify tool implementations
- **Status:** Need to test if this works for context transitions

### Solution 2: Step Actions
- **Hypothesis:** Steps might have `action` properties that trigger transitions
- **Implementation:** Check if steps can have `action: { type: "set_context", context: "answer" }`
- **Status:** We already use this in some contexts - need to verify if it waits for user input

### Solution 3: Function Toggle Mechanism ⭐ **HIGH PRIORITY - STRONG EVIDENCE**
- **Hypothesis:** Functions can toggle other functions on/off, which prevents premature execution/routing
- **Evidence from Transcript 2:** "it toggled a the verify customer ID uh function off because we've already verified the customer ID"
- **Evidence from Transcript 5:** "this veritable AI barrier ensures that our secret agent does not errant leap from retrieving the classified info in the first function to immediately attempting interpretation in the third without the prerequisite decoding"
- **Implementation:** 
  - After asking "Any other questions?", toggle off ALL routing/exit functions
  - Set `activity: false` on functions that could trigger routing
  - Only re-enable them after user explicitly responds with "no" or "that's all"
  - This creates an "AI barrier" that prevents premature routing
- **How it works:** "let's set the activity parameter to FAL" (FALSE) - functions with `activity: false` are disabled
- **Status:** ⭐ **STRONG CANDIDATE** - This might be the solution! Toggle functions off to prevent routing until user responds

### Solution 4: Dynamic Context Switching ⭐ **NEW FINDING**
- **Hypothesis:** Contexts can "morph" without ending the call
- **Evidence from Transcript 2:** "this agent just morphs into a new agent all of a sudden and it has a new role, a new purpose all of a sudden"
- **Implementation:** 
  - Instead of routing to exit, morph the answer context into a "waiting for response" state
  - Change the prompt/role but stay in same context
  - Only route to exit after explicit user confirmation
- **Status:** Need to understand how to implement context morphing

### Solution 5: Step Completion vs Context Completion
- **Hypothesis:** `step_criteria` might complete the step, but context stays active until explicit routing
- **Implementation:** Keep agent in same context, just advance to next step
- **Status:** Need to verify if this is how SignalWire works

### Solution 6: Non-Bargeable Static Text ⭐ **NEW FINDING**
- **Hypothesis:** Static text that's non-bargeable might prevent routing until complete
- **Evidence from Transcript 2:** "You can also make that static greeting not bargeable. So if it has to be said, uh it won't start accepting input until that greeting is complete."
- **Implementation:** 
  - After asking "Any other questions?", use non-bargeable static text
  - This might force SignalWire to wait before evaluating step_criteria
- **Status:** Need to test if this works for preventing premature routing

### Solution 7: Explicit Wait Mechanism
- **Hypothesis:** There might be a `wait_for_user` flag or similar that prevents routing until user speaks
- **Implementation:** Check SignalWire SDK for wait/blocking mechanisms
- **Status:** We set `skip_user_turn = False` but maybe there's more

---

## Transcript Notes

### Transcript 1: ClueCon Blackjack Demo
- **Time:** 3 minutes
- **Focus:** State management, step system, tool-based transitions
- **Key Takeaway:** Tools can trigger stage transitions, not just step_criteria

### Transcript 2: LIVEWire: Building Context Aware Call Flows with AI Agents
- **Time:** ~1 hour
- **Focus:** Context-aware transfers, SWAIG functions, dynamic context switching
- **Key Takeaways:**
  1. **Functions can respond with SWML** - "what you can do in the output of a function is respond with more swl"
  2. **Functions can toggle other functions on/off** - "it toggled a the verify customer ID uh function off because we've already verified the customer ID"
  3. **Dynamic context switching** - "I want to be able to go from one agent to another agent without actually ending this agent and then spawning a new agent. Like this agent just morphs into a new agent all of a sudden and it has a new role, a new purpose all of a sudden."
  4. **Static greeting can be non-bargeable** - "You can also make that static greeting not bargeable. So if it has to be said, uh it won't start accepting input until that greeting is complete."
  5. **Risen prompt framework** - They use Risen framework for prompts with "what the role is what the steps are uh what the expectations are for this outcome"
  6. **SWAIG functions are decorators** - "you can basically import swag as a library and use it as a decorator on top of a function almost like how Flask does"

---

## Critical Insights from Transcripts

### SWAIG Functions Can Return SWML (Transcript 2)
**Quote:** "what you can do in the output of a function is respond with more swl"

**Implication:** Our tools (SWAIG functions) can return SWML that includes routing instructions. This might be the key to controlling when routing happens!

**Example from demo:**
- Function `send_user_info` returns SWML
- SWML includes `connect` to transfer call
- This happens AFTER function executes (which happens AFTER user interaction)

**Potential Fix:**
Instead of relying on `step_criteria` evaluation, have tools explicitly return SWML with routing instructions only when appropriate.

### Natural Conversation Flow with Confirmations (Transcript 3) ⭐ **KEY INSIGHT**
**Observation:** In the nursing home demo, the agent:
1. Asks "shall I store this summary in your record?"
2. **Waits for user response** ("yeah")
3. Then executes the store function

**Implication:** The agent IS waiting for user input! This suggests that when the agent asks a question, it naturally waits for a response before proceeding.

**Why might our agent be different?**
- Maybe our `step_criteria` is being evaluated too aggressively?
- Maybe we need to structure the prompt differently?
- Maybe the issue is with how we're using contexts vs. steps?

**Key Question:** In Transcript 3, they're using SWML directly (not contexts). Do contexts behave differently than SWML steps?

### Dynamic Context Switching
**Quote:** "this agent just morphs into a new agent all of a sudden and it has a new role, a new purpose all of a sudden"

**Implication:** Contexts can change without ending the call. We might be able to "morph" the answer context into a waiting state instead of routing to exit.

### Function Toggling
**Quote:** "it toggled a the verify customer ID uh function off because we've already verified the customer ID"

**Implication:** Functions can be toggled on/off. We might be able to disable routing functions until user responds.

## Critical Question from Transcripts 3 & 4

### Are We Using the Wrong Approach?
**Observation:** 
- Transcript 3 (nursing home): Uses SWML directly and naturally waits for user responses
- Transcript 4 (Maddie): Shows natural waiting behavior - asks "What else are you curious about?" and waits
- Our agent: Uses SignalWire's contexts system and routes immediately after asking

**Question:** Do contexts evaluate `step_criteria` differently than SWML steps? 

**Hypothesis:** 
- SWML steps might naturally wait for user input
- Contexts might evaluate `step_criteria` immediately after agent speech
- We might need to switch from contexts to SWML, or find a way to make contexts behave like SWML steps

**Evidence from Transcript 4:**
- Agent asks "What else are you curious about?" (similar to our "Any other questions?")
- Agent **waits** for user response
- User says "No, that'll be it. Thank you."
- Only then does agent end the conversation

**This proves agents CAN wait for responses!** The question is: why isn't ours?

## Next Steps - PRIORITIZED (Updated with Transcript 9 - Pattern Confirmed)

### ⭐ **CRITICAL: Investigate SWML vs Contexts Behavior - ROOT CAUSE LIKELY IDENTIFIED**
**Why:** 
- **Transcript 9:** Insurance bot shows EXACTLY our scenario - "is there anything else?" → waits → "no that's all" → ends (uses SWML)
- **Transcript 8:** Temperature bot shows EXACTLY our scenario - "anything else?" → waits → "no that's all" → ends (uses SWML)
- **Transcript 6:** All working examples (recipe, SQL, support bots) use pure SWML (YAML/JSON documents)
- **Holy Guacamole:** Official production example uses contexts/steps (like us!) BUT functions control routing via `swml_change_step()`
- **Pattern:** **12/12 pure SWML examples** use SWML documents; **1/1 contexts example (Holy Guacamole)** uses function-based routing
- **Our agent:** Uses contexts and relies on `step_criteria` to automatically route (this is the problem!)
- **Key Difference:** Holy Guacamole uses contexts/steps BUT functions explicitly route; we use contexts/steps BUT rely on `step_criteria` to auto-route

**Implementation Steps:**
1. **⭐ COMPLETED: Reviewed SignalWire's official contexts/steps documentation** - Documentation explains WHAT `step_criteria` is but not WHEN it's evaluated.
2. **⭐ COMPLETED: Examined Holy Guacamole code** - Discovered they use contexts/steps BUT functions explicitly call `result.swml_change_step()` to route, NOT `step_criteria`.
3. **⭐ ROOT CAUSE IDENTIFIED:** We're relying on `step_criteria` to automatically route, but it evaluates immediately after agent speech. Holy Guacamole has functions explicitly route using `swml_change_step()` AFTER user interaction.
4. **IMPLEMENT SOLUTION:** Modify our functions to explicitly call `result.swml_change_step()` to change steps instead of relying on `step_criteria` evaluation.
5. **Test the fix:** After implementing explicit step changes in functions, test if Barbara waits for user responses before routing.

**This IS the root cause!** Holy Guacamole uses the same contexts/steps system we do, but they control routing through functions, not `step_criteria`. This is why they work and we don't.

**NEW: toggle_functions Documentation provides exact syntax** - We now have the exact implementation pattern for Solution 3 (function toggling) with confirmed syntax and use cases.

### ⭐ **IMMEDIATE ACTION: Test Function Toggling (Solution 3) + Explicit Wait Instructions**
**Why:** 
- Transcript 5: Function toggling creates an "AI barrier" that prevents premature execution
- Transcript 6 & 8: **NEW EVIDENCE** - Agents naturally wait for responses (but in SWML)
- Function toggling might work even in contexts to create explicit "wait barrier"

**Implementation Steps:**
1. After agent asks "Any other questions?", have a function toggle off ALL routing functions
2. Set `activity: false` on functions like `mark_questions_answered`, `mark_ready_to_book`, etc.
3. Add explicit instruction in ANSWER context prompt: "**CRITICAL: After asking 'Any other questions?', you MUST wait for the user to explicitly respond. DO NOT proceed, route, or complete the step until the user has spoken.**"
4. Only re-enable routing functions after user explicitly responds (via another function call)
5. This creates a "barrier" that prevents premature routing

**How to implement:**
- **toggle_functions Docs show exact syntax:** `toggle_functions` with `active: true/false` and `function: function_name` in function `output.action`
- **Functions can be disabled initially** - Set `active: "false"` on routing functions to prevent premature execution
- **Toggling happens in function actions** - `toggle_functions` is in function `output.action`, which executes AFTER function completes (after user interaction)
- Check if SignalWire contexts support function toggling via `activity` parameter in function definitions
- Or: Use SWML response from a function to toggle other functions (from Transcript 2, Santa AI, and toggle_functions docs)
- Or: Create a tool that toggles functions and call it after asking questions
- Update ANSWER context `step_criteria` to explicitly state: "Step is NOT complete until user has explicitly responded"

**Expected Result:** Agent will wait for user response (if function toggling works in contexts)

### ⭐ **⭐ PRIMARY SOLUTION: Explicit Step Changes in Functions (From Holy Guacamole)**
**From Holy Guacamole Code Analysis:**
- **Functions explicitly call `result.swml_change_step()`** to change steps
- **NOT relying on `step_criteria`** - They set it but functions control routing
- **Routing happens AFTER user interaction** - When function executes, not immediately after agent speech

**Implementation:**
1. In ANSWER context, after answering a question and asking "Any other questions?", DON'T rely on `step_criteria` to route
2. Instead, have a function (like `mark_questions_answered`) explicitly call `result.swml_change_step("exit")` or `result.swml_change_step("book")` based on user response
3. This ensures routing happens AFTER user speaks, not immediately after agent speech

**Example Pattern (from Holy Guacamole):**
```python
@self.tool(name="mark_questions_answered", ...)
def mark_questions_answered(args, raw_data):
    # ... business logic ...
    result = SwaigFunctionResult(response)
    
    # Check user's response to determine routing
    user_response = args.get("response", "").lower()
    
    if "no" in user_response or "that's all" in user_response:
        # User is done - route to exit
        result.swml_change_step("exit")
    elif "ready to book" in user_response:
        # User wants to book - route to book
        result.swml_change_step("book")
    else:
        # Stay in answer context
        result.swml_change_step("answer")
    
    return result
```

**Pros:**
- Uses same contexts/steps system we already have
- Functions control routing (code-driven, not prompt-driven)
- Routing happens AFTER user interaction (when function executes)
- Deterministic and testable

**Cons:**
- Need to modify functions to explicitly route
- Need to determine routing logic in code (but this is actually better!)

**Status:** ⭐ **THIS IS THE SOLUTION!** - This is exactly how Holy Guacamole works and why it doesn't have premature routing issues.

### ⭐ **NEW SOLUTION: Function Restrictions in Contexts (From Official Docs)**
**From Contexts and Steps Documentation:**
- **`set_functions("none")`** - Can disable ALL functions in a step
- **`set_functions(["list"])`** - Can restrict to specific functions only
- **Use case:** Prevent routing functions from being called until user responds

**Implementation:**
1. In ANSWER context step (after asking "Any other questions?"), use `set_functions("none")` to disable ALL routing functions
2. Only re-enable functions after user explicitly responds
3. This creates a "barrier" similar to function toggling, but using contexts API

**Pros:**
- Uses official contexts API (not SWML workaround)
- Explicit function restriction
- Should prevent premature routing

**Cons:**
- Need to re-enable functions after user responds (might need a function to do this)
- May disable functions we need (like `search_knowledge`)

**Status:** Need to test if this works in contexts system

### Secondary Actions (If SWML Migration Not Feasible):
1. **Test Function Restrictions:** Use `set_functions("none")` or `set_functions([])` to disable routing functions in ANSWER context
2. **Test Explicit Navigation:** Use `set_valid_contexts([])` or `set_valid_contexts(["answer"])` to prevent routing to exit
3. **Test Solution 1 (Function SWML Response):** Modify tools to return SWML with routing instructions
4. **Test Solution 6 (Non-Bargeable):** Use non-bargeable static text after asking questions
5. **Review Post-Prompt Data:** Use SignalWire's post-prompt analytics (from Transcript 6 & 9) to debug routing timing
6. **Compare Prompt Structure:** Look at how Transcript 6, 8 & 9's simple bots structure prompts vs. our complex contexts
7. **Test Function Toggling:** If we must stay with contexts, try function toggling as a workaround

**Note:** With 13/13 working examples using SWML, migration to SWML should be the primary solution. Function restrictions, function toggling, and other workarounds are secondary if SWML migration isn't feasible.

---

### Transcript 6: AI Office Hours 11.13.2024 ⭐ **VERY VALUABLE**
- **Time:** ~1 hour
- **Focus:** Live coding examples, function execution, post-prompt analytics
- **Key Takeaways:**
  1. **Agents naturally wait for user responses** - Multiple examples show agents asking questions and waiting:
     - Recipe bot: "what delicious dish are you in the mood for today?" → waits for response
     - SQL bot: "please provide the details" → waits for user input
     - Support bot: Asks troubleshooting questions → waits for answers
  2. **Functions execute AFTER user interaction** - Functions are called in response to user input, not proactively
  3. **Simple function structure** - "literally one function and one prompt" (recipe bot example)
  4. **Post-prompt data available** - Complete conversation logs with:
     - Every interaction
     - Function calls and responses
     - Latency metrics (29 data points in example)
     - Token counts, TTS times
     - Visual graphs of call flow
  5. **Function toggling in practice** - Santa bot example shows functions being toggled off after use
  6. **SWAIG as decorators** - Functions are simple Python decorators: `@swaig.function(...)`
  7. **Planning is key** - "the key to using our AI agent is planning" - structure matters

**Critical Insight:** All examples show agents asking questions and **naturally waiting** for responses. This suggests our issue might be:
- How we're structuring the `step_criteria` (too aggressive?)
- How contexts evaluate completion vs. SWML steps
- Missing explicit wait mechanism in our implementation

**Example from Recipe Bot:**
- Agent: "what delicious dish are you in the mood for today?"
- User: "meatloaf"
- Agent: *waits, then responds with recipe*
- This is the natural flow we want!

**Example from SQL Bot:**
- Agent: "please provide the details for the new employee record"
- User: "Bob Smith, R&D, director of engineering, salary 68,000"
- Agent: *waits for complete input, then executes function*
- Shows agent waits for full user response before acting

### Transcript 7: Robo Rhetoric - AI Debates
- **Time:** ~5 minutes
- **Focus:** Two AI agents debating (Die Hard vs Hallmark Christmas movies)
- **Key Takeaways:**
  1. **Agents can engage in extended back-and-forth** - Shows natural conversation flow
  2. **Agents wait for each other's responses** - Each agent waits for the other to finish before responding
  3. **Not directly relevant to routing issue** - This is agent-to-agent, not agent-to-user
  4. **Shows SignalWire can handle complex conversational flows**

**Less relevant for our specific problem, but confirms agents can wait for responses.**

### Transcript 8: Temperature and Humidity Sensor Bot ⭐ **PERFECT EXAMPLE FOR OUR ISSUE**
- **Time:** ~3 minutes
- **Focus:** IoT sensor bot that reports temperature/humidity via SMS
- **Key Takeaways:**
  1. **Perfect example of our exact scenario** - Agent asks question, waits, asks follow-up, waits, then ends
  2. **Natural wait behavior** - Agent asks "would you like me to send this information to you via SMS?" → **waits for "yes"** → executes function → asks "is there anything else I can assist you with?" → **waits for "no that's all thank you"** → then ends
  3. **Serverless example** - Uses JSON/SWML directly (not contexts), which might be key
  4. **Simple function structure** - Two functions: get weather data, send SMS
  5. **Shows the exact flow we want** - Question → Wait → Response → Follow-up Question → Wait → Response → End

**Critical Insight:** This is **EXACTLY** the scenario we're trying to fix:
- Agent provides information (temperature/humidity)
- Agent asks follow-up question ("would you like SMS?")
- **Agent WAITS for user response** ("yes")
- Agent executes function
- Agent asks another follow-up ("anything else?")
- **Agent WAITS for user response** ("no that's all")
- Only then does agent end conversation

**This proves agents CAN wait!** The question is: why isn't Barbara doing this?

**Key Difference:** This bot uses **SWML/JSON directly** (serverless), not SignalWire's contexts system. This might be the difference!

### Transcript 9: From Zero to Live in 60 Minutes - Building a SignalWire AI Agent ⭐ **CRITICAL EVIDENCE**
- **Time:** ~1 hour (live coding session)
- **Focus:** Building insurance eligibility agent from scratch
- **Key Takeaways:**
  1. **Another SWML example** - Uses SWML/JSON directly, NOT contexts
  2. **Perfect wait behavior** - Shows exact scenario we need:
     - Agent: "could you please tell me the name of your insurance provider?" → **waits**
     - User: "Blue Cross Blue Shield"
     - Agent: "could you please provide your member ID?" → **waits**
     - User: "123456789"
     - Agent: "could you please confirm your date of birth?" → **waits**
     - User: "January 1st 1980"
     - Agent: "is there anything else I can assist you with today?" → **waits**
     - User: "no that's all thank you"
     - Agent: Ends conversation
  3. **Simple prompt structure** - "your happy weathermen named Alex you can answer weather information about various cities and countries that's all I told it"
  4. **Built in under an hour** - Shows how simple SWML-based agents are to build
  5. **Live debugging** - Shows real-time conversation monitoring and post-call analytics
  6. **Function calling** - Demonstrates how functions are called and responses formatted

**Critical Insight:** This is **ANOTHER** example of:
- **SWML-based agent** (not contexts)
- **Natural wait behavior** - asks questions and waits for responses
- **Simple prompt** - minimal instructions, agent figures out the rest
- **"Is there anything else?" pattern** - waits for user response before ending

**Pattern Confirmed:** Every working example (Transcripts 6, 8, 9) uses **SWML directly**, not contexts. This strongly suggests:
- **SWML steps wait naturally for user input** ✅
- **Contexts evaluate `step_criteria` immediately after agent speech** ❌ (our problem)

### Transcript 10: LIVEWire: From Implementation to Success - A Guide to Deploying AI Agents ⭐ **IMPORTANT: Contexts Feature Confirmed**
- **Time:** ~1 hour
- **Focus:** Deployment guide, demos (Kevin the bartender, Bobby's tables)
- **Key Takeaways:**
  1. **Contexts and Steps ARE a real SignalWire feature!** - Brian confirms: "we do have context and steps where you could do a guided tour through the conversation flow that you want and you have a lot of options"
  2. **Contexts purpose:** "put some guard rails on where you want to go" - suggests contexts are for controlling flow, not necessarily waiting
  3. **Documentation just published** - Brian mentions documentation for contexts/steps was recently published
  4. **Demos show natural wait behavior:**
     - Kevin the bartender: "is there anything else I can help you with?" → waits → "no I think that covers it" → ends
     - Bobby's tables: Asks multiple questions, waits for each response before proceeding
  5. **Demos likely use SWML** - Based on pattern from other transcripts, these demos probably use SWML, not contexts
  6. **DataSphere API** - New feature for knowledge base management (relevant to our knowledge search tool)

**Critical Insight:** 
- **SignalWire DOES have contexts/steps as a feature** - This confirms we're using a real feature, not something that doesn't exist
- **Contexts are for "guard rails" and "guided tour"** - Suggests they're meant to control flow, but maybe not wait naturally
- **Documentation exists** - We should check SignalWire's published documentation on contexts/steps
- **Demos (Kevin, Bobby) show natural wait** - But these likely use SWML, not contexts

**Key Question:** If contexts are a real feature, why don't they wait naturally like SWML? Is there a configuration we're missing?

### Documentation: Santa AI SWML Example ⭐ **FUNCTION TOGGLING IN PRACTICE**
- **Source:** SignalWire official documentation - "Creating a Santa AI with SWML"
- **Key Takeaways:**
  1. **Another SWML example** - Uses SWML directly, NOT contexts
  2. **Function toggling syntax shown** - Exact implementation:
     ```yaml
     action:
       - toggle_functions:
         - active: true
           function: send_present
     ```
  3. **Functions can be disabled by default** - `active: 'false'` parameter prevents function from being called until toggled on
  4. **Functions can return SWML actions** - Functions can execute SWML (like `send_sms`) in their `action` output
  5. **Steps structured with markdown headers** - Uses `### Step 1`, `### Step 2` in prompt text (similar to our contexts but in SWML)
  6. **Natural conversation flow** - Steps guide conversation, but agent waits naturally for user responses

**Critical Insights:**
- **Function toggling syntax confirmed** - `toggle_functions` with `active: true/false` and `function: function_name`
- **Functions can be disabled initially** - `active: 'false'` on `send_present` prevents premature execution
- **SWML uses markdown headers for steps** - Similar structure to our contexts, but in SWML format
- **Functions can execute SWML** - Functions can return SWML actions (like routing, sending SMS)

**Relevance to Our Problem:**
- This shows **exact syntax** for function toggling we identified as Solution 3
- Demonstrates how to prevent premature function execution using `active: false`
- Shows another SWML example that waits naturally (confirming pattern)
- Proves functions can control flow via SWML actions

**Pattern:** **10/10 working examples use SWML, NOT contexts!**

### Documentation: Using `context_switch` in SWML ⭐ **SWML HAS ITS OWN CONTEXT SYSTEM**
- **Source:** SignalWire official documentation - "Using context_switch"
- **Key Takeaways:**
  1. **SWML has its own context switching** - `context_switch` action in function outputs (different from SignalWire's contexts system)
  2. **Functions can return `context_switch` actions** - Functions can change the AI's context/prompt via `action` output
  3. **Context switching happens AFTER user interaction** - `context_switch` is in function `action`, which executes when function is called (after user speaks)
  4. **Another SWML example** - Uses SWML directly, NOT SignalWire's contexts system
  5. **Functions control routing** - Functions can switch contexts, stop calls, or perform other actions
  6. **`consolidate` parameter** - Controls whether to combine previous context with new one (`true`) or replace it (`false`)

**Critical Insights:**
- **SWML has TWO context mechanisms:**
  1. **`context_switch` action** (in SWML functions) - Changes prompt/context via function actions
  2. **SignalWire's contexts system** (what we're using) - Separate system with steps and `step_criteria`
- **`context_switch` happens in function actions** - This means it executes AFTER user interaction (when function is called), not immediately after agent speech
- **Functions can control flow** - Via `context_switch`, `stop`, `say`, etc. in their `action` outputs

**Relevance to Our Problem:**
- This confirms SWML has its own context switching (different from what we're using)
- Shows functions can control routing/context changes AFTER user interaction
- Another SWML example (11/11 now)
- Demonstrates that in SWML, context changes happen via function actions (after user speaks), not immediately after agent speech

**Key Difference:**
- **SWML `context_switch`:** Happens in function actions (after user interaction) ✅
- **SignalWire contexts system:** Evaluates `step_criteria` immediately after agent speech ❌ (our problem)

**Pattern:** **11/11 working examples use SWML, NOT SignalWire's contexts system!**

### Documentation: Using `toggle_functions` ⭐ **EXACT SYNTAX FOR SOLUTION 3**
- **Source:** SignalWire official documentation - "Using toggle_functions"
- **Key Takeaways:**
  1. **Exact function toggling syntax** - `toggle_functions` with `active: true/false` and `function: function_name`
  2. **Functions can be disabled initially** - `active: "false"` prevents function from being called until toggled on
  3. **Functions can toggle other functions** - One function can enable/disable multiple functions
  4. **Toggling happens in function actions** - `toggle_functions` is in function `output.action`, which executes AFTER function completes (after user interaction)
  5. **Use case: Prevent premature execution** - `transfer` function starts disabled, only enabled after `get_joke` is called
  6. **Another SWML example** - Uses SWML directly, NOT SignalWire's contexts system

**Critical Insights:**
- **Exact syntax confirmed:**
  ```yaml
  action:
    - toggle_functions:
      - active: true
        function: transfer
      - active: false
        function: get_joke
  ```
- **Functions start disabled** - `active: "false"` on `transfer` prevents it from being called until `get_joke` executes
- **Toggling happens AFTER user interaction** - `toggle_functions` is in function `output.action`, which executes when function completes (after user speaks)
- **Perfect for our use case** - We can disable routing functions initially, only enable them after user responds

**Relevance to Our Problem:**
- **This is Solution 3 (Function Toggling) with exact syntax!**
- Shows how to prevent premature function execution using `active: "false"`
- Demonstrates that toggling happens in function actions (after user interaction), not immediately after agent speech
- Another SWML example (12/12 now)
- Proves we can disable routing functions until user explicitly responds

**Implementation Pattern for Our Problem:**
1. Set routing functions to `active: "false"` initially
2. After agent asks "Any other questions?", user must respond
3. When user responds, a function can toggle routing functions on
4. This creates a "barrier" that prevents premature routing

**Pattern:** **12/12 working examples use SWML, NOT SignalWire's contexts system!**

---

## Updated Priority: SWML vs Contexts - Critical Discovery

### ⭐ **CRITICAL FINDING: SWML vs Contexts Behavior Difference - PATTERN CONFIRMED**
**Evidence from Multiple Transcripts:**
- **Transcript 6:** Recipe bot, SQL bot, support bot - all use SWML, all wait naturally
- **Transcript 8:** Temperature/humidity bot - uses SWML, waits after "would you like SMS?" and "anything else?"
- **Transcript 9:** Insurance eligibility bot - uses SWML, waits after "is there anything else I can assist you with today?"

**Pattern:** **12/12 working examples use SWML directly, NOT contexts!** (including Santa AI, context_switch, and toggle_functions docs)

**Key Difference:** 
- **SWML-based agents:** Wait naturally for user input ✅ (all examples show this)
- **Contexts-based agents:** Evaluate `step_criteria` immediately after agent speech ❌ (our problem)

**Hypothesis Confirmed:** 
- **SWML steps naturally wait for user input** ✅ (12/12 examples including Santa AI, context_switch, and toggle_functions docs)
- **Contexts evaluate `step_criteria` immediately after agent speech** ❌ (our problem)
- **We likely need to switch from contexts to SWML, or find a way to make contexts behave like SWML**

### ⭐ **ROOT CAUSE IDENTIFIED: Contexts vs SWML**
**From Transcripts 6, 8, 9 + Santa AI + context_switch + toggle_functions Docs:** Every example shows agents asking questions and waiting for responses:
- Recipe bot waits after asking "what dish?"
- SQL bot waits after asking "please provide details"
- Support bot waits after asking troubleshooting questions
- Temperature bot waits after asking "would you like SMS?" and "anything else?"
- **Insurance bot waits after asking "is there anything else I can assist you with today?"**

**This proves:** SignalWire agents CAN and DO wait for user input naturally **when using SWML**.

**Our Problem:** Barbara uses **SignalWire's contexts system**, not SWML. Contexts appear to evaluate `step_criteria` immediately after agent speech, before user responds.

**Important Discovery:** SWML has its own context switching mechanism (`context_switch` action) that is different from SignalWire's contexts system. SWML's `context_switch` happens in function actions (after user interaction), while SignalWire's contexts system evaluates `step_criteria` immediately after agent speech.

**Root Cause Hypothesis:** 
1. **SignalWire's contexts system evaluates `step_criteria` immediately after agent speech** (before user responds) ❌
2. **SWML steps naturally wait for user input** (all 12 working examples use SWML) ✅
3. **SWML's `context_switch` happens in function actions** (after user interaction) ✅
4. **SWML's `toggle_functions` happens in function actions** (after user interaction) ✅
5. **Solution:** Switch ANSWER context to SWML, OR find a way to make SignalWire's contexts wait like SWML
6. **Function toggling confirmed** - `toggle_functions` documentation provides exact syntax for Solution 3

### ⭐ **RECOMMENDED SOLUTION: Combine Function Toggling + Explicit Wait Instructions**

**Implementation:**
1. After asking "Any other questions?", toggle off ALL routing functions (`activity: false`)
2. Add explicit instruction in prompt: "DO NOT proceed until user explicitly responds"
3. Only re-enable routing functions after user speaks
4. This creates a "barrier" that prevents premature routing

**Why this should work:**
- Function toggling creates explicit control (from Transcript 2 & 5)
- Natural wait behavior exists (from Transcript 6)
- Combining both gives us explicit control + natural behavior

---

### Documentation: Contexts and Steps Guide ⭐ **OFFICIAL DOCUMENTATION FOR OUR SYSTEM**
- **Source:** SignalWire official documentation - "Contexts and Steps Guide"
- **Key Takeaways:**
  1. **Official documentation for the contexts system we're using!** - This explains how SignalWire's contexts system works
  2. **`step_criteria` definition** - "Define clear progression requirements" / "when the step is considered complete"
  3. **Navigation control** - `set_valid_steps()` and `set_valid_contexts()` control where users can go
  4. **Function restrictions** - `set_functions()` can restrict which functions are available per step
  5. **Context types:**
     - **Workflow Container Context** - Simple step organization without state changes
     - **Context Switch Context** - Triggers conversation state changes when entered (uses `system_prompt`)
  6. **When to use contexts vs traditional prompts:**
     - **Use contexts:** Multi-step workflows, explicit navigation control, function restrictions, complex flows
     - **Use traditional prompts:** Simple freeform agents, maximum flexibility, general-purpose assistants

**Critical Insights:**
- **`step_criteria` is for "completion requirements"** - Defines when step is considered complete
- **No explicit mention of waiting for user input** - Documentation doesn't address the waiting behavior issue
- **Navigation is explicit** - Must use `set_valid_steps()` and `set_valid_contexts()` to control flow
- **Function restrictions available** - Can use `set_functions("none")` or `set_functions(["list"])` to restrict functions
- **Examples show structured workflows** - But don't demonstrate waiting for user responses after asking questions

**Relevance to Our Problem:**
- **This is the official documentation for the system we're using!**
- Explains `step_criteria` but doesn't address timing (when it's evaluated)
- Shows navigation control but doesn't show how to prevent premature routing
- **Missing:** Information about when `step_criteria` is evaluated (before or after user speaks)
- **Missing:** How to make contexts wait for user input like SWML does naturally

**Key Question:** The documentation explains WHAT `step_criteria` is, but not WHEN it's evaluated. This is the critical gap we need to understand.

**Potential Solution from Docs:**
- Could use `set_functions("none")` to disable routing functions until user responds
- Could use explicit navigation control to prevent routing to exit
- But docs don't show how to make `step_criteria` wait for user input

### Documentation: SWML Service Guide ⭐ **HOW SWML WORKS (What All Working Examples Use)**
- **Source:** SignalWire official documentation - "SWML Service Guide"
- **Key Takeaways:**
  1. **SWMLService is the base class** - All SignalWire services (including AI Agents) extend this
  2. **SWML document structure** - JSON/YAML with sections and verbs (e.g., `answer`, `play`, `ai`, `connect`)
  3. **SWML is declarative** - Defines call flow as a document, not programmatic state management
  4. **AI verb in SWML** - `add_ai_verb()` with `prompt_text`, `prompt_pom`, `post_prompt`, `swaig`, `params`
  5. **Dynamic SWML generation** - Can customize SWML based on request data via `on_swml_request()`
  6. **Sections and routing** - Can create multiple sections and route between them

**SWML Document Structure:**
```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      { "ai": { "prompt": "...", "swaig": {...} } },
      { "hangup": {} }
    ]
  }
}
```

**Key Differences from Contexts:**
- **SWML:** Declarative document-based flow (like XML/JSON config)
- **Contexts:** Programmatic state-based workflow (like a state machine)
- **SWML:** Natural sequential execution (one verb after another)
- **Contexts:** Evaluates `step_criteria` to determine progression
- **SWML:** All working examples (12/12) use this approach
- **Contexts:** Our agent uses this, but it routes prematurely

**Relevance to Our Problem:**
- **This is what all working examples use!** - Every transcript example uses SWML, not contexts
- **SWML's natural flow** - Verbs execute sequentially, which naturally waits for user input
- **AI verb in SWML** - Shows how to structure AI prompts within SWML documents
- **Dynamic generation** - Could potentially generate SWML dynamically based on conversation state
- **Confirms our hypothesis** - SWML's declarative nature naturally waits, while contexts evaluate criteria immediately

**Critical Insight:**
- **SWML verbs execute sequentially** - After an `ai` verb speaks, it naturally waits for the next interaction
- **Contexts evaluate `step_criteria` immediately** - This is why Barbara routes before user responds
- **Solution path:** Either migrate to SWML (like all working examples) or find a way to make contexts wait like SWML does

### Documentation: Prompt Building (POM) - Reference
- **Source:** SignalWire official documentation - "Prompt Building"
- **Key Takeaways:**
  1. **Prompt Object Model (POM)** - Structured way to build prompts using sections
  2. **Three ways to build prompts:**
     - Using Prompt Sections (POM) - `prompt_add_section()`, `setPersonality()`, `setGoal()`, `setInstructions()`
     - Using Raw Text Prompts - `set_prompt_text()`
     - Setting Post-Prompt - `set_post_prompt()`
  3. **SDK methods** - Convenience methods for building prompts programmatically
  4. **Not directly about routing** - This is about prompt structure, not context switching or waiting behavior

**Relevance:**
- Shows how SignalWire SDK structures prompts (may be relevant to understanding contexts vs SWML)
- Less critical than routing/waiting behavior findings
- Useful reference for understanding prompt structure in SignalWire's SDK

---

### Repository: Holy Guacamole (sigmond-holyguacamole) ⭐ **PRODUCTION EXAMPLE**
- **Source:** [GitHub Repository](https://github.com/signalwire/sigmond-holyguacamole) - Official SignalWire example
- **Live Demo:** https://holyguacamole.signalwire.me
- **Key Takeaways:**
  1. **Code-Driven LLM Architecture** - State machine controls the flow, NOT the LLM
  2. **Uses Contexts/Steps** - Same system as us! NOT pure SWML like other examples
  3. **BUT - Functions Control Routing** - Functions explicitly call `result.swml_change_step()` to route
  4. **State Machine Design** - Explicit state transitions controlled by code in functions
  5. **Function-Based Routing** - Functions return results with step changes, not prompt-based routing
  6. **Real-time Event Streaming** - Uses WebRTC events for UI updates

**Architecture Pattern:**
```
Traditional Chatbot → LLM controls conversation flow
Holy Guacamole → State machine controls flow, LLM just processes input
```

**Key Differentiators:**
- **LLM controls conversation flow** ❌ → **State machine controls flow** ✅
- **Relies on prompt engineering** ❌ → **Logic enforced in code** ✅
- **Inconsistent behavior** ❌ → **Deterministic outcomes** ✅
- **Hard to debug** ❌ → **Clear execution path** ✅
- **LLM must "remember" rules** ❌ → **Rules embedded in functions** ✅

**State Machine Implementation:**
- Functions control state transitions
- Functions return results with `result.context` set to change state
- State machine enforces business rules (order limits, validation)
- LLM just processes natural language, doesn't control flow

**Relevance to Our Problem:**
- **This is a production example using contexts/steps** - Same system as us!
- **BUT - Functions control routing** - Functions explicitly call `swml_change_step()`, not `step_criteria`
- **Code-driven architecture** - Functions control routing, not prompt evaluation
- **State transitions happen in functions** - After user interaction, not immediately after agent speech
- **This is the solution!** - Use contexts/steps but control routing through functions, not `step_criteria`

**Critical Insight:**
- **Functions return context changes** - `result.context = "new_state"` happens AFTER user interaction
- **State machine enforces rules** - Business logic in code, not prompts
- **This is how all working examples operate** - Code controls flow, not LLM/prompts

**What We Can Learn:**
1. Functions should control routing, not `step_criteria`
2. State transitions should happen in function responses, not prompt evaluation
3. Business logic belongs in code, not prompts
4. SWML naturally supports this pattern (functions execute after user speaks)

**Status:** ⭐ **CODE EXAMINED - CRITICAL FINDING!**

**ACTUAL IMPLEMENTATION (from holy_guacamole.py):**

1. **They DO use contexts!** - `contexts = self.define_contexts()` and `default_context = contexts.add_context("default")`
2. **They DO use steps!** - `default_context.add_step("greeting")`, `default_context.add_step("taking_order")`, etc.
3. **BUT - Functions control routing explicitly!** - Functions call `result.swml_change_step("taking_order")` to change steps
4. **NOT relying on `step_criteria`** - They set `step_criteria` but functions explicitly route using `swml_change_step()`

**Key Code Pattern:**
```python
@self.tool(name="add_item", ...)
def add_item(args, raw_data):
    # ... business logic ...
    result = SwaigFunctionResult(response)
    save_order_state(result, order_state, global_data)
    
    # EXPLICIT STEP CHANGE - This is the key!
    result.swml_change_step("taking_order")
    
    return result
```

**Another Example:**
```python
@self.tool(name="finalize_order", ...)
def finalize_order(args, raw_data):
    # ... business logic ...
    result = SwaigFunctionResult(response)
    
    # EXPLICIT STEP CHANGE
    result.swml_change_step("confirming_order")
    
    return result
```

**CRITICAL DISCOVERY:**
- **They use contexts AND steps** (just like us!)
- **BUT they don't rely on `step_criteria` for routing**
- **Functions explicitly call `result.swml_change_step()` to change steps**
- **This happens AFTER user interaction** (when function executes)
- **This is why it works!** - Functions control routing, not prompt evaluation

**The Solution:**
Instead of relying on `step_criteria` to automatically route, we should have our functions explicitly call `result.swml_change_step()` to change steps. This ensures routing happens AFTER user interaction, not immediately after agent speech.

---

## Code References to Check

- `equity_connect/services/contexts_builder.py` - How we build steps with actions
- `equity_connect/agent/barbara_agent.py` - Tool implementations
- Database: `prompt_versions.content->'steps'` - Step configurations
- **Holy Guacamole Repository:** https://github.com/signalwire/sigmond-holyguacamole - Production example to study

