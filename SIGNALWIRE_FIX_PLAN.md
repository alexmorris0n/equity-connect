# SignalWire Fix Plan - Based on Documentation Research

## Overview
Based on SignalWire SWAIG documentation and existing code patterns, here's how to fix the 2 remaining failing scenarios.

**Note:** Scenario 9 (Borderline Equity) is intentionally skipped - let the broker handle low equity cases. Same treatment for everyone.

---

## ⏭️ Scenario 9: Borderline Equity - INTENTIONALLY SKIPPED

**Decision:** Let the broker handle borderline equity cases. No special handling needed - same quote presentation for everyone.

---

## ✅ Fix #1: Scenario 11 - Tool Failure Handling

### Documentation Research:
- **SignalWire SWAIG docs (lines 1700-1717):** Functions can return `action` array with `set_meta_data` to update conversation state
- **Existing pattern:** `swaig-agent/tools/booking.py` line 101-106 shows `set_meta_data` usage
- **Database:** `borderline_equity` column already exists in `leads` table (confirmed via SQL query)

### Implementation Plan:

**1. Update `mark_equity_qualified` Tool**
**File:** `swaig-agent/tools/qualification.py` (lines 146-183)

**Change:**
```python
async def mark_equity_qualified(caller_id: str, args: Dict[str, Any] = None) -> Dict[str, Any]:
    # Extract borderline flag
    args = args or {}
    borderline_equity = args.get('borderline_equity', False)
    
    # Auto-detect borderline if not provided
    if not borderline_equity and property_value and mortgage_balance:
        equity = property_value - mortgage_balance
        equity_percentage = (equity / property_value * 100) if property_value > 0 else 0
        borderline_equity = equity < 50000 or equity_percentage < 20
    
    # Update database with borderline_equity flag
    supabase.table('leads').update({
        'equity_qualified': True,
        'borderline_equity': borderline_equity
    }).eq('id', lead_id).execute()
    
    # Update conversation state
    await update_conversation_state(phone, {
        "conversation_data": {
            "borderline_equity": borderline_equity
        }
    })
    
    return {
        "response": response_msg,
        "action": [{
            "set_meta_data": {
                "borderline_equity": borderline_equity
            }
        }]
    }
```

**2. Update QUOTE Prompt** (Database)
Add section:
```
=== BORDERLINE EQUITY HANDLING ===
If conversation_data shows borderline_equity=true:
- Use reframing language: "You'd have approximately $15,000 available, plus your mortgage payment would be eliminated. That's like having an extra $500 per month in your budget."
- Focus on eliminating mortgage payment and freeing up monthly budget
```

**3. Update Function Declaration** (main.py)
Add `borderline_equity` parameter to `mark_equity_qualified` function definition.

---

## ✅ Fix #2: Scenario 12 - KB Timeout Handling

### Documentation Research:
- **SignalWire SWAIG docs (lines 1721-1735):** Always return HTTP 200, descriptive error messages in `response` field
- **SignalWire SWAIG docs (lines 1700-1717):** Can return `action` array with `set_meta_data` to set flags
- **Existing pattern:** `swaig-agent/tools/booking.py` lines 109-124 has error handling but doesn't set flag

### Implementation Plan:

**1. Update `handle_booking` Error Handler**
**File:** `swaig-agent/tools/booking.py` (lines 109-124)

**Add after error logging:**
```python
# Set manual booking required flag
await update_conversation_state(phone, {
    "conversation_data": {
        "manual_booking_required": True,
        "booking_error": str(e)
    }
})

return {
    "response": "...",
    "action": [{
        "set_meta_data": {
            "manual_booking_required": True
        }
    }]
}
```

**2. Update `handle_check_broker_availability` Error Handler**
**File:** `swaig-agent/tools/booking.py` (lines 185-191)

**Change:**
```python
except Exception as e:
    # Set flag
    await update_conversation_state(phone, {
        "conversation_data": {
            "manual_booking_required": True
        }
    })
    
    return {
        "response": "I'm having trouble accessing the calendar. Let me have someone call you directly...",
        "available": False,  # Don't assume available
        "action": [{
            "set_meta_data": {
                "manual_booking_required": True
            }
        }]
    }
```

