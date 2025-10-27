# OpenAI Realtime API Prompting Reference

This document compiles best practices from official OpenAI documentation for prompting the Realtime API.

**Sources:**
- https://platform.openai.com/docs/guides/realtime
- https://github.com/openai/openai-cookbook
- https://github.com/openai/openai-realtime-examples
- https://cookbook.openai.com/examples/gpt4o/introduction_to_realtime_api

---

## Core Principles

### 1. Ultra-Brief Responses
Voice conversations move fast. Keep responses under 200 characters per turn.

### 2. Interrupt-Friendly Design
The Realtime API uses server-side VAD (Voice Activity Detection). Design prompts expecting interruptions:
- "Stop talking IMMEDIATELY if the user starts speaking"
- "Resume naturally after they finish"

### 3. Numbers as Words
TTS engines perform better with written-out numbers:
- ✅ "sixty-two" not "62"
- ✅ "two hundred thousand" not "200k"
- ✅ "three PM" not "3 PM"

### 4. Tool Latency Management
When calling tools (database queries, API calls), fill the silence:
- "just a sec"
- "loading that up"
- "one moment"
- "pulling that up now"

### 5. Natural Conversational Flow
- Use micro-utterances for silence ("mm-hmm", "uh-huh", gentle breath)
- Mirror the caller's pace and energy
- One-breath confirmations vs long recaps
- Avoid robotic repetition

---

## Session Configuration

### Instructions Field
The Realtime API expects a single `instructions` string in the session update:

```javascript
{
  type: 'session.update',
  session: {
    instructions: "Your complete prompt here...",
    voice: 'alloy',
    modalities: ['audio', 'text'],
    turn_detection: { type: 'server_vad' },
    tools: [...] // Tool definitions
  }
}
```

**Key Points:**
- Instructions should be comprehensive but structured
- Use clear section headers for organization
- Include tool descriptions in natural language
- Context variables should be injected BEFORE sending to API

---

## Prompt Structure Best Practices

### Role Definition
- Be specific about who the AI is
- Define the domain and use case
- State what success looks like

**Example:**
"You are Sarah, a warm customer service agent for Acme Corp. Your goal is to resolve issues efficiently while maintaining a friendly, helpful tone."

### Personality & Tone
Critical for voice quality:
- Warmth level (warm, professional, friendly)
- Response length ("2-3 sentences per turn")
- Pacing ("speak naturally, don't rush")
- Language constraints ("English only")
- Variety ("don't repeat the same phrases")

### Behavioral Rules
Use clear, short bullets:
- "Stop talking if user interrupts"
- "Convert numbers to words"
- "Use fillers while tools run"
- "Mirror user's pace"

### Conversation Structure
Step-by-step flow with examples:
```
GREETING:
→ "Hi [name], how can I help you today?"

INFORMATION GATHERING:
→ Ask clarifying questions
→ Confirm understanding

RESOLUTION:
→ Provide solution
→ Confirm satisfaction
```

### Tool Usage
Include natural language descriptions:
```
- search_knowledge: Search our FAQ database for accurate answers. Use this for factual questions.
- book_appointment: Schedule a callback. Verify email before booking.
- save_interaction: Log conversation at the end. Always call this.
```

---

## Voice-Specific Considerations

### Senior-Friendly Design
For elderly callers (like reverse mortgage leads):
- Slower pacing
- Clearer pronunciation
- Patience with silence
- Gentle re-prompts
- Avoid rushing

### Phone Line Quality
- Expect background noise
- Handle "what?" or "can you repeat?"
- Speak clearly and naturally
- Use confirmation loops

---

## Common Patterns

### Pre-Qualification Path
"If all required data is known, skip redundant questions. Otherwise, ask ONLY for missing items."

### Re-Evaluation Loop
```
After each user response:
1. Mark which questions were just answered
2. Check what's still missing
3. Immediately ask the next question
4. When all complete, move to next section
```

### Error Handling
"If tool fails, acknowledge gracefully and offer alternatives. Never leave the user hanging."

### Escalation
"Transfer to human if: distressed caller, legal questions, complex situations, explicit request."

---

## Variable Injection

### Template Syntax
Use `{{variableName}}` in prompts:
- `{{leadFirstName}}` → "John"
- `{{brokerCompany}}` → "Equity Connect"

### Missing Variables
"If {{variableName}} is empty or unknown, treat it as missing and gently ask for it."

### Words Versions
For spoken numbers, always use the Words version:
- `{{estimatedEquityWords}}` not `{{estimatedEquity}}`
- `{{propertyValueWords}}` not `{{propertyValue}}`

---

## Section-by-Section Guide

### 1. Role & Objective
- Who is the AI?
- What's the scenario?
- What does success look like?
- 2-3 sentences max

### 2. Personality & Tone
- Interrupt handling rules
- Response length limits
- Conversational fillers
- Number formatting
- Tone qualities
- Pacing rules
- Bullet format for clarity

### 3. Context
- List all available {{variables}}
- Organized by category (Lead, Property, Broker)
- Explain what each contains
- Handle missing variables

### 4. Pronunciation
- Phonetic spellings
- Technical terms
- Brand names
- Number rules
- Simple bullet list

### 5. Tools
- List each tool with description
- When to use it
- Timing expectations
- Filler phrases while running
- Error handling

### 6. Instructions & Rules
- CRITICAL RULES header
- Numbered or bulleted list
- Edge cases
- Compliance requirements
- What NOT to do

### 7. Conversation Flow
- Step-by-step dialogue
- ALL CAPS section headers
- Arrows (→) for dialogue
- Tool usage inline
- Natural transitions

### 8. Output Format
- Response format specs
- Length constraints
- Formatting rules
- Brief and clear

### 9. Safety & Escalation
- Escalation triggers
- Disqualification protocols with scripts
- Compliance reminders
- Organized sections

---

## Anti-Patterns (Avoid These)

❌ Long paragraphs (use bullets)
❌ Saying numbers as digits
❌ Not handling interruptions
❌ Silent pauses during tool calls
❌ Repeating the same phrases
❌ Ignoring missing variables
❌ Unclear role definition
❌ No escalation guidance
❌ Unfilled {{variables}} sent to API

---

## Testing Checklist

After improving a prompt, verify:
- ✅ All {{variables}} are valid
- ✅ Numbers referenced as words
- ✅ Tools have descriptions
- ✅ Interrupt handling included
- ✅ Tool latency fillers present
- ✅ Escalation triggers defined
- ✅ Line breaks preserved
- ✅ Bullet formatting clear

---

**This reference should guide all AI improvements to follow OpenAI's Realtime API best practices.**

