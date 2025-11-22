# Agent System Testing Guide

## Pre-Deployment Checklist

### ✅ Code Verification
- [x] All agent files created (`agents/greet.py`, `agents/verify.py`, etc.)
- [x] Entrypoint updated (`agent.py`)
- [x] Old routing files deleted
- [x] No syntax errors (verified by linter)
- [x] All imports correct

### ⚠️ Before Testing

1. **Database Migration** (Optional):
   ```sql
   -- Run this migration to track architecture version
   -- File: database/migrations/20251122_track_agent_architecture.sql
   ```

2. **Environment Variables**:
   - Ensure all API keys are set (Deepgram, OpenAI, ElevenLabs, etc.)
   - Verify Supabase connection works

3. **Database Configuration**:
   - Verify active STT/LLM/TTS models are set in database
   - Check that prompts are configured for all nodes (greet, verify, qualify, answer, quote, objections, book, goodbye)

## Local Testing Steps

### 1. Basic Import Test
```bash
# In LiveKit environment with dependencies installed
python -c "from agents.greet import BarbaraGreetAgent; print('✅ Import successful')"
```

### 2. Test Call Flow Scenarios

#### Scenario A: New Caller (Not Verified, Not Qualified)
**Expected Flow:** greet → verify → qualify → quote/answer

**Test Steps:**
1. Make test call with new phone number
2. Agent should greet
3. After greeting, should route to verify
4. After verification, should route to qualify
5. After qualification, should route to quote or answer

**Check Logs For:**
- `BarbaraGreetAgent created`
- `Database status for {phone}: verified=False, qualified=False`
- `Caller {phone} needs verification`
- `BarbaraVerifyTask started`
- `BarbaraQualifyTask started`

#### Scenario B: Verified Caller (Not Qualified)
**Expected Flow:** greet → qualify → quote/answer

**Test Steps:**
1. Set `verified=True` in conversation_state for test phone
2. Make test call
3. Agent should skip verify, go straight to qualify

**Check Logs For:**
- `Caller {phone} already verified, skipping to qualification`
- Should NOT see `BarbaraVerifyTask started`

#### Scenario C: Verified + Qualified Caller
**Expected Flow:** greet → answer

**Test Steps:**
1. Set `verified=True` and `qualified=True` in conversation_state
2. Make test call
3. Agent should skip verify and qualify, go straight to answer

**Check Logs For:**
- `Caller {phone} already verified + qualified, skipping to main conversation`
- Should NOT see verify or qualify tasks

#### Scenario D: Calculation Question
**Expected Flow:** answer → quote

**Test Steps:**
1. Start in answer agent
2. User asks: "How much can I get?"
3. Should route to quote immediately

**Check Logs For:**
- `Routing to quote - calculation question detected`
- `BarbaraQuoteAgent created`

#### Scenario E: Booking Request
**Expected Flow:** answer → book

**Test Steps:**
1. Start in answer agent
2. User says: "I want to book an appointment"
3. Should route to book

**Check Logs For:**
- `Routing to booking - explicit booking request detected`
- `BarbaraBookAgent created`

#### Scenario F: Simple Acknowledgment (Should NOT Route)
**Expected Flow:** answer → answer (stay in answer)

**Test Steps:**
1. Start in answer agent
2. Agent asks: "Does that help?"
3. User says: "yep" or "yes"
4. Should stay in answer, NOT route to quote or book

**Check Logs For:**
- Should NOT see routing logs
- Should see normal conversation continuation

## Common Issues & Solutions

### Issue 1: Import Errors
**Symptom:** `ModuleNotFoundError: No module named 'agents.greet'`

**Solution:**
- Ensure you're running from the correct directory
- Check that `livekit-agent/agents/__init__.py` exists
- Verify Python path includes `livekit-agent` directory

### Issue 2: Agent Not Routing
**Symptom:** Agent stays in same agent, doesn't hand off

**Check:**
- Verify tool is being called (check logs for tool call)
- Verify tool returns an Agent/Task instance (not just a string)
- Check that `chat_ctx` is being passed correctly

### Issue 3: Database Status Not Checked
**Symptom:** Always goes through verify/qualify even if already done

**Check:**
- Verify `get_conversation_state()` is working
- Check that `conversation_data` flags are set correctly
- Verify database connection is working

### Issue 4: Tasks Not Completing
**Symptom:** Verify or Qualify task never completes

**Check:**
- Verify `self.complete()` is being called
- Check that tool is actually being invoked
- Verify task completion logic is correct

## Logging to Watch

### Successful Handoff Logs
```
✅ ENTRYPOINT: BarbaraGreetAgent created
🤖 ENTRYPOINT: Creating BarbaraGreetAgent - phone={phone}, vertical={vertical}
🔄 Routing to verify - database check complete
✅ Handoff complete: now in 'verify'
```

### Error Logs to Watch For
```
❌ Handoff FAILED
⚠️ No lead_id available
❌ Could not load node config
⚠️ Database status check failed
```

## Performance Checks

1. **Latency**: Compare call duration vs old system
2. **Error Rate**: Monitor for any increase in errors
3. **Database Queries**: Verify no excessive queries
4. **Memory**: Check for memory leaks during long calls

## SignalWire Integration Test

Since SignalWire implementation should be unchanged:

1. **Test SignalWire Call**:
   - Make inbound call via SignalWire
   - Verify agent responds correctly
   - Verify routing works as expected

2. **Check SignalWire Logs**:
   - Verify phone number extraction works
   - Check that SIP attributes are parsed correctly

## Rollback Plan

If critical issues arise:

1. **Immediate Rollback**:
   ```bash
   git revert <commit-hash>
   # Or
   git checkout main
   ```

2. **Database**: No changes needed (same schema)

3. **Vue Portal**: No changes needed (reads same database)

## Success Criteria

✅ All test scenarios pass  
✅ No increase in error rate  
✅ Booking conversion rate maintained or improved  
✅ Call duration reasonable  
✅ No user complaints about "being passed around"  
✅ SignalWire integration works unchanged  

---

**Next Steps After Testing:**
1. Fix any issues found
2. Deploy to staging
3. Monitor for 24 hours
4. Deploy to production if stable