**3. Update GOODBYE Prompt** (Database)
Add section:
```
=== MANUAL BOOKING FOLLOW-UP ===
If conversation_data shows manual_booking_required=true:
- Say: "I've noted your information, and someone from our team will call you within 24 hours to schedule your appointment. Is this the best number to reach you at?"
- Confirm their phone number
- Deliver warm goodbye with reassurance
```

---

## 📋 Summary Checklist

### ⏭️ Scenario 9: Borderline Equity
- [x] **INTENTIONALLY SKIPPED** - Broker handles it

### Fix #1: Tool Failure Handling (Scenario 11)
- **SignalWire SWAIG docs (lines 1721-1735):** Always return HTTP 200, descriptive error messages
- **Python asyncio:** Can use `asyncio.wait_for()` with timeout
- **Existing pattern:** `swaig-agent/tools/booking.py` line 76 uses `timeout=10.0` for httpx

### Implementation Plan:

**1. Update `search_knowledge` Implementation**
**File:** `swaig-agent/tools/knowledge.py` (currently placeholder, needs real implementation)

**Current Status:** Placeholder only (lines 12-40). LiveKit has working implementation in `livekit-agent/tools/knowledge.py` using keyword search.

**Fix Needed:**
```python
import asyncio
from services.supabase import get_supabase_client
import re
import time

async def handle_knowledge_search(caller_id: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Search knowledge base for reverse mortgage questions
    Uses keyword search (fast) instead of vector embeddings (slow)
    """
    query = args.get('query', '')
    
    if not query:
        return {
            "response": "What would you like to know about reverse mortgages?"
        }
    
    logger.info(f"[KNOWLEDGE] Search query: {query}")
    
    # Extract keywords (same logic as LiveKit implementation)
    tokens = [tok.lower() for tok in re.split(r"[^A-Za-z0-9]+", query or "") if tok]
    stop_words = {"a", "an", "the", "is", "are", "was", "were", "be", "been", "being", 
                  "have", "has", "had", "do", "does", "did", "will", "would", "should", 
                  "could", "may", "might", "can", "about", "if", "in", "on", "at", "to",
                  "for", "of", "with", "by", "from", "up", "out", "as", "but", "or", "and"}
    
    keywords = [tok for tok in tokens if tok not in stop_words and len(tok) > 2]
    priority_terms = ["spouse", "mortgage", "equity", "hecm", "borrower", "lien", 
                      "property", "house", "home", "die", "dies", "death", "airbnb", 
                      "rent", "rental", "income", "foreclosure", "payoff"]
    
    pattern = None
    for term in priority_terms:
        if term in keywords:
            pattern = term
            break
    
    if not pattern and keywords:
        pattern = max(keywords, key=len)
    
    if not pattern:
        pattern = tokens[0] if tokens else "reverse mortgage"
    
    # Wrap search in timeout (20 seconds)
    try:
        sb = get_supabase_client()
        
        search_results = await asyncio.wait_for(
            _perform_search(sb, pattern),
            timeout=20.0
        )
        
        if search_results:
            # Format results
            content = search_results[0].get('content', '')
            response_text = (
                f"Based on your question, here's what I can tell you: {content[:500]}. "
                "Would you like more specific information about any aspect?"
            )
        else:
            # No results found - use fallback
            response_text = get_fallback_response(query)
        
        return {
            "response": response_text
        }
        
    except asyncio.TimeoutError:
        logger.error(f"[KNOWLEDGE] Search timeout after 20s for query: {query}")
        
        # Return fallback response
        fallback = get_fallback_response(query)
        
        return {
            "response": (
                f"{fallback} "
                "Would you like me to have a licensed advisor provide more detailed information?"
            )
        }
    
    except Exception as e:
        logger.error(f"[KNOWLEDGE] Search error: {e}")
        
        # Return fallback response
        fallback = get_fallback_response(query)
        
        return {
            "response": (
                f"{fallback} "
                "I'm having trouble accessing the information right now. "
                "Would you like me to have someone call you with more details?"
            )
        }

async def _perform_search(sb, pattern: str):
    """Perform the actual database search"""
    response = sb.table("vector_embeddings")\
        .select("content, metadata")\
        .eq("content_type", "reverse_mortgage_kb")\
        .ilike("content", f"%{pattern}%")\
        .limit(3)\
        .execute()
    
    return response.data or []
```

