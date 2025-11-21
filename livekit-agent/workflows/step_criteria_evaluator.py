"""Safe expression evaluator for step_criteria completion logic.

This module provides a safe way to evaluate step_criteria expressions stored in the database
without using eval() or other unsafe code execution methods.

Expressions are evaluated against conversation_data dictionaries from the conversation_state table.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


def evaluate_step_criteria(expression: str, state: Dict[str, Any]) -> bool:
    """Safely evaluate step_criteria expression against conversation state.
    
    Args:
        expression: String expression like "greet_turn_count >= 2 OR greeted == True"
        state: conversation_data dict from database
    
    Returns:
        True if expression evaluates to True, False otherwise (or on error)
    
    Examples:
        >>> evaluate_step_criteria("verified == True", {"verified": True})
        True
        >>> evaluate_step_criteria("greet_turn_count >= 2", {"greet_turn_count": 3})
        True
        >>> evaluate_step_criteria("qualified != None", {"qualified": True})
        True
        >>> evaluate_step_criteria("verified == True", {})
        False
    """
    if not expression or not expression.strip():
        logger.debug("Empty expression, returning False")
        return False
    
    try:
        # Normalize whitespace
        expr = expression.strip()
        
        # Handle simple literal "True" or "False"
        if expr == "True":
            return True
        if expr == "False":
            return False
        
        # Parse and evaluate expression
        tokens = _tokenize(expr)
        if not tokens:
            logger.warning(f"Failed to tokenize expression: {expr}")
            return False
        
        result = _evaluate_expression(tokens, state)
        logger.debug(f"Evaluated '{expr}' against state {list(state.keys())[:5]}... → {result}")
        return result
        
    except Exception as e:
        logger.warning(f"Error evaluating step_criteria expression '{expression}': {e}", exc_info=True)
        return False  # Safe fallback


def _tokenize(expression: str) -> List[Union[str, int, tuple]]:
    """Tokenize expression string into list of tokens.
    
    Handles:
    - Identifiers (field names): greet_turn_count, verified
    - Operators: ==, !=, >=, <=, >, <, AND, OR, NOT
    - Literals: True, False, None, numbers, quoted strings
    - Parentheses: ( )
    
    Returns:
        List of tokens, or empty list on error
    """
    tokens = []
    i = 0
    expr_len = len(expression)
    
    while i < expr_len:
        # Skip whitespace
        if expression[i].isspace():
            i += 1
            continue
        
        # Two-character operators
        if i + 1 < expr_len:
            two_char = expression[i:i+2]
            if two_char in ('==', '!=', '>=', '<='):
                tokens.append(two_char)
                i += 2
                continue
        
        # Single-character operators and parentheses
        if expression[i] in ('>', '<', '(', ')'):
            tokens.append(expression[i])
            i += 1
            continue
        
        # Keywords (AND, OR, NOT, True, False, None)
        keyword_match = re.match(r'\b(AND|OR|NOT|True|False|None)\b', expression[i:], re.IGNORECASE)
        if keyword_match:
            keyword = keyword_match.group(0)
            # Normalize case
            if keyword.upper() in ('AND', 'OR', 'NOT'):
                tokens.append(keyword.upper())
            elif keyword.lower() in ('true', 'false', 'none'):
                tokens.append(keyword.capitalize() if keyword.lower() == 'none' else keyword.capitalize())
            else:
                tokens.append(keyword)
            i += len(keyword)
            continue
        
        # Quoted strings
        if expression[i] in ('"', "'"):
            quote_char = expression[i]
            i += 1
            string_start = i
            string_value = ""
            while i < expr_len and expression[i] != quote_char:
                if expression[i] == '\\' and i + 1 < expr_len:  # Escape sequence
                    i += 1
                    string_value += expression[i]
                else:
                    string_value += expression[i]
                i += 1
            if i < expr_len:
                tokens.append(('STRING', string_value))  # Mark as string literal
                i += 1  # Skip closing quote
            else:
                logger.warning(f"Unclosed string literal in expression")
                return []
            continue
        
        # Numbers (integers)
        number_match = re.match(r'-?\d+', expression[i:])
        if number_match:
            tokens.append(int(number_match.group(0)))
            i += len(number_match.group(0))
            continue
        
        # Identifiers (field names)
        identifier_match = re.match(r'[a-zA-Z_][a-zA-Z0-9_]*', expression[i:])
        if identifier_match:
            tokens.append(identifier_match.group(0))
            i += len(identifier_match.group(0))
            continue
        
        # Unknown character
        logger.warning(f"Unexpected character '{expression[i]}' at position {i} in expression: {expression}")
        return []
    
    return tokens


def _evaluate_expression(tokens: List[Union[str, int, tuple]], state: Dict[str, Any]) -> bool:
    """Evaluate tokenized expression using recursive descent parsing.
    
    Grammar:
        expression := or_expr
        or_expr := and_expr (OR and_expr)*
        and_expr := not_expr (AND not_expr)*
        not_expr := NOT not_expr | comparison
        comparison := value operator value | value
        value := identifier | literal | (expression)
        literal := True | False | None | number | string
        operator := == | != | >= | <= | > | <
    """
    if not tokens:
        return False
    
    # Use index to track position
    index = [0]  # Use list to allow modification in nested calls
    
    def parse_or_expr() -> bool:
        """Parse OR expression (lowest precedence)."""
        result = parse_and_expr()
        while index[0] < len(tokens) and tokens[index[0]] == 'OR':
            index[0] += 1
            right = parse_and_expr()
            result = result or right
        return result
    
    def parse_and_expr() -> bool:
        """Parse AND expression (higher precedence than OR)."""
        result = parse_not_expr()
        while index[0] < len(tokens) and tokens[index[0]] == 'AND':
            index[0] += 1
            right = parse_not_expr()
            result = result and right
        return result
    
    def parse_not_expr() -> bool:
        """Parse NOT expression (highest precedence)."""
        if index[0] < len(tokens) and tokens[index[0]] == 'NOT':
            index[0] += 1
            return not parse_not_expr()
        return parse_comparison()
    
    def parse_comparison() -> bool:
        """Parse comparison expression."""
        left = parse_value()
        
        # Check if there's an operator
        if index[0] >= len(tokens):
            # Single value - convert to bool
            return _to_bool(left)
        
        op = tokens[index[0]]
        if op in ('==', '!=', '>=', '<=', '>', '<'):
            index[0] += 1
            right = parse_value()
            return _compare(left, op, right)
        
        # No operator - just return truthiness of left value
        return _to_bool(left)
    
    def parse_value() -> Any:
        """Parse a value (identifier, literal, or parenthesized expression)."""
        if index[0] >= len(tokens):
            raise ValueError("Unexpected end of expression")
        
        token = tokens[index[0]]
        
        # Parenthesized expression
        if token == '(':
            index[0] += 1
            result = parse_or_expr()
            if index[0] >= len(tokens) or tokens[index[0]] != ')':
                raise ValueError("Unclosed parenthesis")
            index[0] += 1
            return result
        
        # Literals
        if token in ('True', 'False', 'None'):
            index[0] += 1
            if token == 'True':
                return True
            elif token == 'False':
                return False
            else:  # None
                return None
        
        # Numbers
        if isinstance(token, int):
            index[0] += 1
            return token
        
        # String literals (from quoted strings)
        if isinstance(token, tuple) and token[0] == 'STRING':
            index[0] += 1
            return token[1]  # Return the string value
        
        # Strings (identifiers/field names)
        if isinstance(token, str):
            # Check if this is a keyword
            if token in ('AND', 'OR', 'NOT', 'True', 'False', 'None'):
                # Should have been handled above, but just in case
                raise ValueError(f"Unexpected keyword in value position: {token}")
            # This is an identifier (field name)
            index[0] += 1
            return state.get(token, None)
        
        # Identifier (field name)
        if isinstance(token, str):
            index[0] += 1
            return state.get(token, None)
        
        raise ValueError(f"Unexpected token: {token}")
    
    try:
        result = parse_or_expr()
        if index[0] < len(tokens):
            logger.warning(f"Unexpected tokens remaining after parsing: {tokens[index[0]:]}")
        return bool(result)
    except Exception as e:
        logger.warning(f"Error parsing expression: {e}")
        return False


def _compare(left: Any, operator: str, right: Any) -> bool:
    """Compare two values using the specified operator."""
    try:
        if operator == '==':
            return _equal(left, right)
        elif operator == '!=':
            return not _equal(left, right)
        elif operator == '>=':
            return _to_number(left) >= _to_number(right)
        elif operator == '<=':
            return _to_number(left) <= _to_number(right)
        elif operator == '>':
            return _to_number(left) > _to_number(right)
        elif operator == '<':
            return _to_number(left) < _to_number(right)
        else:
            logger.warning(f"Unknown operator: {operator}")
            return False
    except (ValueError, TypeError) as e:
        logger.debug(f"Comparison error: {e}")
        return False


def _equal(left: Any, right: Any) -> bool:
    """Check if two values are equal, handling None and type coercion."""
    # Both None
    if left is None and right is None:
        return True
    
    # One is None
    if left is None or right is None:
        return False
    
    # Type coercion for numbers
    try:
        left_num = _to_number(left)
        right_num = _to_number(right)
        return left_num == right_num
    except (ValueError, TypeError):
        pass
    
    # String comparison
    return str(left) == str(right)


def _to_number(value: Any) -> Union[int, float]:
    """Convert value to number, raising ValueError if not possible."""
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        # Try to parse as int first, then float
        try:
            return int(value)
        except ValueError:
            return float(value)
    raise ValueError(f"Cannot convert {type(value).__name__} to number")


def _to_bool(value: Any) -> bool:
    """Convert value to boolean."""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.lower() not in ('', 'false', 'none', '0')
    return bool(value)

