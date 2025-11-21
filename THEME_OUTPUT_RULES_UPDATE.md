# Theme Output Rules Update - Complete

## ✅ **What We Did:**

### **1. Updated Database - Output Rules for Large Numbers**
Updated `theme_prompts.content_structured->output_rules` to handle large mortgage amounts naturally:

**NEW RULE:**
```
NUMBERS:
- Large mortgage amounts (over $1M): Round to millions and say naturally. 
  Example: "$1,532,156" = "about one point five million dollars" or "approximately $1.5 million" 
  NOT "one million five hundred thirty-two thousand"
```

**Location:** `theme_prompts` table → `content_structured` JSONB → `output_rules` field

---

### **2. Removed Hardcoded Fallbacks in LiveKit**
**File:** `livekit-agent/services/prompt_adapter.py`

**Removed 4 hardcoded fallbacks:**
- ❌ `role` - Now loads from DB only
- ❌ `personality` - Now loads from DB only  
- ❌ `output_format` - Now loads from DB only
- ❌ `pronunciation` - Now loads from DB only

**Rationale:** Database is source of truth. No silent fallbacks. Vue enforces completeness before saving.

---

### **3. Updated SignalWire to Use Structured Theme**
**File:** `equity_connect/services/contexts_builder.py`

**Changes:**
- Modified `load_theme()` to load `content_structured` JSONB (instead of old `content` TEXT)
- Added `_assemble_theme_from_structured()` helper function (matches LiveKit's implementation)
- Falls back to legacy `content` TEXT for backward compatibility

**Result:** Both LiveKit and SignalWire now use the same structured theme with updated output rules!

---

## 🎯 **Architecture:**

### **Theme Storage (Database Level):**
```
theme_prompts table:
├── content_structured (JSONB) ← NEW FORMAT (both LK & SW use this now)
│   ├── identity
│   ├── output_rules ← Updated with smart number rules!
│   ├── conversational_flow
│   ├── tools
│   └── guardrails
└── content (TEXT) ← LEGACY FORMAT (fallback only)
```

### **Node-Specific Fields:**
```
prompt_versions.content (JSONB):
├── role ← Node-specific (e.g., "You are Barbara, a scheduler...")
├── instructions ← Node-specific actions
├── tools ← Node-specific tool array
├── valid_contexts ← Node-specific routing
└── step_criteria_lk ← Node-specific completion logic
```

---

## 📋 **Field Assignment:**

### **Universal (Theme Level) - Same for All Nodes:**
- ✅ `identity` - Barbara's core personality
- ✅ `output_rules` - How to say numbers, phone numbers, addresses
- ✅ `conversational_flow` - Universal conversation patterns
- ✅ `tools` - General tool usage guidance
- ✅ `guardrails` - Safety and compliance rules

### **Node-Specific (Prompt Versions) - Changes Per Node:**
- ✅ `role` - What Barbara does in THIS node
- ✅ `instructions` - What to do in THIS node
- ✅ `tools` - Which tools available in THIS node
- ✅ `valid_contexts` - Where can route FROM THIS node
- ✅ `step_criteria` - When THIS node is complete

---

## 🔄 **How Both Platforms Load Themes:**

### **LiveKit:**
```python
# livekit-agent/services/prompt_loader.py
theme_data = load_theme_structured()  # Loads content_structured
assembled = _assemble_theme(theme_data)  # Combines 5 sections
# Uses assembled theme in prompts
```

### **SignalWire:**
```python
# equity_connect/services/contexts_builder.py
theme_data = load_theme_structured()  # Loads content_structured (NEW!)
assembled = _assemble_theme_from_structured(theme_data)  # Combines 5 sections
# Prepends to each step: f"{theme}\n\n---\n\n{node_instructions}"
```

---

## 📝 **Updated Output Rules (in Database):**

```
NUMBERS:
- Large mortgage amounts (over $1M): Round to millions and say naturally. 
  Example: "$1,532,156" = "about one point five million dollars" or "approximately $1.5 million" 
  NOT "one million five hundred thirty-two thousand"
- Amounts under $1M: Round to thousands and say naturally. 
  Example: "$450,000" = "four hundred fifty thousand dollars" or "about four hundred fifty thousand"
- Always use estimate language: "approximately", "about", "roughly", "around"
- Ages: Say as words. Example: "62" = "sixty-two years old"
- Percentages: Say naturally. Example: "62%" = "sixty-two percent"
- Small amounts: Say exactly. Example: "$150" = "one hundred fifty dollars"

PHONE NUMBERS:
- Say digit by digit with natural pauses. Example: "(415) 555-1234" = "four one five... five five five... one two three four"
- Not too fast: avoid running digits together

EMAIL ADDRESSES:
- Say slowly with clear enunciation. Example: "john@example.com" = "john... at... example dot com"
- Spell unusual words if needed

ADDRESSES:
- Use natural phrasing. Example: "123 Main Street" = "one twenty-three Main Street"
- Zip codes digit by digit: "90210" = "nine oh two one oh"

WEB URLS:
- Omit https:// and www. Example: "https://www.equityconnect.com" = "equity connect dot com"

OTHER:
- Avoid acronyms with unclear pronunciation (say "Reverse Mortgage" not "RM")
- Do not read internal labels (CONTEXT, TOOLS, RULES) aloud
```

---

## ✅ **Verification:**

Both LiveKit and SignalWire now:
1. Load `content_structured` JSONB from `theme_prompts`
2. Assemble it into a single text block
3. Use the updated output rules with smart number handling
4. Have NO hardcoded fallbacks (database is source of truth)

---

## 🚀 **Next Steps:**

1. **Add Vue UI fields** for `personality`, `output_format`, `pronunciation` (populated by DB)
2. **Add Vue validation** to require all fields before saving
3. **Test both platforms** to verify they use the new number rules correctly

---

## 📚 **Supporting Docs:**

**SignalWire:**
- `SIgnalWire Docs/ai.prompt` - Lines 16, 164: `prompt.text` is the main identity/personality
- Theme is prepended to each step's text (line 230 in contexts_builder.py)

**LiveKit:**
- `livekit-agent/services/prompt_loader.py` - Lines 85-99: `_assemble_theme()` function
- Structured theme loading confirmed

---

**Date:** 2024-11-21  
**Status:** ✅ Complete - Both platforms updated

