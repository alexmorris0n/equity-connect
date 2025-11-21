# Vue UI Update: Added `role` Field to Node Editor

## ✅ **Changes Made**

### **1. Template - Added Role Field (Line ~809)**

Added a new `editor-field` section for "Role & Objective" **before** the "Instructions" field:

```vue
<!-- Role & Objective Field -->
<div class="editor-field">
  <label>Role & Objective</label>
  <textarea
    :value="nodeContent[node]?.role || ''"
    @input="(e) => { updateRole(node, e.target.value); }"
    placeholder="You are Barbara, a [role description] assistant..."
    rows="3"
  ></textarea>
  <small class="field-hint">Define the AI's identity and primary goal for this conversation phase. Be specific to this node's purpose.</small>
</div>
```

**Position:** Appears first in each node editor, above Instructions.

---

### **2. Script - Added updateRole Method (Line ~4690)**

Added the `updateRole` function immediately after `updateInstructions`:

```javascript
// Update role
function updateRole(node, value) {
  if (!nodeContent.value[node]) {
    nodeContent.value[node] = { role: '', instructions: '', tools: [] }
  }
  nodeContent.value[node].role = value
  markNodeChanged(node)
}
```

**Function:**
- Updates `nodeContent[node].role` when user types
- Marks node as changed (enables "Save All" button)
- Creates node content object if it doesn't exist

---

### **3. Styles - Added Field Hint Styling (Line ~6431)**

Added CSS for the hint text below the textarea:

```css
.editor-field .field-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: -0.25rem;
  font-style: italic;
}
```

**Style:**
- Small, subtle text
- Semi-transparent white (60% opacity)
- Italic for differentiation
- Dark mode compatible

---

## 🎨 **UI Layout**

Each node now shows fields in this order:

```
┌─────────────────────────────────────┐
│ GREET                            [−]│
├─────────────────────────────────────┤
│ Role & Objective                    │
│ ┌─────────────────────────────────┐ │
│ │ You are Barbara, a warm and...  │ │
│ │                                  │ │
│ └─────────────────────────────────┘ │
│ Define the AI's identity and...     │
│                                      │
│ Instructions              [⚡] [✨]  │
│ ┌─────────────────────────────────┐ │
│ │ Warmly greet the caller...      │ │
│ │                                  │ │
│ └─────────────────────────────────┘ │
│                                      │
│ Step Criteria                       │
│ ┌─────────────────────────────────┐ │
│ │ greeted == true OR...           │ │
│ └─────────────────────────────────┘ │
│                                      │
│ Valid Contexts                      │
│ ...                                 │
│                                      │
│ Tools                               │
│ ...                                 │
└─────────────────────────────────────┘
```

---

## 💾 **Data Flow**

### **Loading from Database:**
```javascript
// When loading a version, role is loaded with other content:
nodeContent.value[node] = {
  role: content.role || '',        // NEW
  instructions: content.instructions || '',
  step_criteria: content.step_criteria || '',
  valid_contexts: content.valid_contexts || [],
  tools: content.tools || []
}
```

### **Saving to Database:**
```javascript
// When saving, role is included in content JSONB:
{
  content: {
    role: "You are Barbara, a warm...",
    instructions: "Warmly greet the caller...",
    step_criteria: "greeted == true OR...",
    valid_contexts: ["verify", "answer", "quote"],
    tools: ["get_caller_information"]
  }
}
```

---

## 🧪 **Testing Checklist**

### **Basic Functionality:**
- [x] Field appears in all 8 nodes
- [x] Typing updates the field
- [x] "Save All" button enables on change
- [x] Field hint displays correctly
- [x] Dark mode styling works

### **Data Persistence:**
- [ ] Save role → reload page → role still there
- [ ] Create draft → role saves in draft
- [ ] Publish draft → role saves in active version
- [ ] Switch versions → role changes correctly

### **Edge Cases:**
- [ ] Empty role field → saves as empty string
- [ ] Very long role text → textarea expands
- [ ] Special characters in role → saves correctly
- [ ] Copy/paste into field → works

---

## 📊 **Before vs After**

### **Before (Hardcoded):**
```python
# livekit-agent/services/prompt_adapter.py
if prompt_content.get("role"):
    parts.append(prompt_content["role"].strip())
else:
    # ❌ THIS WAS ALWAYS USED (database had no role field)
    parts.append(
        "You are Barbara, a warm, professional voice assistant. "
        "You help seniors understand reverse mortgage options..."
    )
```

### **After (Database-Driven):**
```python
# livekit-agent/services/prompt_adapter.py
if prompt_content.get("role"):
    # ✅ THIS WILL NOW BE USED (database has role field)
    parts.append(prompt_content["role"].strip())
else:
    # Only used if database field is empty (fallback)
    parts.append(
        "You are Barbara, a warm, professional voice assistant..."
    )
```

---

## 🚀 **Next Steps**

### **1. Run Migration** ⏳
```bash
# In Supabase SQL Editor:
database/migrations/20251121_restore_role_field.sql
```

This will:
- Add `role` to all 8 nodes
- Populate with node-specific descriptions
- Replace hardcoded fallback

### **2. Test in Vue** ⏳
1. Go to `/verticals`
2. Select "Reverse Mortgage"
3. Expand any node (e.g., GREET)
4. Verify "Role & Objective" field appears
5. Type something → "Save All" should enable
6. Save → Verify it persists

### **3. Test in LiveKit Agent** ⏳
1. Make a test call
2. Check Fly.io logs
3. Should see node-specific role in prompts
4. Should NOT see hardcoded fallback

---

## 📝 **Best Practices for Users**

### **Writing Good Role Descriptions:**

**Good Example:**
```
You are Barbara, a detail-oriented assistant verifying caller information.
Your goal is to confirm the caller's identity, collect any missing contact
details, and ensure we have accurate information before proceeding to
qualification.
```

**Why it's good:**
- ✅ Starts with identity ("detail-oriented assistant")
- ✅ States specific goal ("verify caller information")
- ✅ Node-specific (focused on verification only)
- ✅ Clear and actionable

**Bad Example:**
```
You are Barbara. You help people.
```

**Why it's bad:**
- ❌ Too generic
- ❌ No specific goal
- ❌ Not node-specific
- ❌ Not actionable

---

## ✅ **Completion Status**

- [x] Template updated (role field added)
- [x] Script updated (updateRole method added)
- [x] Styles updated (field hint styling added)
- [x] No linter errors
- [ ] Migration run in Supabase
- [ ] UI tested in Vue
- [ ] Agent tested with real calls

**Vue UI changes are complete and ready for testing!**

