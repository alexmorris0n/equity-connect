# Step Criteria Expression Format Specification

## Overview

The `step_criteria_lk` field in the database stores boolean expressions that determine when a conversation node is complete and ready to transition. These expressions are evaluated against the `conversation_data` JSONB field from the `conversation_state` table.

**Note:** This document describes the format for `step_criteria_lk` (LiveKit-optimized boolean expressions). The database also contains:
- `step_criteria_source`: Human-readable natural language (displayed in Vue UI)
- `step_criteria_sw`: SignalWire-optimized natural language (for SignalWire agent)
- `step_criteria`: Legacy field (fallback for backward compatibility)

The LiveKit agent reads `step_criteria_lk` first, then falls back to `step_criteria` if `step_criteria_lk` is not populated.

## Why Custom Expression Format?

LiveKit Agents framework does not provide built-in expression evaluation for node completion. The framework focuses on turn detection, interruptions, and session management, but leaves completion logic to the application layer. This custom format allows BarbGraph to:

- Store completion logic in the database (no code deployment needed)
- Support complex conditions (turn counting, tool flags, intent detection)
- Enable non-technical users to understand and modify completion criteria
- Maintain safety (no code injection risk like `eval()`)

## Expression Syntax

### Supported Operators

#### Comparison Operators
- `==` - Equality (supports None, True, False, numbers, strings)
- `!=` - Inequality
- `>=` - Greater than or equal (numbers only)
- `<=` - Less than or equal (numbers only)
- `>` - Greater than (numbers only)
- `<` - Less than (numbers only)

#### Logical Operators
- `AND` - Logical AND (higher precedence than OR)
- `OR` - Logical OR (lower precedence than AND)
- `NOT` - Logical NOT (unary operator)

#### Operator Precedence
1. `NOT` (highest)
2. Comparison operators (`==`, `!=`, `>=`, `<=`, `>`, `<`)
3. `AND`
4. `OR` (lowest)

Use parentheses `()` to override precedence.

### Field Access

Fields are accessed directly by name from the `conversation_data` dictionary:
- `verified` - Accesses `state.get("verified")`
- `greet_turn_count` - Accesses `state.get("greet_turn_count")`
- `qualified` - Accesses `state.get("qualified")`

**Missing fields:** If a field doesn't exist in state, it evaluates to `None`.

### Literals

- **Booleans:** `True`, `False`
- **None:** `None`
- **Numbers:** `0`, `1`, `2`, `-5`, `100` (integers only)
- **Strings:** `"positive"`, `"negative"`, `"skeptical"` (must be quoted)

### Expression Examples by Node

#### GREET Node
```python
# Require 2+ turns OR greeted flag set
"greet_turn_count >= 2 OR greeted == True"

# Simple: just require greeted flag
"greeted == True"
```

#### VERIFY Node
```python
# Complete when verified flag is True
"verified == True"

# With fallback: verified OR lead_id exists (handled in code, not expression)
"verified == True"
```

#### QUALIFY Node
```python
# Complete when qualified is set (True or False) OR objection detected
"qualified != None OR has_objection == True"

# Simple: just check if qualified is set
"qualified != None"
```

#### QUOTE Node
```python
# Complete when quote presented OR objection raised
"quote_presented == True OR has_objection == True"

# Simple: just quote presented
"quote_presented == True"
```

#### ANSWER Node
```python
# Complete when questions answered OR ready to book OR objections detected
"questions_answered == True OR ready_to_book == True OR has_objections == True"

# With calculation detection (handled in routing, not completion)
"questions_answered == True OR ready_to_book == True"
```

#### OBJECTIONS Node
```python
# Complete when objection handled
"objection_handled == True"
```

#### BOOK Node
```python
# Complete when appointment booked OR manual booking required
"appointment_booked == True OR manual_booking_required == True"

# Simple: just appointment booked
"appointment_booked == True"
```

#### GOODBYE Node
```python
# Always complete (no conditions)
"True"
```

### Complex Examples

#### Multiple Conditions with AND/OR
```python
# GREET: Require 2+ turns AND greeted flag, OR wrong person detected
"(greet_turn_count >= 2 AND greeted == True) OR wrong_person == True"

# QUALIFY: Qualified AND no objections, OR objection detected
"(qualified == True AND has_objection != True) OR has_objection == True"
```

#### Negation with NOT
```python
# Complete when NOT disqualified
"NOT qualified == False"

# Complete when no objections
"NOT has_objection == True"
# Equivalent to: "has_objection != True"
```

#### String Comparisons
```python
# Complete when quote reaction is positive
"quote_reaction == \"positive\""

# Complete when quote reaction is NOT negative
"quote_reaction != \"negative\""
```

### Type Handling

The evaluator handles type coercion automatically:

- **None comparisons:**
  - `field == None` → True if field doesn't exist or is None
  - `field != None` → True if field exists and is not None

- **Boolean comparisons:**
  - `field == True` → True if field is exactly True (not truthy)
  - `field == False` → True if field is exactly False (not falsy)

- **Number comparisons:**
  - `field >= 2` → Converts field to number if possible, False if not a number
  - `"2" >= 2` → Converts string "2" to number 2, then compares

- **String comparisons:**
  - `field == "value"` → Exact string match (case-sensitive)

### Error Handling

If an expression cannot be evaluated (syntax error, invalid operator, etc.), the evaluator:
1. Logs a warning with the error details
2. Returns `False` (safe fallback - node doesn't complete)
3. Falls back to hardcoded completion logic in `node_completion.py`

This ensures the system never breaks due to malformed expressions.

## Current Hardcoded Logic (for reference)

These are the current hardcoded completion criteria that will be replaced:

```python
completion_criteria = {
    "greet": lambda s: True,  # Always complete - NEEDS FIX
    "verify": lambda s: s.get("verified") == True,
    "qualify": lambda s: s.get("qualified") != None,
    "quote": lambda s: s.get("quote_presented") == True,
    "answer": lambda s: s.get("questions_answered") or s.get("ready_to_book") or s.get("has_objections"),
    "objections": lambda s: s.get("objection_handled") == True,
    "book": lambda s: s.get("appointment_booked") == True,
    "exit": lambda s: True,
}
```

## Migration from Hardcoded to Database-Driven

The expressions above translate to:

- **greet:** `"greet_turn_count >= 2 OR greeted == True"` (fixes immediate routing issue)
- **verify:** `"verified == True"`
- **qualify:** `"qualified != None"`
- **quote:** `"quote_presented == True"`
- **answer:** `"questions_answered == True OR ready_to_book == True OR has_objections == True"`
- **objections:** `"objection_handled == True"`
- **book:** `"appointment_booked == True"`
- **goodbye:** `"True"`

## Testing Expressions

Before deploying, test expressions with sample state dictionaries:

```python
# Test GREET expression
state = {"greet_turn_count": 2, "greeted": False}
evaluate("greet_turn_count >= 2 OR greeted == True", state)  # Should return True

# Test VERIFY expression
state = {"verified": True}
evaluate("verified == True", state)  # Should return True

# Test QUALIFY expression
state = {"qualified": True, "has_objection": False}
evaluate("qualified != None OR has_objection == True", state)  # Should return True
```

## Future Enhancements

Potential additions (not in initial implementation):
- Function calls: `count(field)`, `exists(field)`
- Array operations: `field IN [value1, value2]`
- Date/time comparisons: `appointment_datetime > NOW()`
- Nested field access: `lead.age >= 62`

These can be added later if needed without breaking existing expressions.

