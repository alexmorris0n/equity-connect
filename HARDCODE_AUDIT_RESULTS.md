# Hardcode Audit Results
**Date:** 2025-11-22  
**Status:** ❌ **FOUND HARD-CODED INSTRUCTIONS**

---

## Summary

**Total Nodes Checked:** 8  
**Nodes with Hard-Coded Instructions:** 1  
**Nodes with Fallback Only:** 1

---

## Node-by-Node Audit

### ✅ 1. GREET Node
**File:** `livekit-agent/agents/greet.py`

**Status:** ✅ **NO HARD-CODED INSTRUCTIONS** (except fallback)

**Findings:**
- ✅ `on_enter()` only passes dynamic context (`greet_context`)
- ✅ Main instructions loaded from database: `config['instructions']`
- ⚠️ **Fallback instruction** (line 36): `"You are Barbara, a friendly AI assistant for reverse mortgage inquiries. Greet the caller warmly."`
  - **Note:** This is only used if database load fails (error handling)
  - **Recommendation:** Keep as fallback for error recovery

---

### ❌ 2. VERIFY Node
**File:** `livekit-agent/agents/verify.py`

**Status:** ❌ **HAS HARD-CODED INSTRUCTIONS**

**Findings:**
- ❌ **Line 53:** Hard-coded instruction in `on_enter()`:
  ```python
  await self.session.generate_reply(
      instructions="Collect any missing information or confirm existing details. Use 'collect missing, confirm existing' pattern."
  )
  ```
- ✅ Main instructions loaded from database: `config['instructions']`
- **Issue:** Should build dynamic context like other nodes instead of hard-coding

**Fix Required:** Replace with dynamic context building (like qualify, quote, answer, etc.)

---

### ✅ 3. QUALIFY Node
**File:** `livekit-agent/agents/qualify.py`

**Status:** ✅ **NO HARD-CODED INSTRUCTIONS**

**Findings:**
- ✅ `on_enter()` builds dynamic `qualification_context` based on database status
- ✅ Only passes context, no hard-coded instructions
- ✅ Main instructions loaded from database: `config['instructions']`

---

### ✅ 4. QUOTE Node
**File:** `livekit-agent/agents/quote.py`

**Status:** ✅ **NO HARD-CODED INSTRUCTIONS**

**Findings:**
- ✅ `on_enter()` builds dynamic `quote_context` based on available data
- ✅ Only passes context, no hard-coded instructions
- ✅ Main instructions loaded from database: `config['instructions']`

---

### ✅ 5. ANSWER Node
**File:** `livekit-agent/agents/answer.py`

**Status:** ✅ **NO HARD-CODED INSTRUCTIONS**

**Findings:**
- ✅ `on_enter()` builds dynamic `answer_context` based on history
- ✅ Only passes context, no hard-coded instructions
- ✅ Main instructions loaded from database: `config['instructions']`

---

### ✅ 6. OBJECTIONS Node
**File:** `livekit-agent/agents/objections.py`

**Status:** ✅ **NO HARD-CODED INSTRUCTIONS**

**Findings:**
- ✅ `on_enter()` builds dynamic `objection_context` based on conversation state
- ✅ Only passes context, no hard-coded instructions
- ✅ Main instructions loaded from database: `config['instructions']`

---

### ✅ 7. BOOK Node
**File:** `livekit-agent/agents/book.py`

**Status:** ✅ **NO HARD-CODED INSTRUCTIONS**

**Findings:**
- ✅ `on_enter()` builds dynamic `booking_context` based on history
- ✅ Only passes context, no hard-coded instructions
- ✅ Main instructions loaded from database: `config['instructions']`

---

### ✅ 8. GOODBYE Node
**File:** `livekit-agent/agents/goodbye.py`

**Status:** ✅ **NO HARD-CODED INSTRUCTIONS**

**Findings:**
- ✅ `on_enter()` builds dynamic `goodbye_context` based on reason and history
- ✅ Only passes context, no hard-coded instructions
- ✅ Main instructions loaded from database: `config['instructions']`

---

## Issues Found

### Issue 1: VERIFY Node Has Hard-Coded Instructions

**Location:** `livekit-agent/agents/verify.py:52-54`

**Current Code:**
```python
async def on_enter(self) -> None:
    """Start verification - collect missing info or confirm existing"""
    await self.session.generate_reply(
        instructions="Collect any missing information or confirm existing details. Use 'collect missing, confirm existing' pattern."
    )
```

**Problem:** This instruction is hard-coded and should be in the database prompt.

**Fix Required:** Replace with dynamic context building like other nodes:
```python
async def on_enter(self) -> None:
    """Start verification - collect missing info or confirm existing"""
    # Build dynamic context (no hard-coded instructions)
    verify_context = "=== VERIFICATION CONTEXT ===\n"
    
    # Check what verification fields are needed
    lead_id = self.lead_data.get('id')
    if lead_id:
        from services.supabase import get_supabase_client
        sb = get_supabase_client()
        try:
            response = sb.table('leads').select('phone_verified, email_verified, address_verified').eq('id', lead_id).single().execute()
            lead = response.data
            verify_context += f"Phone verified: {lead.get('phone_verified', False)}\n"
            verify_context += f"Email verified: {lead.get('email_verified', False)}\n"
            verify_context += f"Address verified: {lead.get('address_verified', False)}\n"
        except Exception as e:
            logger.error(f"Error checking verification status: {e}")
    
    # Check history for verification info
    history_items = list(self.chat_ctx.items) if hasattr(self.chat_ctx, 'items') else []
    for item in reversed(history_items):
        if hasattr(item, 'role') and item.role == 'user':
            if hasattr(item, 'text_content'):
                last_message = item.text_content()
            elif hasattr(item, 'content'):
                content = item.content
                last_message = ' '.join(str(c) for c in content if c) if isinstance(content, list) else str(content)
            else:
                continue
            verify_context += f"Last user message: {last_message[:200]}\n"
            verify_context += "Extract verification info if provided.\n"
            break
    
    verify_context += "===========================\n"
    
    # Let database prompt handle the actual instructions
    await self.session.generate_reply(instructions=verify_context)
```

---

## Summary Table

| Node | Hard-Coded in `on_enter()` | Fallback Only | Status |
|------|---------------------------|---------------|--------|
| GREET | ❌ No | ✅ Yes (error handling) | ✅ OK |
| VERIFY | ❌ **YES** | ❌ No | ❌ **NEEDS FIX** |
| QUALIFY | ❌ No | ❌ No | ✅ OK |
| QUOTE | ❌ No | ❌ No | ✅ OK |
| ANSWER | ❌ No | ❌ No | ✅ OK |
| OBJECTIONS | ❌ No | ❌ No | ✅ OK |
| BOOK | ❌ No | ❌ No | ✅ OK |
| GOODBYE | ❌ No | ❌ No | ✅ OK |

---

## Action Required

1. **Fix VERIFY node** - Remove hard-coded instruction from `on_enter()` and replace with dynamic context building
2. **Verify database prompts** - Ensure all instructions are in the database (already done via migration)

---

**Last Updated:** 2025-11-22


