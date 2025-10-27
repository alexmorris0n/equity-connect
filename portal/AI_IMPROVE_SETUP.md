# AI Improve Feature Setup

## Overview

The Prompt Management portal now includes an ✨ **AI Improve** feature that helps you enhance any section of your prompts using GPT-4.

---

## How It Works

### **1. Click ✨ Sparkle Icon**
When you expand any section in the Editor tab, you'll see a purple sparkle icon (✨) next to the section name.

### **2. AI Understands Context**
The AI knows:
- **Prompt Name:** "Inbound - Qualified"
- **Purpose:** "Handle returning leads who are already in the system..."
- **Goal:** "Skip unnecessary re-qualification if all 4 items known..."
- **Section:** "Role & Objective"
- **Current Content:** What you already have

### **3. Describe What You Want**
Type your request or click a quick suggestion:
- "Make this warmer for elderly callers"
- "Add more examples"
- "Make it more concise"
- "Improve interruption handling"

### **4. Review Side-by-Side**
AI shows:
- Original content (left)
- AI-improved content (right)
- List of changes made

### **5. Accept or Reject**
- ✅ **Accept** - Updates the section (you still need to Save)
- ❌ **Cancel** - Discard AI suggestion

---

## Setup Required

### **1. Add OpenAI API Key**

Create or update `portal/.env`:

```bash
# OpenAI API Key (for AI Improve feature)
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here

# Existing Supabase vars
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### **2. Run Database Migration**

Run `database/migrations/026_add_prompt_metadata.sql` in Supabase SQL Editor:

```sql
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS goal TEXT;
-- ... (full migration in the file)
```

This adds `purpose` and `goal` columns to give AI context about each prompt's mission.

### **3. Restart Dev Server**

```bash
cd portal
npm run dev
```

---

## Quick Suggestions Per Section

The AI helper provides contextual quick suggestions for each section:

### **Role & Objective**
- Make tone warmer and friendlier
- Add clarity about Barbara's purpose
- Optimize for elderly callers
- Make more concise

### **Personality & Tone**
- Add more conversational fillers
- Improve interruption handling
- Make responses more concise
- Add senior-friendly pacing

### **Instructions & Rules**
- Add error handling
- Improve qualification logic
- Add compliance guardrails
- Add edge case handling

### **Conversation Flow**
- Expand greeting section
- Add smoother transitions
- Improve booking flow
- Add more natural dialogue

### **Tools**
- Add tool usage examples
- Explain when to use each tool
- Add error handling for tools
- Add filler phrases while tools run

### **Context**
- List all available variables
- Add variable usage examples
- Explain missing variable handling

### **Pronunciation**
- Add more phonetic examples
- Include broker name guidance
- Add number pronunciation rules

### **Output Format**
- Make more specific
- Add length guidelines
- Add formatting examples

### **Safety & Escalation**
- Add more escalation triggers
- Improve disqualification scripts
- Add compliance reminders

---

## Cost

**~$0.01-0.03 per improvement** (GPT-4 API call)
- Cheap enough to use frequently
- Quality improvements worth the cost

---

## Tips

1. **Be specific** - "Make warmer for seniors" vs "Make better"
2. **Use quick suggestions** - They're pre-tuned for each section
3. **Review carefully** - AI is smart but not perfect
4. **Iterate** - Click improve multiple times with different requests
5. **Save after accepting** - AI updates the content, you still need to save the version

---

## Example Workflow

1. Open "Inbound - Qualified" prompt
2. Expand "Conversation Flow" section
3. Click ✨ sparkle icon
4. Click "Add smoother transitions" quick suggestion
5. AI generates improved content with natural transitions
6. Review side-by-side diff
7. Click "Accept Changes"
8. Click "Save Changes" to persist
9. Click "Deploy" when ready to use in production

---

## Future Enhancements

- [ ] Generate entire sections from scratch
- [ ] Multi-section improvements at once
- [ ] A/B test generation (create 2 variants)
- [ ] Compliance checking
- [ ] Variable suggestion ("You should use {{leadAge}} here")
- [ ] Voice-specific optimization (different for alloy vs shimmer)

---

**This makes prompt iteration 10x faster!** 🚀

