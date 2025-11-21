"""
Prompt for converting extracted criteria to LiveKit boolean expressions.

LiveKit uses a custom expression evaluator that parses boolean logic against
conversation state stored in the database.
"""

LIVEKIT_PROMPT = """You are converting step criteria to LiveKit boolean expressions.

LiveKit uses a custom expression evaluator to determine node completion. Your expressions will be evaluated against the `conversation_data` field from the database.

## Available State Variables

### Boolean Flags (True/False)
- verified: User identity confirmed
- qualified: User qualification status determined (True/False)
- greeted: Initial greeting completed
- quote_presented: Equity quote shown to user
- appointment_booked: Calendar appointment created
- objection_handled: User objection resolved
- has_objection: User has raised objections
- ready_to_book: User expressed readiness to schedule
- questions_answered: User's questions addressed
- right_person_available: Correct person is available (for callbacks)

### Turn Counters (Integers)
- greet_turn_count: Number of user turns in greet node
- verify_turn_count: Number of user turns in verify node
- qualify_turn_count: Number of user turns in qualify node
- answer_turn_count: Number of user turns in answer node
- quote_turn_count: Number of user turns in quote node
- objection_turn_count: Number of user turns in objection node
- book_turn_count: Number of user turns in book node

### Node Visit Counters (for loop prevention)
- node_visits.answer: Times answer node visited
- node_visits.verify: Times verify node visited

## Expression Syntax

### Operators
- Comparison: ==, !=, <, >, <=, >=
- Logical: AND, OR, NOT
- Parentheses: ( ) for grouping

### Values
- Booleans: True, False
- None: None
- Integers: 0, 1, 2, 10, etc.
- Strings: "positive", "negative" (must use double quotes)

### Operator Precedence
1. NOT (highest)
2. Comparison (==, !=, etc.)
3. AND
4. OR (lowest)

## Conversion Examples

### Example 1: Greet Node
INPUT: "Initial greeting and rapport established"
REASONING: Need at least 2 turns for rapport, OR explicit greeted flag
OUTPUT: greet_turn_count >= 2 OR greeted == True

### Example 2: Verify Node
INPUT: "Caller confirms identity and information is verified or updated"
REASONING: Verified flag indicates completion
OUTPUT: verified == True

### Example 3: Qualify Node
INPUT: "All qualification information gathered and qualification result recorded"
REASONING: Qualified can be True (qualified) or False (disqualified), both mean "determined"
OUTPUT: qualified != None

### Example 4: Quote Node
INPUT: "Equity estimate presented and user reaction gauged"
REASONING: Quote presented flag + at least 1 turn for reaction
OUTPUT: quote_presented == True

### Example 5: Answer Node
INPUT: "User's question has been answered"
REASONING: Questions answered flag OR ready to book OR has objection (all indicate move on)
OUTPUT: questions_answered == True OR ready_to_book == True OR has_objection == True

### Example 6: Objection Node
INPUT: "Objection resolved and user expresses understanding or satisfaction"
REASONING: Objection handled flag set by tools
OUTPUT: objection_handled == True

### Example 7: Book Node
INPUT: "Appointment booked or declined"
REASONING: Booking completed (either way)
OUTPUT: appointment_booked == True

### Example 8: Goodbye Node
INPUT: "Farewell said and caller responded or stayed silent"
REASONING: Always complete (exit node)
OUTPUT: True

### Example 9: End Node
INPUT: "Terminal state reached"
REASONING: Always complete (terminal)
OUTPUT: True

## Guidelines

1. Use the SIMPLEST expression that captures the criteria
2. Prefer explicit flags over turn counting when available
3. Use turn counting only when conversation flow needs it (e.g., greet)
4. For terminal/exit nodes, use: True
5. For nodes with "or" conditions in input, use OR in expression
6. For nodes checking if something is "set" (regardless of value), use: != None

---

INPUT:
Node: {node_name}
Extracted Criteria: {extracted_criteria}

OUTPUT (just the boolean expression, no markdown or explanation):
"""

