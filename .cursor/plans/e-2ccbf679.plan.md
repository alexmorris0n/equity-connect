<!-- eeceeffe-e77b-480b-9c32-2fcd153a3b4f c44b944d-6608-4292-bcd2-9366e379dda1 -->
# Theme Prompt System Implementation Plan

## Context

Currently, each BarbGraph node prompt contains its own personality section. This creates duplication and inconsistency. We need a universal "theme" that defines Barbara's core personality ONCE and applies across all nodes.

**User Requirements (confirmed):**

- 1b: Store themes in Supabase database
- 2b: Separate theme per vertical (reverse_mortgage, solar, hvac)
- 3b: Injection order: Theme → Call Context → Node Prompt
- 4b: Remove personality sections from existing node prompts (avoid duplication)
- 5b: Create test script to simulate loading

---

## Step 1: Create Database Migration for Themes Table

**File:** `database/migrations/20251111_add_theme_prompts.sql`

**What to create:**

```sql
-- Add themes table for vertical-specific personality definitions
CREATE TABLE IF NOT EXISTS theme_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vertical TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE theme_prompts IS 'Universal personality themes for each vertical (reverse_mortgage, solar, hvac). Applied to ALL nodes in that vertical.';
COMMENT ON COLUMN theme_prompts.vertical IS 'Business vertical: reverse_mortgage, solar, hvac';
COMMENT ON COLUMN theme_prompts.content IS 'Core personality prompt applied before every node prompt';

-- Insert theme for reverse_mortgage vertical
INSERT INTO theme_prompts (vertical, content)
VALUES (
    'reverse_mortgage',
    E'# Barbara - Core Personality

You are Barbara, a warm and professional voice assistant helping homeowners.

## Speaking Style
- Brief responses (1-2 sentences typical)
- Natural conversational tone
- Simple language, no jargon
- Warm but professional

## Core Rules
- Never pressure or rush
- Be patient with seniors (clear speech, willing to repeat)
- Use tools for facts, don''t guess
- If unsure, offer to connect with expert
- Listen more than talk
- Adapt to their pace

## Response Format
- Short sentences
- One idea per sentence
- Pause for responses
- No info-dumping

## Values
- Honesty over salesmanship
- Education over persuasion
- Clarity over cleverness
- Their comfort over goals'
) ON CONFLICT (vertical) DO UPDATE 
SET content = EXCLUDED.content, updated_at = NOW();
```

**Why:** Stores theme prompts in database (consistent with node prompts architecture). One theme per vertical ensures personality consistency across all nodes.

---

## Step 2: Add Theme Loading Function to prompt_loader.py

**File:** `livekit-agent/services/prompt_loader.py`

**Add this function BEFORE load_node_prompt:**

```python
def load_theme(vertical: str = "reverse_mortgage") -> str:
    """Load universal theme prompt for a vertical from database
    
    Theme defines Barbara's core personality across ALL nodes.
    Applied before every node prompt for consistency.
    
    Args:
        vertical: Business vertical (default: "reverse_mortgage")
    
    Returns:
        Theme prompt content defining core personality
    """
    # TRY DATABASE FIRST
    try:
        from services.supabase import get_supabase_client
        
        sb = get_supabase_client()
        result = sb.table('theme_prompts').select('content').eq('vertical', vertical).eq('is_active', True).execute()
        
        if result.data and len(result.data) > 0:
            theme = result.data[0].get('content', '')
            if theme:
                logger.info(f"✅ Loaded theme for {vertical}: {len(theme)} chars")
                return theme
            else:
                logger.warning(f"Database returned empty theme for {vertical}, using fallback")
        else:
            logger.warning(f"No theme found in database for {vertical}, using fallback")
    
    except Exception as e:
        logger.warning(f"Failed to load theme from database: {e}, using fallback")
    
    # FALLBACK: Basic theme if database fails
    fallback_theme = """# Barbara - Core Personality

You are Barbara, a warm and professional voice assistant.

## Speaking Style
- Brief, natural responses
- Simple language, no jargon
- Patient with seniors

## Core Rules
- Never pressure
- Use tools for facts
- Listen more than talk
"""
    logger.info(f"Using fallback theme for {vertical}: {len(fallback_theme)} chars")
    return fallback_theme
```

**Why:** Separates theme loading logic. Database-first with fallback ensures robustness.

---

## Step 3: Update load_node_prompt to Combine Theme + Node

**File:** `livekit-agent/services/prompt_loader.py`

**Modify the load_node_prompt function:**

Find the section where it builds the prompt (around line 50):

```python
if prompt_parts:
    prompt = "\n".join(prompt_parts)
    logger.info(f"✅ Loaded {node_name} from database (vertical={vertical})")
    return prompt
```

**Replace with:**

