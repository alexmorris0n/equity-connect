# Restoring the `role` Field - Why It's Critical

## 🎯 **The Problem**

### **What Happened:**
1. **Migration removed `role`** (thinking it was redundant with `instructions`)
2. **Code still uses `role`** (via hardcoded fallback)
3. **Result:** Zero database control over AI identity

### **Current Behavior:**
```python
# livekit-agent/services/prompt_adapter.py (lines 110-118)

if prompt_content.get("role"):
    parts.append(prompt_content["role"].strip())
else:
    # HARDCODED FALLBACK (currently being used)
    parts.append(
        "You are Barbara, a warm, professional voice assistant. "
        "You help seniors understand reverse mortgage options, verify their information, "
        "answer questions accurately, and schedule time with their assigned broker."
    )
```

**This hardcoded text is sent to EVERY node, regardless of node purpose!**

---

## ⚠️ **Why This Is a Problem**

### **1. No Customization**
- ❌ Can't customize role per vertical
- ❌ Can't customize role per node
- ❌ Can't A/B test different role descriptions
- ❌ Can't adjust based on performance

### **2. Wrong Context**
The hardcoded role says:
> "You help seniors understand reverse mortgage options, **verify their information, answer questions accurately, and schedule time**"

**But:**
- In GREET: Shouldn't mention verification yet
- In VERIFY: Should focus ONLY on verification
- In QUALIFY: Should focus on qualification assessment
- In QUOTE: Should focus on presenting numbers
- In BOOK: Should focus ONLY on scheduling

**Generic role = less effective AI**

### **3. No Database Control**
- Need code deployment to change
- Can't experiment in real-time
- Can't rollback quickly
- Can't track what worked

---

## ✅ **The Solution**

### **Restore `role` to Database**

Each node gets a specific, focused role:

#### **GREET**
```
"You are Barbara, a warm and professional voice assistant helping seniors 
explore reverse mortgage options. Your goal in this greeting phase is to 
establish rapport, make the caller feel comfortable, and smoothly transition 
to verifying their information or answering their immediate questions."
```

#### **VERIFY**
```
"You are Barbara, a detail-oriented assistant verifying caller information. 
Your goal is to confirm the caller's identity, collect any missing contact 
details, and ensure we have accurate information before proceeding to 
qualification."
```

#### **QUALIFY**
```
"You are Barbara, a knowledgeable assistant determining reverse mortgage 
eligibility. Your goal is to gather the four key qualification factors 
(age 62+, primary residence, sufficient equity, ability to maintain property) 
in a conversational way and accurately assess whether the caller qualifies."
```

...and so on for each node.

---

## 📊 **Impact**

### **Before (Hardcoded):**
```
┌─────────────────────────────────────────┐
│ Every Node Gets:                        │
│ "You help seniors understand reverse    │
│  mortgage options, verify their info,   │
│  answer questions, and schedule time"   │
│                                         │
│ ❌ Generic                              │
│ ❌ Not node-specific                    │
│ ❌ Can't customize                      │
└─────────────────────────────────────────┘
```

### **After (Database-Driven):**
```
┌─────────────────────────────────────────┐
│ GREET:    "establish rapport..."        │
│ VERIFY:   "confirm identity..."         │
│ QUALIFY:  "determine eligibility..."    │
│ QUOTE:    "present estimate..."         │
│ ANSWER:   "provide accurate answers..." │
│ OBJECTION:"address concerns..."         │
│ BOOK:     "schedule appointment..."     │
│ GOODBYE:  "conclude conversation..."    │
│                                         │
│ ✅ Node-specific                        │
│ ✅ Focused objectives                   │
│ ✅ Database-driven                      │
│ ✅ Can customize & test                 │
└─────────────────────────────────────────┘
```

---

## 🔧 **Implementation Steps**

### **Step 1: Database Migration** ✅
**File:** `database/migrations/20251121_restore_role_field.sql`

Adds `role` field to all 8 nodes with appropriate descriptions.

### **Step 2: Vue UI Update** (Next)
Add `role` textarea to each node editor:
```vue
<div class="form-field">
  <label for="role">Role & Objective</label>
  <textarea 
    id="role" 
    v-model="nodeData.content.role"
    rows="3"
    placeholder="You are Barbara, a [role description] assistant..."
  />
  <p class="help-text">
    Define the AI's identity and primary goal for this conversation phase.
    Be specific to this node's purpose.
  </p>
</div>
```

### **Step 3: Code Already Works** ✅
No code changes needed - already reads and uses `role` field!

---

## 📝 **Best Practices for Role Descriptions**

### **1. Start with Identity**
```
"You are Barbara, a [adjective] assistant [doing what]..."
```

### **2. State the Objective**
```
"Your goal in this [node] phase is to [specific objective]..."
```

### **3. Be Node-Specific**
- Don't mention other node objectives
- Focus on THIS phase only
- Keep it clear and actionable

### **4. Examples**

**Good (Specific):**
```
"You are Barbara, a detail-oriented assistant verifying caller information.
Your goal is to confirm identity and ensure accuracy."
```

**Bad (Generic):**
```
"You are Barbara. You help people with reverse mortgages."
```

---

## 🎯 **Testing After Migration**

### **Before Migration:**
```bash
# Check logs - should see hardcoded fallback being used
fly logs -a barbara-livekit | grep "You are Barbara, a warm"
```

### **After Migration:**
```bash
# Should see node-specific roles
fly logs -a barbara-livekit | grep "detail-oriented assistant"  # VERIFY
fly logs -a barbara-livekit | grep "knowledgeable assistant"   # QUALIFY
fly logs -a barbara-livekit | grep "scheduling assistant"      # BOOK
```

---

## ✅ **Benefits**

1. **Database Control**
   - Change role descriptions without code deployment
   - A/B test different descriptions
   - Rollback instantly if needed

2. **Node-Specific Behavior**
   - Each node has focused objective
   - AI knows exactly what to do
   - Less confusion, better performance

3. **Customization**
   - Different roles per vertical
   - Different roles per broker (future)
   - Adapt based on performance data

4. **Consistency**
   - All node config in one place (database)
   - Same pattern as instructions, tools, step_criteria
   - Easier to manage and understand

---

## 📊 **Summary**

| Aspect | Before | After |
|--------|--------|-------|
| Role Source | Hardcoded | Database |
| Customization | ❌ None | ✅ Full control |
| Node-Specific | ❌ Generic for all | ✅ Unique per node |
| A/B Testing | ❌ Requires code deploy | ✅ Change in UI |
| Rollback | ❌ Code revert | ✅ Instant in DB |

**Restoring `role` gives you back control over a critical part of AI behavior!**

---

## 🚀 **Next Steps**

1. ✅ Run migration: `20251121_restore_role_field.sql`
2. ⏳ Update Vue UI to expose `role` field
3. ⏳ Test with different role descriptions
4. ⏳ Monitor performance improvements

**Migration is ready to run!**

