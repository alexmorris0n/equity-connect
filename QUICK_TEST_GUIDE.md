# Quick Testing Guide

## Current Status
✅ Migration applied successfully
⏳ Installing dependencies...
⏱️ Next: Start agent and connect via web

## Step 1: Start Agent (after install completes)
```bash
python livekit-agent\agent.py
```
Keep this terminal open to watch logs.

## Step 2: Connect via Web Browser

### Option A: LiveKit Playground (easiest)
1. Open: https://agents-playground.livekit.io
2. Get credentials from your `.env` file:
   - `LIVEKIT_URL` (wss://...)
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
3. Click "Connect"
4. Allow microphone
5. Start talking!

### Option B: Real Phone Call
- Call your SignalWire number
- Agent joins automatically

## What to Test

### Test 1: New Caller
- Say: "Hi, this is John"
- Should route: greet → verify → qualify → answer

### Test 2: Ask to Book
- Say: "I want to book an appointment"
- Should route directly to: book agent

### Test 3: Ask for Quote
- Say: "How much can I get?"
- Should route directly to: quote agent

### Test 4: Simple Acknowledgment
- Say: "Yep" or "Okay"
- Should NOT route (stay in current agent)

## Logs to Watch For

```
✅ BarbaraGreetAgent created
👂 USER STATE: idle -> listening
🗣️ User said: "your transcription"
🤔 AGENT STATE: listening -> thinking
🧠 LLM: Calling tool: continue_to_verification
🔄 Routing from greet to verify
💬 Agent: "response text"
```

## Troubleshooting

### No audio
- Check microphone permissions
- Refresh browser page
- Check agent logs for "STT started"

### Agent doesn't respond
- Check logs for errors
- Verify API keys in `.env`
- Check database has active STT/LLM/TTS models

### Wrong routing
- Check logs for tool calls
- Check database flags: verified, qualified
- Check conversation_state table

## Stop Testing
Press `Ctrl+C` in the terminal running the agent.

