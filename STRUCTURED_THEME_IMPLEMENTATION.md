# Structured Theme Implementation - LiveKit-Aligned

**Date:** November 20, 2025  
**Status:** ✅ Complete - Ready to Test

---

## What We Built

A **structured theme editor** that:
1. Breaks the theme into **5 separate fields** in Vue (prevents users from breaking format)
2. Stores as **JSONB** in database (structured data, not text blob)
3. **Assembles at runtime** into one text block for LiveKit/SignalWire (platform-agnostic)

---

## Architecture

### Vue Frontend (Structured Editor)

**File:** `portal/src/views/admin/Verticals.vue`

**5 Separate Text Fields:**
```
┌─────────────────────────────────────────┐
│ Theme Editor: reverse_mortgage          │
├─────────────────────────────────────────┤
│ [1] Identity                            │
│ You are Barbara, a warm and professional│
│ voice assistant...                      │
├─────────────────────────────────────────┤
│ [2] Output Rules                        │
│ - Respond in plain text only...        │
│ - Keep replies brief...                │
│ - Spell out numbers...                 │
├─────────────────────────────────────────┤
│ [3] Conversational Flow                 │
│ - Help the caller efficiently...       │
│ - Be patient with seniors...           │
├─────────────────────────────────────────┤
│ [4] Tools                               │
│ - Use available tools as needed...     │
│ - Collect required info first...       │
├─────────────────────────────────────────┤
│ [5] Guardrails                          │
│ - Stay within safe, lawful use...      │
│ - Protect privacy...                   │
└─────────────────────────────────────────┘
         [Save Theme]
```

**State Management:**
```javascript
const themeStructured = ref({
  identity: '',
  output_rules: '',
  conversational_flow: '',
  tools: '',
  guardrails: ''
})

// Helper computed property for AI preview/diff
const assembledTheme = computed(() => {
  const sections = []
  if (themeStructured.value.identity) sections.push(themeStructured.value.identity)
  if (themeStructured.value.output_rules) sections.push(`# Output rules\n\n${themeStructured.value.output_rules}`)
  if (themeStructured.value.conversational_flow) sections.push(`# Conversational flow\n\n${themeStructured.value.conversational_flow}`)
  if (themeStructured.value.tools) sections.push(`# Tools\n\n${themeStructured.value.tools}`)
  if (themeStructured.value.guardrails) sections.push(`# Guardrails\n\n${themeStructured.value.guardrails}`)
  return sections.join('\n\n')
})
```

---

### Database (JSONB Storage)

**File:** `database/migrations/20251120_structured_theme_livekit_aligned.sql`

**Schema Change:**
```sql
-- Add new JSONB column
ALTER TABLE theme_prompts 
ADD COLUMN IF NOT EXISTS content_structured JSONB;

-- Structure: 5 keys
{
  "identity": "You are Barbara...",
  "output_rules": "- Respond in plain text...\n- Keep replies brief...",
  "conversational_flow": "- Help the caller...",
  "tools": "- Use available tools...",
  "guardrails": "- Stay within safe, lawful use..."
}
```

**Helper Function (Database-Side Assembly):**
```sql
CREATE OR REPLACE FUNCTION assemble_theme(theme_jsonb JSONB)
RETURNS TEXT AS $$
DECLARE
  assembled TEXT;
BEGIN
  assembled := COALESCE(theme_jsonb->>'identity', '');
  
  IF theme_jsonb->>'output_rules' IS NOT NULL THEN
    assembled := assembled || E'\n\n# Output rules\n\n' || (theme_jsonb->>'output_rules');
  END IF;
  
  IF theme_jsonb->>'conversational_flow' IS NOT NULL THEN
    assembled := assembled || E'\n\n# Conversational flow\n\n' || (theme_jsonb->>'conversational_flow');
  END IF;
  
  IF theme_jsonb->>'tools' IS NOT NULL THEN
    assembled := assembled || E'\n\n# Tools\n\n' || (theme_jsonb->>'tools');
  END IF;
  
  IF theme_jsonb->>'guardrails' IS NOT NULL THEN
    assembled := assembled || E'\n\n# Guardrails\n\n' || (theme_jsonb->>'guardrails');
  END IF;
  
  RETURN assembled;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Migration includes:**