**2. Add Fallback Responses** (for common questions)
**File:** `swaig-agent/tools/knowledge.py` or new file

```python
FALLBACK_RESPONSES = {
    "fees": (
        "Fees vary by lender, but typically include origination fees and closing costs. "
        "Your assigned broker will provide exact figures based on your property and loan amount."
    ),
    "how much can i get": (
        "The amount depends on your age, property value, and existing mortgage balance. "
        "Your broker will calculate the exact amount based on your specific situation."
    ),
    # ... more fallbacks
}

def get_fallback_response(query: str) -> str:
    """Get fallback response based on query keywords"""
    query_lower = query.lower()
    
    for keyword, response in FALLBACK_RESPONSES.items():
        if keyword in query_lower:
            return response
    
    return "I understand you're asking about reverse mortgages. Let me have someone call you with detailed information."
```

**3. Update ANSWER Prompt** (Database)
Add note:
```
=== KNOWLEDGE BASE TIMEOUT ===
If search_knowledge times out or errors, provide a helpful fallback response and offer to have someone call them with details.
```

---

## 📋 Summary Checklist

### ⏭️ Scenario 9: Borderline Equity
- [x] **INTENTIONALLY SKIPPED** - Broker handles it

### Fix #1: Tool Failure Handling (Scenario 11)
- [ ] Update `handle_booking` to set `manual_booking_required` flag on error
- [ ] Update `handle_check_broker_availability` to set flag on error
- [ ] Update GOODBYE prompt with manual booking follow-up messaging
- [ ] Test error scenarios

### Fix #2: KB Timeout Handling (Scenario 12)
- [ ] Update `handle_knowledge_search` to add `asyncio.wait_for()` timeout (20 seconds)
- [ ] Create fallback response dictionary for common questions
- [ ] Update ANSWER prompt with timeout handling note (optional)
- [ ] Test timeout scenario

---

## 🎯 Documentation Sources Used

1. **SignalWire SWAIG docs (`ai.SWAIG`):**
   - Lines 1686-1735: Error handling protocol
   - Lines 1700-1717: Action/metadata updates with `set_meta_data`
   - Key rule: Always return HTTP 200, use `response` field for errors

2. **Existing Code Patterns:**
   - `swaig-agent/tools/booking.py`: Error handling with try/catch
   - `swaig-agent/tools/booking.py`: `set_meta_data` usage
   - `swaig-agent/tools/booking.py`: `timeout=10.0` for httpx

3. **Database:**
   - Confirmed `borderline_equity` column exists in `leads` table
   - `update_conversation_state` function available for setting flags

---

## ⚠️ Important Notes

1. **SignalWire Pattern:** Always return HTTP 200, even for errors. Use descriptive `response` messages.

2. **Flag Setting:** Two ways to set flags:
   - Via `update_conversation_state()` (updates database)
   - Via `action` array with `set_meta_data` (updates conversation metadata)

3. **Timeouts:** Use Python `asyncio.wait_for()` - SignalWire doesn't have built-in function timeouts.

4. **Error Messages:** Write error messages for the AI agent (not directly for user). AI will communicate failure to user.

---

## 🚀 Next Steps

1. **Implement Fix #1** (Tool Failure Handling) - add flag setting to existing error handlers in `booking.py`
2. **Implement Fix #2** (KB Timeout) - add timeout wrapper to `handle_knowledge_search` in `tools/knowledge.py`

**All fixes follow SignalWire documentation patterns and existing code structure!**

