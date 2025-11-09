# LiveKit Agent Tests

This directory contains smoke tests and integration tests for the LiveKit voice agent.

## Running Tests

### Unit Tests (No external dependencies)
```bash
cd livekit-agent
pytest tests/test_call_flow.py::TestCallFlow -v
```

### Integration Tests (Require API keys and database)
```bash
# Set up environment variables
export SUPABASE_URL=...
export SUPABASE_SERVICE_KEY=...
export OPENAI_API_KEY=...
export TEST_PHONE_NUMBER=+14244851544

# Run integration tests
pytest tests/test_call_flow.py::TestIntegration -v -m integration
```

## Test Coverage

### ✅ Unit Tests (No external dependencies)
- Transcript capture and formatting
- Cost computation for different providers
- Provider fallback logic
- Prompt variable injection (mocked)

### 🔌 Integration Tests (Require setup)
- Supabase phone config fetching
- Lead lookup by phone number
- Call evaluation (requires OpenAI API key)
- Full call flow end-to-end (requires LiveKit Cloud)

## Test Data Requirements

For integration tests, you need:

1. **Supabase Database**:
   - Test phone number in `signalwire_phone_numbers` table
   - Test lead in `leads` table with matching phone number
   - Prompt version in `prompts` and `prompt_versions` tables

2. **API Keys**:
   - `OPENAI_API_KEY` - For evaluation tests
   - `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` - For database tests
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` - For full integration

3. **Test Phone Number**:
   - Set `TEST_PHONE_NUMBER` environment variable
   - Should exist in your Supabase database

## Manual Testing Checklist

For manual testing of the full system:

### 1. Provider Configuration ✅
- [ ] Phone number configured in Supabase with STT/TTS/LLM providers
- [ ] Fallback providers set (per-number and global)
- [ ] API keys configured in environment

### 2. Inbound Call Flow ✅
- [ ] SignalWire routes call to LiveKit SIP
- [ ] Agent joins room and loads prompt
- [ ] Auto-greet works
- [ ] Transcript captured
- [ ] Cost computed and saved
- [ ] Recording started and metadata saved
- [ ] Evaluation triggered after call

### 3. Outbound Call Flow ✅
- [ ] POST /api/outbound-call creates SignalWire call
- [ ] SWML script routes to LiveKit SIP
- [ ] Agent joins and handles call
- [ ] Same flow as inbound (transcript, cost, recording, eval)

### 4. Portal Integration ✅
- [ ] Transcript displays in LeadDetail modal
- [ ] Audio player loads recording URL
- [ ] Evaluation scores display
- [ ] Recording playback works

### 5. Database Verification ✅
- [ ] Interaction saved to `interactions` table
- [ ] Transcript JSON stored in metadata
- [ ] Recording metadata saved
- [ ] Evaluation saved to `call_evaluations` table
- [ ] Prompt version tracked correctly

## Troubleshooting

### Tests fail with "Supabase credentials not set"
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` environment variables
- Or skip integration tests: `pytest -m "not integration"`

### Evaluation test fails
- Ensure `OPENAI_API_KEY` is set
- Check that GPT-5-mini model is available
- Verify Supabase `call_evaluations` table exists

### Provider fallback test fails
- Check that fallback providers are configured
- Verify provider factory functions exist

## Continuous Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run unit tests
  run: pytest tests/test_call_flow.py::TestCallFlow -v
  
- name: Run integration tests
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: pytest tests/test_call_flow.py::TestIntegration -v -m integration
```

