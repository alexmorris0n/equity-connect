# Trace Analysis - Instructions Level Check

**Date:** 2025-01-20  
**Method:** Query ACTUAL database instructions and step_criteria using MCP Supabase  
**Critical Check:** Instructions override tool selection - must verify what instructions actually tell LLM to do

---

## Critical Finding: EXIT step_criteria Still References get_lead_context

**Database Query Result:**
- EXIT `step_criteria`: "When get_lead_context completes AND user asked a question: IMMEDIATELY route to ANSWER context..."
- EXIT `instructions`: Now correctly says to use `route_to_context` (just fixed)

**CONTRADICTION:**
- Instructions say: "IMMEDIATELY call the route_to_context tool"
- step_criteria says: "When get_lead_context completes..."
- This tells LLM to wait for get_lead_context, contradicting instructions

**FIX NEEDED:**
Update EXIT step_criteria to match instructions - should say "When user asks a question: IMMEDIATELY call route_to_context tool"

---

## Methodology for Full Trace Analysis

For each scenario in `trace_test.md`, check:

1. **Tools Available** (from database `tools` array)
2. **Valid Contexts** (from database `valid_contexts` array)
3. **Instructions** (from database `instructions` field) - **WHAT DOES IT ACTUALLY SAY?**
4. **Step Criteria** (from database `step_criteria` field) - **WHAT DOES IT ACTUALLY SAY?**
5. **Contradictions:**
   - Do instructions tell LLM to use a tool that's not available?
   - Do instructions tell LLM to route somewhere not in valid_contexts?
   - Do step_criteria contradict instructions?
   - Do instructions override tool selection incorrectly?

---

## Next Steps

1. Fix EXIT step_criteria to match instructions
2. Check ALL contexts for similar instruction/step_criteria contradictions
3. Re-run full trace analysis using ACTUAL database content (not assumptions)
4. Verify each scenario against actual instructions, not just tool availability

