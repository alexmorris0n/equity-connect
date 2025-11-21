"""
Prompt for converting extracted criteria to SignalWire-optimized natural language.

SignalWire AI interprets step_criteria as natural language instructions for
determining when to transition to the next step.
"""

SIGNALWIRE_PROMPT = """You are optimizing step criteria for SignalWire AI.

SignalWire interprets step_criteria as natural language. The AI uses this to determine when to transition to the next step in a conversation.

## SignalWire Optimal Format

Based on SignalWire documentation (developer.signalwire.com/swml/methods/ai/prompt/contexts/steps):

✅ DO:
- Use present perfect tense: "The user has provided...", "The information has been verified..."
- Focus on STATE not PROCESS: "Information is verified" not "After verifying..."
- Single clear sentence describing what has been accomplished
- Be specific about what needs to be true
- Action-oriented: What state indicates completion?

❌ DON'T:
- Include routing logic ("then go to X", "route to Y")
- Be conversational ("complete after...", "when you...")
- Use procedural language ("after 2-3 turns")
- Give multiple instructions
- Include tool call instructions

## Examples from SignalWire Docs

Example 1:
INPUT: "User provides email address"
OUTPUT: "The user has provided their email address."

Example 2:
INPUT: "Identity confirmed"
OUTPUT: "The user's identity has been confirmed."

## Our Domain Examples

Example 1: Greet Node
INPUT: "Initial greeting and rapport established"
OUTPUT: "The user has been greeted and initial rapport has been established."

Example 2: Verify Node
INPUT: "Caller confirms identity and information is verified or updated"
OUTPUT: "The caller's identity has been confirmed and their information is verified."

Example 3: Qualify Node
INPUT: "All qualification information gathered and qualification result recorded"
OUTPUT: "All required qualification information has been collected and the qualification result has been recorded."

Example 4: Quote Node
INPUT: "Equity estimate presented and user reaction gauged"
OUTPUT: "The equity estimate has been presented and the user's reaction has been observed."

Example 5: Objection Node
INPUT: "Objection resolved and user expresses understanding or satisfaction"
OUTPUT: "The objection has been resolved and the user has expressed understanding or satisfaction."

Example 6: Book Node
INPUT: "Appointment booked or declined"
OUTPUT: "The appointment has been successfully scheduled or the user has declined to book."

Example 7: Goodbye Node
INPUT: "Farewell said and caller responded or stayed silent"
OUTPUT: "The farewell has been said and the caller has responded or remained silent."

---

INPUT:
Node: {node_name}
Extracted Criteria: {extracted_criteria}

OUTPUT (just the SignalWire-optimized sentence, no markdown or explanation):
"""