- ✅ Converted existing `reverse_mortgage` theme to structured format
- ✅ Added default themes for `solar` and `hvac` verticals
- ✅ Keeps old `content` column for backward compatibility (can drop later)

---

### Agent Runtime (Prompt Loader)

**File:** `livekit-agent/services/prompt_loader.py`

**Load & Assemble Function:**
```python
def load_theme(vertical: str = "reverse_mortgage") -> str:
    """Load theme from database and assemble into single text block"""
    sb = get_supabase_client()
    result = sb.table('theme_prompts').select('content_structured, content').eq('vertical', vertical).eq('is_active', True).execute()
    
    if result.data and len(result.data) > 0:
        row = result.data[0]
        
        # PREFER: Structured format
        if row.get('content_structured'):
            theme_data = row['content_structured']
            assembled = _assemble_theme(theme_data)
            return assembled
        
        # FALLBACK: Old format (backward compatibility)
        if row.get('content'):
            return row['content']
    
    return fallback_theme


def _assemble_theme(theme_data: dict) -> str:
    """Assemble 5 sections into one formatted text block"""
    sections = []
    
    if theme_data.get('identity'):
        sections.append(theme_data['identity'])
    
    if theme_data.get('output_rules'):
        sections.append(f"# Output rules\n\n{theme_data['output_rules']}")
    
    if theme_data.get('conversational_flow'):
        sections.append(f"# Conversational flow\n\n{theme_data['conversational_flow']}")
    
    if theme_data.get('tools'):
        sections.append(f"# Tools\n\n{theme_data['tools']}")
    
    if theme_data.get('guardrails'):
        sections.append(f"# Guardrails\n\n{theme_data['guardrails']}")
    
    return "\n\n".join(sections)
```

**Output (Assembled Theme):**
```
You are Barbara, a warm and professional voice assistant helping homeowners explore reverse mortgage options.

# Output rules

- Respond in plain text only. Never use JSON, markdown, lists, tables, code, emojis, or other complex formatting.
- Keep replies brief by default: one to three sentences. Ask one question at a time.
- Spell out numbers: say "sixty-two percent" not "62%"
- Spell out phone numbers: "four one five, five five five, one two three four"
- Omit https:// when saying URLs.

# Conversational flow

- Help the caller accomplish their objective efficiently and correctly. Prefer the simplest safe step first.
- Be patient with seniors: speak clearly, willing to repeat, adapt to their pace.
- Provide guidance in small steps and confirm understanding before continuing.

# Tools

- Use available tools as needed, or upon caller request.
- Collect required information first. Perform actions silently if the runtime expects it.
- Speak outcomes clearly. If a tool fails, say so once, propose a fallback, or ask how to proceed.

# Guardrails

- Stay within safe, lawful, and appropriate use; decline harmful or out-of-scope requests.
- For medical, legal, or financial topics, provide general information only and suggest consulting a qualified professional.
- Protect privacy and minimize sensitive data collection.
```

---

## Benefits

### 1. **User Can't Break Format**
- Each section is a separate textarea
- Clear labels with descriptions
- No risk of accidentally deleting markdown headers

