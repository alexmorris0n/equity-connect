<!-- b04c6f3c-f5d3-4bd3-b900-675c9a797325 281d5906-20d7-4e20-b223-01f42e9c3e9f -->
# Vue Portal: Node-Based Prompt Editor (SIMPLIFIED)

## Architecture

- User picks a **vertical** (reverse_mortgage, solar, hvac)
- UI shows **7 node tabs** (greet, verify, qualify, answer, objections, book, exit)
- Each node has one generic prompt that works for all call types
- Plain HTML + Tailwind CSS (no Naive UI)

---

## Step 1: Add Vertical Selector

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** At the top of the main content area (around line 10-50)

**Action:** Replace or add before the existing prompts list:

```vue
<!-- Vertical Selector -->
<div class="mb-6">
  <label class="block text-sm font-medium text-gray-700 mb-2">
    Select Vertical:
  </label>
  <select
    v-model="selectedVertical"
    class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
  >
    <option value="">-- Choose a vertical --</option>
    <option value="reverse_mortgage">Reverse Mortgage</option>
    <option value="solar">Solar</option>
    <option value="hvac">HVAC</option>
  </select>
</div>
```

---

## Step 2: Add Node Tab Navigation

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** After the vertical selector, before the editor

**Action:** Add this HTML:

```vue
<!-- Node Tabs (only show if vertical is selected) -->
<div v-if="selectedVertical" class="mb-6 bg-indigo-50 rounded-lg p-4">
  <div class="flex items-center gap-2 overflow-x-auto pb-2">
    <button
      v-for="node in nodeList"
      :key="node.name"
      @click="selectedNode = node.name"
      :class="[
        'px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap',
        selectedNode === node.name
          ? 'bg-indigo-600 text-white shadow-md'
          : 'bg-white text-gray-700 hover:bg-indigo-100'
      ]"
    >
      {{ node.label }}
    </button>
  </div>
  <div class="mt-3 text-sm text-gray-600 italic">
    <strong>{{ selectedNode }}:</strong> {{ getCurrentNodeDescription() }}
  </div>
</div>
```

---

## Step 3: Add Data Variables

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** In `<script setup>`, near other ref declarations (around line 1810)

**Action:** Add these variables:

```javascript
// Vertical and node selection
const selectedVertical = ref('')
const selectedNode = ref('greet')
const nodePrompts = ref({}) // { vertical: { greet: {...}, verify: {...}, ... } }
const currentNodePrompt = ref(null)

// Node configuration
const nodeList = [
  { name: 'greet', label: '1. Greet', desc: 'Initial greeting when call starts' },
  { name: 'verify', label: '2. Verify', desc: 'Verify caller identity and get lead context' },
  { name: 'qualify', label: '3. Qualify', desc: 'Ask qualifying questions to assess fit' },
  { name: 'answer', label: '4. Answer', desc: 'Answer questions about the service' },
  { name: 'objections', label: '5. Objections', desc: 'Handle objections and concerns' },
  { name: 'book', label: '6. Book', desc: 'Schedule an appointment on the calendar' },
  { name: 'exit', label: '7. Exit', desc: 'Say goodbye and end the call' }
]
```

---

## Step 4: Add Helper Function

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** In the functions section (around line 2000+)

**Action:** Add this function:

```javascript
function getCurrentNodeDescription() {
  const node = nodeList.find(n => n.name === selectedNode.value)
  return node ? node.desc : ''
}
```

---

## Step 5: Load Node Prompts From Database

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** Find or create a `loadNodePrompts()` function

**Action:** Add this function:

```javascript
async function loadNodePrompts() {
  if (!selectedVertical.value) return
  
  loading.value = true
  try {
    // Query the active_node_prompts view (created in Plan 2)
    const { data, error } = await supabase
      .from('active_node_prompts')
      .select('*')
      .eq('vertical', selectedVertical.value)
    
    if (error) throw error
    
    // Group by node_name
    const grouped = {}
    for (const np of (data || [])) {
      grouped[np.node_name] = {
        id: np.id,
        vertical: np.vertical,
        node_name: np.node_name,
        name: np.name,
        version_number: np.version_number,
        content: np.content // JSONB object with role, personality, instructions, tools
      }
    }
    
    nodePrompts.value[selectedVertical.value] = grouped
    
    // Load the first node (greet)
    selectedNode.value = 'greet'
    loadCurrentNode()
    
  } catch (error) {
    console.error('Error loading node prompts:', error)
    message.error('Failed to load node prompts: ' + error.message)
  } finally {
    loading.value = false
  }
}
```

