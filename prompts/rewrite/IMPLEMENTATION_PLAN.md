# Implementation Plan: Escape Hatch Pattern + Universal Core Tools

**Date:** 2025-01-19  
**Goal:** Make agent resilient, scalable, and production-ready

---

## 🎯 Universal Core Tools (to be in EVERY context)

1. `search_knowledge` - Answer questions anywhere
2. `mark_has_objection` - Log objections anywhere
3. `mark_ready_to_book` - Signal readiness anywhere
4. `mark_wrong_person` - Handle wrong person scenarios anywhere
5. `get_lead_context` - Refresh lead data + question routing logic anywhere

---

## 🔄 Escape Hatch Pattern (valid_contexts)

**Baseline for ALL contexts:** `["answer", "objections", "exit"]`

**Plus natural forward paths:**
- `greet` → add `["verify"]` (natural next step)
- `verify` → add `["qualify"]` (natural next step)
- `qualify` → add `["quote"]` (natural next step)
- `quote` → add `["book"]` (natural next step)
- `book` → no additional (exit/answer/objections sufficient)
- `answer` → add `["book", "greet"]` (can book or restart)
- `objections` → add `["book"]` (can book after objections)
- `exit` → add `["greet", "book", "qualify", "quote"]` (can restart or continue)

---

## 📊 Current vs. Target State

### greet
**Current:**
- valid_contexts: `["verify", "exit", "answer"]`
- Missing: `["objections"]`
- Tools missing: `["search_knowledge", "get_lead_context"]`

**Target:**
- valid_contexts: `["verify", "exit", "answer", "objections"]`
- Tools: All existing + `["search_knowledge", "get_lead_context"]`

### verify
**Current:**
- valid_contexts: `["qualify", "exit", "answer"]`
- Missing: `["objections"]`
- Tools missing: `["search_knowledge"]` (has get_lead_context ✓)

**Target:**
- valid_contexts: `["qualify", "exit", "answer", "objections"]`
- Tools: All existing + `["search_knowledge"]`

### qualify
**Current:**
- valid_contexts: `["quote", "exit", "answer"]`
- Missing: `["objections"]`
- Tools missing: `["get_lead_context"]` (has search_knowledge ✓)

**Target:**
- valid_contexts: `["quote", "exit", "answer", "objections"]`
- Tools: All existing + `["get_lead_context"]`

### quote
**Current:**
- valid_contexts: `["answer", "book", "exit"]`
- Missing: `["objections"]`
- Tools missing: `["get_lead_context"]` (has search_knowledge ✓)

**Target:**
- valid_contexts: `["answer", "book", "exit", "objections"]`
- Tools: All existing + `["get_lead_context"]`

### book
**Current:**
- valid_contexts: `["exit", "answer"]`
- Missing: `["objections"]`
- Tools missing: `["get_lead_context"]` (has search_knowledge ✓)

**Target:**
- valid_contexts: `["exit", "answer", "objections"]`
- Tools: All existing + `["get_lead_context"]`

### answer
**Current:**
- valid_contexts: `["objections", "book", "exit"]`
- Missing: `["answer"]` (self for multiple questions) and `["greet"]` (restart)
- Tools: Has all core tools ✓

**Target:**
- valid_contexts: `["answer", "objections", "book", "exit", "greet"]`
- Tools: No changes needed ✓

### objections
**Current:**
- valid_contexts: `["answer", "book", "exit"]`
- Missing: `["objections"]` (self for multiple objections) and `["greet"]` (restart)
- Tools: Has all core tools ✓

**Target:**
- valid_contexts: `["answer", "objections", "book", "exit", "greet"]`
- Tools: No changes needed ✓

### exit
**Current:**
- valid_contexts: `["answer", "greet"]`
- Missing: `["objections"]` and forward paths `["book", "qualify", "quote"]`
- Tools missing: `["get_lead_context"]` (has search_knowledge ✓)

**Target:**
- valid_contexts: `["answer", "objections", "exit", "greet", "book", "qualify", "quote"]`
- Tools: All existing + `["get_lead_context"]`

---

## 🚀 Execution Order

1. Update database for all contexts (universal tools + escape hatches)
2. Test with validator script
3. Update documentation
4. Create test scenarios

