# BarbGraph Setup Guide

## ✅ What's Been Completed

1. **Backend Agent** - Event-based routing system (`agent.py`)
2. **Database Schema** - Tables, views, RPC functions
3. **Vue Portal** - 7-node prompt editor
4. **Documentation** - Comprehensive guide (`BARBGRAPH_COMPREHENSIVE_GUIDE.md`)
5. **Node Prompts** - 7 seed prompts ready to deploy ✨ **NEW**

---

## 🚀 Next Steps: Deploy and Test

### Step 1: Apply Database Migration

Run the seeding migration in Supabase to populate the 7 node prompts:

```bash
# Option A: Via Supabase MCP (if available)
# The assistant can run this for you

# Option B: Via Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to: SQL Editor
4. Open: database/migrations/20251111_seed_reverse_mortgage_node_prompts.sql
5. Click "Run"
```

**What This Does:**
- Creates 7 prompts in `prompts` table
- Creates version 1 for each in `prompt_versions` table
- Refreshes `active_node_prompts` view
- Makes prompts immediately available to agent and Vue Portal

---

### Step 2: Verify in Vue Portal

1. Navigate to: **Admin → Prompt Management**
2. Select vertical: **"reverse_mortgage"**
3. You should see 7 node tabs: `Greet | Verify | Qualify | Answer | Objections | Book | Exit`
4. Click each tab to preview the seeded content
5. Edit if needed and click "Save Node"

---

### Step 3: Test with a Real Call

#### Place a Test Call:
```
1. Call your SignalWire number
2. Observe Barbara's greeting (Greet node)
3. Tell her your name → Verify node
4. Answer qualification questions → Qualify node
5. Ask questions → Answer node
6. Express a concern → Objections node (if triggered)
7. Say "I'd like to book" → Book node
8. Complete the call → Exit node
```

#### Monitor Agent Logs:
```bash
# Northflank logs will show:
🎤 Agent joined - loading greet node
📍 Loading node: greet (vertical=reverse_mortgage)
✅ Loaded greet from database (vertical=reverse_mortgage)
🔍 Routing check from node: greet
⏳ Node 'greet' not complete yet
[after greeting completes]
🧭 Router: greet → verify
📍 Loading node: verify (vertical=reverse_mortgage)
```

---

## 📊 What Each Node Does

| Node | Goal | Key Tools | Routes To |
|------|------|-----------|-----------|
| **Greet** | Welcome, build rapport | None | verify, qualify, answer |
| **Verify** | Confirm identity, load lead | `get_lead_context`, `verify_caller_identity` | qualify, answer, exit |
| **Qualify** | Ask assessment questions | `update_lead_info` | answer, exit |
| **Answer** | Answer reverse mortgage Q&A | `search_knowledge`, `mark_ready_to_book` | answer, objections, book |
| **Objections** | Handle concerns empathetically | `search_knowledge`, `mark_objection_handled` | answer, book, exit |
| **Book** | Schedule appointment | `check_broker_availability`, `book_appointment` | exit, answer |
| **Exit** | Close gracefully, handle handoffs | `save_interaction`, `mark_wrong_person` | greet (re-greet), END |

---

## 🔧 Customization Options

### Edit Prompts via Vue Portal
1. Select vertical: `reverse_mortgage`
2. Click node tab (e.g., `Greet`)
3. Edit fields:
   - **Role** - High-level purpose
   - **Personality** - Tone and style
   - **Instructions** - Step-by-step logic
   - **Tools** - Available tool names
4. Click "Save Node" → Creates new version, agent picks up immediately

### Add New Vertical (e.g., Solar)
1. Run similar seed migration with `vertical = 'solar'`
2. Adjust instructions for solar-specific questions
3. Same 7-node structure, different content

### Add Custom Node (8th node)
1. Update `node_completion.py` with completion criteria
2. Update `routers.py` with routing logic
3. Update `agent.py` route_next() with new case
4. Add prompt via Vue Portal or migration

---

## 🐛 Troubleshooting

### Issue: "No prompt found for node X"
**Solution:** Check Supabase `active_node_prompts` view:
```sql
SELECT * FROM active_node_prompts 
WHERE vertical = 'reverse_mortgage' 
  AND node_name = 'greet';
```
If empty, re-run the seeding migration.

### Issue: "Agent stuck on greet node"
**Solution:** Check conversation state flags:
```sql
SELECT conversation_data 
FROM conversation_state 
WHERE phone_number = '+1234567890';
```
Ensure `greeted: true` is set. May need to call a tool to set the flag.

### Issue: "Context not showing in prompt"
**Solution:** Check `load_node()` in `agent.py` - ensure `build_context_injection()` is called.

### Issue: "Portal shows old prompt after save"
**Solution:** 
1. Check `current_version` in `prompts` table matches `version_number` in `prompt_versions`
2. Hard refresh browser (Ctrl+Shift+R)
3. Check agent logs for "Loaded from database" confirmation

---

## 📈 Success Metrics

Track these to measure BarbGraph effectiveness:

- **Completion Rate by Node:** % of calls reaching each stage
- **Average Time per Node:** Identify bottlenecks
- **Drop-off Points:** Where do callers hang up?
- **Re-greet Rate:** How often does wrong person answer?
- **Booking Conversion:** % who reach Book node and complete

Query example:
```sql
-- Count calls by last node reached
SELECT 
  conversation_data->>'current_node' as last_node,
  COUNT(*) as call_count
FROM conversation_state
GROUP BY last_node
ORDER BY call_count DESC;
```

---

## 🎯 What's Next

1. ✅ **Deploy Migration** - Seed the 7 node prompts
2. ✅ **Test Call Flow** - Verify routing works end-to-end
3. ✅ **Refine Prompts** - Adjust based on real call feedback
4. 🔄 **Monitor Metrics** - Track conversion and drop-off
5. 🔄 **Add Verticals** - Expand to solar, HVAC, etc.
6. 🔄 **A/B Test Prompts** - Compare versions for optimization

---

## 🆘 Need Help?

- **Comprehensive Guide:** `BARBGRAPH_COMPREHENSIVE_GUIDE.md`
- **Backend Details:** `EVENT_BASED_STATE_MACHINE_IMPLEMENTATION.md`
- **Frontend Details:** `PLAN_3_EXECUTION_COMPLETE.md`
- **Bug Fixes Log:** `BARBGRAPH_INTEGRATION_FIXES_COMPLETE.md`
- **Field Mapping:** `DATABASE_FIELD_MAPPING_VERIFICATION.md`

**Questions?** Review the docs or ask the dev team!

---

**Ready to go live!** 🚀

