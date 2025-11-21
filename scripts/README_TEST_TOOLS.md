# Tool Testing Guide

## Quick Start

Test all 21 tools with a single command:

```bash
python scripts/test_all_tools.py
```

## Prerequisites

### Required Environment Variables

```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Agent Auth (Required for agent initialization)
AGENT_USERNAME=test_user
AGENT_PASSWORD=test_pass
```

### Optional Environment Variables

Some tools may require additional service keys:

```bash
# For calendar/broker tools
NYLAS_API_KEY=your-nylas-key

# For knowledge base search
# (Uses OpenAI/vector store - configured in services)

# For SMS confirmation
# (Uses SignalWire - configured in services)
```

## Test Lead

The script uses a test lead from your database:
- **ID**: `07f26a19-e9dc-422c-b61d-030e3c7971bb`
- **Name**: Testy Mctesterson
- **Phone**: Uses mock phone `+15551234567` for testing

## What Gets Tested

### ✅ Error Handling
- All tools have `try/except` blocks
- Tools return valid JSON even on errors
- User-friendly error messages included

### ✅ SwaigFunctionResult Structure
- Tools that toggle off use correct API:
  ```python
  swaig_result = SwaigFunctionResult(result)
  swaig_result.toggle_functions([{"name": "tool_name", "enabled": False}])
  ```

### ✅ Response Validation
- All tools return valid JSON
- Expected keys are present in responses
- Error responses include helpful messages

## Tool Categories Tested

1. **Lead Tools (4)**
   - `get_lead_context`
   - `verify_caller_identity`
   - `check_consent_dnc`
   - `update_lead_info`

2. **Broker Tools (2)**
   - `find_broker_by_territory`
   - `check_broker_availability`

3. **Calendar Tools (3)**
   - `book_appointment`
   - `reschedule_appointment`
   - `cancel_appointment`

4. **Knowledge Tools (1)**
   - `search_knowledge`

5. **Interaction Tools (3)**
   - `assign_tracking_number`
   - `send_appointment_confirmation`
   - `verify_appointment_confirmation`

6. **Conversation Flags (7)**
   - `mark_ready_to_book`
   - `mark_has_objection`
   - `mark_objection_handled`
   - `mark_questions_answered`
   - `mark_qualification_result`
   - `mark_quote_presented`
   - `mark_wrong_person`
   - `clear_conversation_flags_tool`

## Expected Output

```
🧪 STARTING TOOL TEST SUITE
============================================================
Testing: get_lead_context
✅ get_lead_context PASSED
...
📊 TEST SUMMARY
============================================================
Total Tools: 21
✅ Passed: 21
❌ Failed: 0
⏭️  Skipped: 0
✅ ALL TESTS PASSED
```

## Troubleshooting

### "Failed to initialize agent"
- Check that `AGENT_USERNAME` and `AGENT_PASSWORD` are set
- These are required for agent initialization (security check)

### "Missing env vars" warning
- Some tools may fail if service keys are missing
- This is expected - tools should handle missing keys gracefully

### Database connection errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- Check network connectivity to Supabase

### Tool-specific failures
- Check logs for specific error messages
- Some tools may require additional setup (e.g., broker assignments)
- Tools should still return valid error responses

## Notes

- Tests use mock data where appropriate (e.g., broker IDs, interaction IDs)
- Some tools may return errors due to missing data - this is expected
- The important thing is that tools handle errors gracefully and return valid responses
- Tools that toggle off should use `SwaigFunctionResult` with `toggle_functions()`






