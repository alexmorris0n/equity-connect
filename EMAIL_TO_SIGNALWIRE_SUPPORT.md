# Email to SignalWire Support - Barbara Agent Hangup Issue

**Subject:** SignalWire AI Agent Routing to Exit Prematurely - `step_criteria` Evaluation Timing Question

---

Hi SignalWire Support Team,

We're experiencing an issue where our AI agent (Barbara) is routing to the EXIT context immediately after asking questions, without waiting for user responses. We've fixed several code-level bugs, but the core issue appears to be related to how SignalWire evaluates `step_criteria`.

## The Problem

After Barbara answers a question and asks "Any other questions?", she immediately routes to EXIT and hangs up, without waiting for the user's response. This happens even though our `step_criteria` explicitly states:

> "CRITICAL RULE: This step is NOT complete until the user has EXPLICITLY SPOKEN their response. Do NOT evaluate completion immediately after you finish speaking."

## What We've Fixed

1. ✅ **Tool Return Values:** Fixed all tools to correctly use `SwaigFunctionResult` with `.data` and `.response` attributes
2. ✅ **Timeout Protection:** Added timeouts to all blocking I/O operations (Supabase, Nylas API)
3. ✅ **Boolean Conversion:** Fixed `skip_user_turn` string-to-boolean conversion bug
4. ✅ **Context Instructions:** Updated ANSWER context with explicit wait instructions in both `step_criteria` and instructions sections
5. ✅ **Context Ordering:** Reordered `valid_contexts` to put `answer` first and `exit` last

## Questions for Your Team

1. **When does SignalWire evaluate `step_criteria`?** Does it evaluate immediately after the agent finishes speaking, or does it wait for user input first?

2. **Is there a way to force SignalWire to wait for user speech before evaluating `step_criteria` completion?** We've added explicit text instructions, but they don't seem to be preventing premature evaluation.

3. **Does the order of `valid_contexts` affect default routing?** If `step_criteria` evaluates as "complete" but doesn't specify a target context, which context is selected by default?

4. **Are there SDK settings that control `step_criteria` evaluation timing?** (e.g., `wait_for_user`, `end_of_speech_timeout`, etc.)

5. **Is there a way to explicitly prevent routing until user has spoken?** Even if the LLM thinks the step is complete based on `step_criteria` text, can we force it to wait for actual user speech?

## Current Configuration

- **Context:** ANSWER context
- **`step_criteria`:** Contains explicit "ABSOLUTE RULE" requiring user to speak before completion
- **`valid_contexts`:** `["answer", "book", "objections", "greet", "exit"]`
- **`skip_user_turn`:** `False` (correctly converted from string)

## Test Scenario

1. User asks: "Can a house be converted into a duplex for a reverse mortgage?"
2. Barbara calls `search_knowledge` tool ✅
3. Barbara answers the question ✅
4. Barbara asks: "Any other questions?" ✅
5. **Barbara immediately routes to EXIT and hangs up** ❌ (should wait for user response)

**Expected Behavior:** Barbara should wait for user to say "yes", "no", or ask another question before evaluating completion.

**Actual Behavior:** Routes to exit immediately after asking the question.

## Code References

- Agent: `equity_connect/agent/barbara_agent.py`
- Context Builder: `equity_connect/services/contexts_builder.py`
- Database: Prompts stored in `prompts` → `prompt_versions` → `content` JSONB

We've attached a detailed summary document (`BARBARA_HANGUP_FIXES_SUMMARY.md`) with all fixes attempted.

Any guidance on how SignalWire handles `step_criteria` evaluation timing would be greatly appreciated!

Thanks,  
[Your Name]

