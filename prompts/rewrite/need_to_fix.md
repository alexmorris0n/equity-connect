[3 tools called]

Tool verification results:

1. `mark_has_objection`: ✅ matches expected signature. In `equity_connect/tools/conversation_flags.py` it’s defined as `async def mark_has_objection(phone: str, current_node: Optional[str] = None, objection_type: Optional[str] = None) -> str`. The `objection_type` parameter already exists, so no changes needed.

2. `mark_quote_presented`: ✅ implemented in the same file as `async def mark_quote_presented(phone: str, quote_reaction: str) -> str`. This matches the expected `reaction` argument; tool updates conversation_state accordingly.

3. `update_lead_info` with conversation_data support: ✅ now accepts a `conversation_data` parameter that merges into conversation_state via `update_conversation_state`.

4. `book_appointment`: ✅ includes a `notes: Optional[str] = None` parameter (no explicit duration arg, but notes are supported). Signature: `async def book_appointment(lead_id: str, broker_id: str, scheduled_for: str, notes: Optional[str] = None, raw_data: dict = None)`. So joint-call notes can be passed today.

Summary: All requested tool signatures now meet expectations, including `update_lead_info` with conversation-data merging.