```python
if prompt_parts:
    node_prompt = "\n".join(prompt_parts)
    logger.info(f"✅ Loaded {node_name} from database (vertical={vertical})")
    
    # Load theme and combine: Theme → Node
    theme = load_theme(vertical)
    combined_prompt = f"{theme}\n\n---\n\n{node_prompt}"
    
    logger.info(f"Combined theme ({len(theme)} chars) + node ({len(node_prompt)} chars) = {len(combined_prompt)} chars")
    return combined_prompt
```

**Also update the file fallback section** (around line 70):

```python
try:
    with open(prompt_path, 'r') as f:
        node_prompt = f.read()
        logger.info(f"✅ Loaded {node_name} from file: {prompt_path}")
        
        # Load theme and combine
        theme = load_theme(vertical)
        combined_prompt = f"{theme}\n\n---\n\n{node_prompt}"
        
        return combined_prompt
```

**Why:** Ensures theme is ALWAYS prepended to node prompt, whether from database or file. Separator `---` clearly delineates theme from node.

---

## Step 4: Update agent.py Prompt Injection Order

**File:** `livekit-agent/agent.py`

**Find the load_node method** (around line 115):

Current code:

```python
# Prepend context to node prompt
full_prompt = context + "\n\n" + node_prompt
```

**Replace with:**

```python
# Combine: Theme → Call Context → Node Prompt
# (Theme is already included in node_prompt from load_node_prompt)
full_prompt = f"{context}\n\n{node_prompt}"
```

**Why:** Maintains correct injection order: Theme (embedded in node_prompt) → Call Context → Node Prompt. No code change needed since theme is already in node_prompt.

---

## Step 5: Create Database Migration to Strip Personality from Nodes

**File:** `database/migrations/20251111_strip_personality_from_nodes.sql`

**What to create:**

```sql
-- Remove personality sections from node prompts to avoid duplication with theme
-- Personality is now defined ONCE in theme_prompts, not in each node

DO $$
DECLARE
    node_record RECORD;
    updated_content JSONB;
BEGIN
    -- Loop through all active reverse_mortgage node prompts
    FOR node_record IN 
        SELECT p.id, p.node_name, pv.id as version_id, pv.content
        FROM prompts p
        JOIN prompt_versions pv ON p.id = pv.prompt_id AND p.current_version = pv.version_number
        WHERE p.vertical = 'reverse_mortgage' AND p.is_active = true AND pv.is_active = true
    LOOP
        -- Remove 'personality' key from JSONB content
        updated_content := node_record.content - 'personality';
        
        -- Update the prompt_version
        UPDATE prompt_versions
        SET content = updated_content,
            change_summary = 'Removed personality (now in theme_prompts)',
            updated_at = NOW()
        WHERE id = node_record.version_id;
        
        RAISE NOTICE 'Stripped personality from node: %', node_record.node_name;
    END LOOP;
END $$;

-- Refresh active_node_prompts view if it exists
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' AND matviewname = 'active_node_prompts'
    ) THEN
        REFRESH MATERIALIZED VIEW active_node_prompts;
    END IF;
END $$;
```

**Why:** Removes duplication. Personality is now defined once in theme, not in every node.

---

## Step 6: Create Test Script

**File:** `livekit-agent/tests/test_theme_loading.py`

**What to create:**

```python
"""Test script for theme prompt loading system"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.prompt_loader import load_theme, load_node_prompt

def test_theme_loading():
    print("\n" + "="*60)
    print("THEME LOADING TEST")
    print("="*60)
    
    # Test 1: Load theme for reverse_mortgage
    print("\n[TEST 1] Loading theme for reverse_mortgage vertical...")
    theme = load_theme("reverse_mortgage")
    print(f"✅ Theme loaded: {len(theme)} characters")
    print(f"\nFirst 200 chars:\n{theme[:200]}...")
    
    # Test 2: Load node prompt (should include theme)
    print("\n[TEST 2] Loading greet node (should include theme)...")
    greet_prompt = load_node_prompt("greet", "reverse_mortgage")
    print(f"✅ Greet prompt loaded: {len(greet_prompt)} characters")
    
    # Test 3: Verify theme is in combined prompt
    print("\n[TEST 3] Verifying theme is included...")
    if "Barbara - Core Personality" in greet_prompt:
        print("✅ Theme found in combined prompt")
    else:
        print("❌ Theme NOT found in combined prompt")
        return False
    
    # Test 4: Check structure
    print("\n[TEST 4] Checking prompt structure...")
    parts = greet_prompt.split("---")
    if len(parts) >= 2:
        print(f"✅ Prompt correctly separated into {len(parts)} parts (theme, node)")
        print(f"   - Part 1 (theme): {len(parts[0])} chars")
        print(f"   - Part 2 (node): {len(parts[1])} chars")
    else:
        print("❌ Prompt structure incorrect")
        return False
    
    print("\n" + "="*60)
    print("ALL TESTS PASSED ✅")
    print("="*60 + "\n")
    return True

if __name__ == "__main__":
    test_theme_loading()
```

**How to run:**