---

## Step 6: Watch For Vertical Changes

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** In the watchers section (around line 6400)

**Action:** Add this watcher:

```javascript
// Load node prompts when vertical changes
watch(selectedVertical, (newVertical) => {
  if (!newVertical) return
  
  // Load node prompts for this vertical
  if (!nodePrompts.value[newVertical]) {
    loadNodePrompts()
  } else {
    // Already loaded, just switch to first node
    selectedNode.value = 'greet'
    loadCurrentNode()
  }
})
```

---

## Step 7: Watch For Node Changes

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** In the watchers section

**Action:** Add this watcher:

```javascript
// Load node content when node changes
watch(selectedNode, () => {
  loadCurrentNode()
})
```

---

## Step 8: Load Node Content Function

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** Add near other functions

**Action:** Add this function:

```javascript
function loadCurrentNode() {
  if (!selectedVertical.value || !selectedNode.value) return
  
  const np = nodePrompts.value[selectedVertical.value]?.[selectedNode.value]
  
  if (np && np.content) {
    // Node exists - load its content from JSONB
    currentNodePrompt.value = np
    
    // Extract fields from JSONB content object
    const content = np.content
    draftContent.value = {
      role: content.role || '',
      personality: content.personality || '',
      instructions: content.instructions || '',
      tools: Array.isArray(content.tools) ? content.tools.join(', ') : (content.tools || '')
    }
  } else {
    // Node doesn't exist - create empty template
    currentNodePrompt.value = null
    draftContent.value = {
      role: '',
      personality: '',
      instructions: '',
      tools: ''
    }
  }
  
  // Update the editor UI
  nextTick(() => {
    updateAllTextareas()
  })
}
```

---

## Step 9: Save Node Prompt Function

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** Add near other save functions

**Action:** Add this function:

```javascript
async function saveCurrentNode() {
  if (!selectedVertical.value || !selectedNode.value) {
    message.error('No vertical or node selected')
    return
  }
  
  try {
    saving.value = true
    
    // Build JSONB content object
    const contentObj = {
      role: draftContent.value.role || '',
      personality: draftContent.value.personality || '',
      instructions: draftContent.value.instructions || '',
      tools: draftContent.value.tools ? draftContent.value.tools.split(',').map(t => t.trim()) : []
    }
    
    // Check if this node already exists
    const existingNode = currentNodePrompt.value
    
    if (existingNode) {
      // UPDATE existing prompt version
      // Increment version number and create new version
      const newVersionNumber = existingNode.version_number + 1
      
      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: existingNode.id,
          version_number: newVersionNumber,
          content: contentObj,
          is_active: true,
          is_draft: false,
          created_by: 'portal',
          change_summary: `Updated ${selectedNode.value} node from Vue portal`
        })
      
      if (versionError) throw versionError
      
      // Deactivate old version
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('prompt_id', existingNode.id)
        .eq('version_number', existingNode.version_number)
      
      // Update prompt current_version
      await supabase
        .from('prompts')
        .update({ current_version: newVersionNumber })
        .eq('id', existingNode.id)
      
    } else {
      // INSERT new prompt + version
      // First create the prompt record
      const { data: newPrompt, error: promptError } = await supabase
        .from('prompts')
        .insert({
          name: selectedNode.value.charAt(0).toUpperCase() + selectedNode.value.slice(1),
          description: `${selectedNode.value} node for ${selectedVertical.value}`,
          vertical: selectedVertical.value,
          node_name: selectedNode.value,
          current_version: 1,
          is_active: true
        })
        .select()
        .single()
      
      if (promptError) throw promptError
      
      // Then create the first version
      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: newPrompt.id,
          version_number: 1,
          content: contentObj,
          is_active: true,
          is_draft: false,
          created_by: 'portal',
          change_summary: `Created ${selectedNode.value} node from Vue portal`
        })
      
      if (versionError) throw versionError
      
      // Update local cache
      if (!nodePrompts.value[selectedVertical.value]) {
        nodePrompts.value[selectedVertical.value] = {}
      }
      nodePrompts.value[selectedVertical.value][selectedNode.value] = {
        id: newPrompt.id,
        vertical: selectedVertical.value,
        node_name: selectedNode.value,
        name: newPrompt.name,
        version_number: 1,
        content: contentObj
      }
      currentNodePrompt.value = nodePrompts.value[selectedVertical.value][selectedNode.value]
    }
    
    hasChanges.value = false
    message.success(`Node "${selectedNode.value}" saved for ${selectedVertical.value}`)
    
    // Reload to get latest version
    await loadNodePrompts()
    
  } catch (error) {
    console.error('Error saving node:', error)
    message.error('Failed to save node: ' + error.message)
  } finally {
    saving.value = false
  }
}
```

