# Prompt Formatting Guide

## How Line Breaks Work in the Prompt Editor

The prompt editor now **preserves line breaks and formatting** so you can structure your prompts clearly for both humans and GPT to read.

---

## Formatting Tips

### ✅ **Line Breaks**
- Press **Enter** to create a new line
- Line breaks are preserved exactly as you type them
- GPT reads them as natural paragraph breaks

**Example:**
```
You are Barbara, a friendly assistant.

Your goal is to help leads book appointments.
```

### ✅ **Bullet Points**
Use dashes or asterisks for bullet lists:

**Example:**
```
CRITICAL RULES:
- Stop talking immediately if caller starts
- Keep responses under 200 characters
- Convert all numbers to words
- Use conversational fillers while tools run
```

### ✅ **Numbered Lists**
Just type numbers naturally:

**Example:**
```
1. Verify broker identity first
2. Retrieve schedule for requested date
3. Offer to reschedule if needed
```

### ✅ **Sections with Headers**
Use ALL CAPS or title case for headers:

**Example:**
```
GREETING & VERIFICATION:
→ "Equity Connect, this is Barbara. How can I help you?"
→ verify_broker_identity (filler: "Just confirming...")

APPOINTMENT LOOKUP:
→ "Which appointment are you connecting for?"
```

### ✅ **Conversation Flow Arrows**
Use `→` for conversation steps:

**Example:**
```
→ "Hi {{leadFirstName}}, how are you today?"
→ If they ask about pricing: search_knowledge
→ Respond in ≤2 sentences
```

---

## How GPT Reads It

When you save a prompt with line breaks:
- **In the database**: Stored as raw text with `\n` newline characters
- **In the UI**: Rendered with proper line spacing using `<br>` tags
- **For GPT**: Sent as plain text with newlines preserved

This means GPT can:
- ✅ Distinguish between different sections
- ✅ Read bullet points as separate items
- ✅ Follow step-by-step flows easily
- ✅ Understand hierarchical structure

---

## Best Practices

1. **Use blank lines** to separate major sections
2. **Use bullets** (`-`) for lists of rules or features
3. **Use arrows** (`→`) for conversation flow steps
4. **Use ALL CAPS** for section headers
5. **Keep it readable** - if you can scan it quickly, so can GPT

---

## Example: Well-Formatted Prompt Section

```
CONVERSATION FLOW:

OPENING & PURPOSE:
→ "Equity Connect, this is Barbara. How are you today?"
→ "What brought you to call today?"
→ Brief empathy: "Got it—that helps."

QUALIFICATION GATE:
Use internal 4-point checklist:

1) AGE: "Are you over sixty-two?"
2) PRIMARY RESIDENCE: "Do you live in the home full-time?"
3) MORTGAGE: "Is it paid off or still have a mortgage?"
4) HOME VALUE: "About how much do you think it's worth?"

After each response:
- Mark answered items
- Check missing items
- Ask next question immediately
```

This structure is:
- ✅ Easy for humans to read and edit
- ✅ Clear for GPT to parse and follow
- ✅ Properly preserved in the database

