# How Equity Connect Actually Works

**Last Updated:** November 18, 2025  
**Purpose:** Single source of truth to avoid confusion

---

## 🎯 The Simple Truth

**Equity Connect is 100% DATABASE-DRIVEN.**

Every call loads contexts and caller data from the Supabase database.

---

## 📞 What Happens On Every Call

```
1. SignalWire connects → Agent boots

2. configure_per_call() fires
   ✅ Loads contexts from database (prompt_versions table)
   ✅ Loads voice config from database (agent_voice_config table)
   ✅ Loads theme from database (theme_prompts table)
   ✅ Builds contexts dynamically
   ⚠️ If database fails → Uses hardcoded fallback (lines 107-188)

3. on_swml_request() fires
   ✅ Loads lead data from database (leads table)
   ✅ Loads call history from database (conversation_state table)
   ✅ Loads broker info from database (brokers table)
   ✅ Injects caller info into prompt
   ✅ Sets global_data for tools

4. Conversation flows
   - LLM sees database-loaded instructions
   - LLM sees database-loaded caller info
   - Routes through database-defined valid_contexts arrays
```

---

## ✅ What IS Database-Driven

| What | Where It's Stored | When It Loads |
|------|------------------|---------------|
| Context instructions | `prompt_versions.content->instructions` | Per-call (`configure_per_call`) |
| Context tools | `prompt_versions.content->tools` | Per-call (`configure_per_call`) |
| Context routing | `prompt_versions.content->valid_contexts` | Per-call (`configure_per_call`) |
| Voice config | `agent_voice_config` table | Per-call (`configure_per_call`) |
| Theme personality | `theme_prompts.content` | Per-call (`configure_per_call`) |
| Caller name | `leads.first_name, last_name` | Per-call (`on_swml_request`) |
| Caller property | `leads.property_city, property_value` | Per-call (`on_swml_request`) |
| Call history | `conversation_state.conversation_data` | Per-call (`on_swml_request`) |
| Assigned broker | `brokers.name, company` | Per-call (`on_swml_request`) |

---

## ⚠️ What is NOT Database-Driven (Fallback Only)

**Hardcoded contexts in `barbara_agent.py` lines 107-188:**
- These are a **SAFETY NET** if database query fails
- They are **NOT the primary system**
- They are **ONLY used when database is unreachable**

**Normal operation:** Database contexts are used  
**Fallback operation:** Hardcoded contexts are used

---

## 🔄 How Portal Edits Work

1. **Edit in Vue Portal** (Verticals.vue)
2. **Saves to Supabase** (prompt_versions, agent_voice_config, theme_prompts tables)
3. **Next call** → `configure_per_call()` loads new config from database
4. **Changes are live** (no code deploy needed)

---

## 🚫 Common Misconceptions

❌ **WRONG:** "Contexts are hardcoded in Python"  
✅ **RIGHT:** Contexts are loaded from database per-call, with hardcoded fallback

❌ **WRONG:** "It's a hybrid system"  
✅ **RIGHT:** It's 100% database-driven with a fallback safety net

❌ **WRONG:** "Portal edits don't work without deploy"  
✅ **RIGHT:** Portal edits are live on the next call

---

## 📚 For More Details

- **`MASTER_PRODUCTION_PLAN.md`** - Complete system architecture
- **`BARBGRAPH_COMPREHENSIVE_GUIDE.md`** - Historical BarbGraph system (deprecated)
- **`equity_connect/agent/barbara_agent.py`** - Agent implementation

---

**If you're confused about how the system works, read this file first.**