---

## Step 10: Update Save Button

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** Find the save button in the editor

**Action:** Replace with this:

```vue
<button
  @click="saveCurrentNode"
  :disabled="!hasChanges || saving || !selectedVertical"
  class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
>
  {{ saving ? 'Saving...' : 'Save Node' }}
</button>
```

---

## Step 11: Add CSS Styles

**File:** `portal/src/views/admin/PromptManagement.vue`

**Location:** In the `<style scoped>` section at the bottom

**Action:** Add these styles:

```css
/* Tailwind fallback styles */
.mb-6 { margin-bottom: 1.5rem; }
.mb-2 { margin-bottom: 0.5rem; }
.block { display: block; }
.text-sm { font-size: 0.875rem; }
.font-medium { font-weight: 500; }
.text-gray-700 { color: rgb(55 65 81); }
.w-full { width: 100%; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.border { border-width: 1px; }
.border-gray-300 { border-color: rgb(209 213 219); }
.rounded-md { border-radius: 0.375rem; }
.rounded-lg { border-radius: 0.5rem; }
.bg-indigo-50 { background-color: rgb(238 242 255); }
.bg-indigo-600 { background-color: rgb(79 70 229); }
.bg-white { background-color: white; }
.text-white { color: white; }
.text-gray-600 { color: rgb(75 85 99); }
.flex { display: flex; }
.items-center { align-items: center; }
.gap-2 { gap: 0.5rem; }
.overflow-x-auto { overflow-x: auto; }
.pb-2 { padding-bottom: 0.5rem; }
.p-4 { padding: 1rem; }
.mt-3 { margin-top: 0.75rem; }
.whitespace-nowrap { white-space: nowrap; }
.shadow-md { box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.hover\:bg-indigo-100:hover { background-color: rgb(224 231 255); }
.hover\:bg-indigo-700:hover { background-color: rgb(67 56 202); }
.transition { transition: all 0.2s; }
.italic { font-style: italic; }
.disabled\:opacity-50:disabled { opacity: 0.5; }
.disabled\:cursor-not-allowed:disabled { cursor: not-allowed; }
```

---

## Testing Steps

1. Open PromptManagement.vue in browser
2. Select "Reverse Mortgage" from vertical dropdown
3. Verify 7 node tabs appear (1. Greet through 7. Exit)
4. Click "1. Greet" tab
5. Verify editor shows content with these fields:
   - **Role:** "You are Barbara, a warm and helpful reverse mortgage assistant."
   - **Personality:** "Brief, friendly, natural conversational style..."
   - **Instructions:** "Warmly greet the caller..."
   - **Tools:** (empty for greet)
6. Edit the greet node content in the editor
7. Click "Save Node" button
8. Check Supabase `prompts` table:
   - Should see row with `vertical='reverse_mortgage'` and `node_name='greet'`
9. Check Supabase `prompt_versions` table:
   - Should see new version with incremented `version_number`
10. Switch to "2. Verify" tab
11. Verify editor shows different content (verify_caller_identity tool)
12. Reload page and verify content persists

---

## Key Differences From Old Plan

- ✅ **Uses `prompts` + `prompt_versions` tables** - not `node_prompts`
- ✅ **JSONB content structure** - role, personality, instructions, tools
- ✅ **Version control** - creates new version on each save
- ✅ **Queries `active_node_prompts` view** - created in Plan 2
- ✅ **No call_type selector** - just vertical
- ✅ **7 prompts per vertical** - not 7 × call_types
- ✅ **Context injection happens in agent** - not in UI

---

## Bridge From Plan 2

Plan 2 created:
- `prompts` table with `vertical` + `node_name` columns
- `prompt_versions` table with JSONB `content`
- `active_node_prompts` view for easy queries
- `get_node_prompt(vertical, node_name)` function
- 7 prompts for `reverse_mortgage` vertical

Plan 3 uses:
- `active_node_prompts` view to load data
- `prompts` + `prompt_versions` tables to save
- Same JSONB structure (role, personality, instructions, tools)
- Same vertical + node_name approach

**No gaps!** Plan 3 works directly with Plan 2's database structure.

---

## Files Modified

- `portal/src/views/admin/PromptManagement.vue` (all changes in one file)