```bash
cd livekit-agent
python tests/test_theme_loading.py
```

**Why:** Verifies theme loading works correctly without needing a live call.

---

## Step 7: Update Documentation

**File:** `BARBGRAPH_COMPREHENSIVE_GUIDE.md`

**Find the section about prompts** (search for "Component 2.1: Database Schema")

**Add this subsection BEFORE the prompts table section:**

````markdown
#### Theme Prompts System

BarbGraph uses a two-layer prompt system:

1. **Theme Layer (Universal):** Defines Barbara's core personality for the entire vertical
2. **Node Layer (Specific):** Defines actions and goals for each conversation stage

**Why Separate Themes?**
- Eliminates duplication (personality defined once, not 8 times)
- Easy to maintain (update personality in one place)
- Consistency (all nodes use same core personality)
- Flexibility (different verticals can have different personalities)

**Theme Prompts Table:**

```sql
CREATE TABLE theme_prompts (
    id UUID PRIMARY KEY,
    vertical TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
````

**Prompt Injection Order:**

```
Theme (from theme_prompts)
  ↓
Call Context (injected by agent)
  ↓
Node Prompt (from prompt_versions)
  ↓
Final Combined Prompt
```

**Example Combined Prompt:**

```
# Barbara - Core Personality
[theme content here]

---

=== CALL CONTEXT ===
Call Type: inbound-qualified
...

---

## Role
[node-specific role]

## Instructions
[node-specific instructions]
```
````

**Why:** Documents the two-layer architecture for future developers.

---

## Step 8: Apply Migrations in Correct Order

**Run in Supabase SQL Editor (in this order):**

1. `database/migrations/20251111_add_theme_prompts.sql`
2. `database/migrations/20251111_strip_personality_from_nodes.sql`

**Why:** Creates theme table first, then removes duplicate personality from nodes.

---

## Step 9: Test Everything

**Steps:**

1. Run test script:
   ```bash
   cd livekit-agent
   python tests/test_theme_loading.py
   ```

2. Check logs for theme loading messages:
   - "Loaded theme for reverse_mortgage: XXX chars"
   - "Combined theme (XXX chars) + node (XXX chars) = XXX chars"

3. Verify in Supabase:
   ```sql
   -- Check theme exists
   SELECT * FROM theme_prompts WHERE vertical = 'reverse_mortgage';
   
   -- Check nodes no longer have personality key
   SELECT p.node_name, pv.content->'personality' as personality
   FROM prompts p
   JOIN prompt_versions pv ON p.id = pv.prompt_id
   WHERE p.vertical = 'reverse_mortgage' AND p.is_active = true;
   -- Should return NULL for personality column
   ```

**Why:** Comprehensive testing ensures system works before deployment.

---

## Step 10: Commit and Deploy

**Git commit message:**
````

feat: add theme prompt system to BarbGraph

Two-layer prompt architecture:

- Theme layer: Universal personality per vertical (theme_prompts table)
- Node layer: Specific instructions per conversation stage

Changes:

1. Created theme_prompts table in Supabase
2. Added load_theme() to prompt_loader.py
3. Updated load_node_prompt() to combine theme + node
4. Stripped personality from node prompts (avoid duplication)
5. Added test script for verification
6. Updated documentation

Injection order: Theme → Call Context → Node Prompt

Benefits:

- No duplication (personality defined once)
- Easy maintenance (update in one place)
- Consistency across all nodes
- Vertical-specific personalities (reverse_mortgage vs solar)

```

**Why:** Clear commit message explains architecture and benefits.

---

## Success Criteria

- [ ] Theme loads from database for reverse_mortgage vertical
- [ ] Node prompts no longer contain personality key
- [ ] Combined prompts include both theme and node content
- [ ] Test script passes all 4 tests
- [ ] Logs show theme loading messages
- [ ] Documentation updated
- [ ] No errors in agent startup

---

## Rollback Plan

If something breaks:

1. Revert code changes to prompt_loader.py
2. Drop theme_prompts table:
   ```sql
   DROP TABLE IF EXISTS theme_prompts;
   ```

3. Re-apply original node prompts (they still have personality)
4. Agent continues working with old architecture

**Why:** Safe rollback ensures production isn't broken.

### To-dos

- [ ] Create database/migrations/20251111_add_theme_prompts.sql migration
- [ ] Add load_theme() function to livekit-agent/services/prompt_loader.py
- [ ] Update load_node_prompt() to combine theme + node in prompt_loader.py
- [ ] Verify agent.py prompt injection order (no changes needed)
- [ ] Create database/migrations/20251111_strip_personality_from_nodes.sql migration
- [ ] Create livekit-agent/tests/test_theme_loading.py test script
- [ ] Update BARBGRAPH_COMPREHENSIVE_GUIDE.md with theme system documentation
- [ ] Apply both migrations in Supabase SQL Editor
- [ ] Run test script and verify logs
- [ ] Commit and push all changes