### 2. **LiveKit-Aligned Structure**
- Matches [LiveKit's Prompting Guide](https://docs.livekit.io/agents/build/prompting)
- Identity, Output Rules, Conversational Flow, Tools, Guardrails
- Best practices baked into the UI

### 3. **Platform-Agnostic**
- Assembled format works for SignalWire SWML
- Assembled format works for LiveKit Agents
- Same data, different consumption

### 4. **Easy to Maintain**
- Edit one section without touching others
- AI Helper can generate per-section (future enhancement)
- Version control works cleanly

### 5. **Database-First**
- Structured data = queryable
- Can filter, search, or analyze sections independently
- Future: analytics on which sections get edited most

---

## Testing Checklist

### Step 1: Run Database Migration
```bash
# In Supabase SQL Editor
psql> \i database/migrations/20251120_structured_theme_livekit_aligned.sql
```

**Verify:**
```sql
SELECT vertical, 
       jsonb_object_keys(content_structured) as keys 
FROM theme_prompts 
WHERE vertical = 'reverse_mortgage';

-- Should show: identity, output_rules, conversational_flow, tools, guardrails
```

### Step 2: Test Vue Portal
```bash
cd portal
npm run dev
```

1. Navigate to: **Admin → BarbGraph Vertical Manager**
2. Select vertical: **Reverse Mortgage**
3. Click **Theme** tab
4. **Verify:**
   - 5 separate text fields visible
   - Each field has number badge (1-5)
   - Fields are pre-populated with migrated theme
   - Hint text at top with LiveKit docs link
5. **Edit a field** (e.g., add a line to Output Rules)
6. Click **Save Theme**
7. **Reload page** and verify changes persist

### Step 3: Test Agent Prompt Loading
```bash
cd livekit-agent
python tests/test_theme_loading.py
```

**Expected Output:**
```
✅ Loaded structured theme for reverse_mortgage: 847 chars
Theme structure:
- Identity: 95 chars
- Output rules: 304 chars
- Conversational flow: 197 chars
- Tools: 256 chars
- Guardrails: 214 chars
```

### Step 4: Test Live Call (SignalWire)
1. Make inbound call to SignalWire number
2. Check logs for: `Loaded theme for reverse_mortgage: XXX chars`
3. Verify Barbara follows output rules (spells numbers, brief responses, etc.)

### Step 5: Test Live Call (LiveKit)
1. Start LiveKit agent worker
2. Connect test call
3. Check logs for: `Loaded structured theme for reverse_mortgage: XXX chars`
4. Verify Barbara follows output rules

---

## Rollback Plan (If Needed)

**If migration breaks something:**

1. **Vue still reads old format** (backward compatibility built in)
2. **Agent still reads old format** (fallback to `content` column)
3. **Drop new column:**
   ```sql
   ALTER TABLE theme_prompts DROP COLUMN content_structured;
   ```

---

## Future Enhancements

### 1. **AI Helper per Section**
Instead of generating full theme, generate per-section:
- "Generate output rules for solar vertical"
- "Generate guardrails for HVAC"

### 2. **Section Templates**
Pre-built templates for each section:
- "Standard Output Rules (Voice)"
- "Senior-Friendly Conversational Flow"
- "Financial Services Guardrails"

### 3. **Section Diff/Compare**
Compare two theme versions section-by-section:
```
[Identity] No changes
[Output Rules] 3 lines added
[Tools] 1 line removed
```

### 4. **Analytics**
Track which sections get edited most often:
```
Output Rules: 23 edits
Guardrails: 12 edits
Identity: 4 edits
```

---

## Files Changed

| File | What Changed |
|------|--------------|
| `database/migrations/20251120_structured_theme_livekit_aligned.sql` | **NEW** - Migration to add `content_structured` JSONB column |
| `livekit-agent/services/prompt_loader.py` | Updated `load_theme()` to read structured format + fallback |
| `portal/src/views/admin/Verticals.vue` | Replaced single textarea with 5 structured fields |

---

## Documentation References

- **LiveKit Prompting Guide:** https://docs.livekit.io/agents/build/prompting
- **Your Current Prompts:** `BARBGRAPH_CURRENT_PROMPTS.md`
- **System Architecture:** `BARBGRAPH_COMPREHENSIVE_GUIDE.md`

---

## Success Criteria

✅ Database migration runs without errors  
✅ Vue portal shows 5 separate text fields  
✅ Saving theme writes to `content_structured` JSONB  
✅ Agent loads and assembles theme correctly  
✅ SignalWire calls use assembled theme  
✅ LiveKit calls use assembled theme  
✅ Old `content` column still works (backward compatibility)  

---

**Ready to test!** 🚀



