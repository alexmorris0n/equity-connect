# Local Testing Guide for Agent System

## Overview

Testing the new agent system locally requires a LiveKit server. You have several options:

1. **LiveKit Cloud** (easiest - already configured)
2. **Local LiveKit Server** (Docker)
3. **Unit Tests** (test individual components)
4. **Mock Testing** (test agent logic without audio)

## Option 1: LiveKit Cloud (Recommended)

**Best for:** Quick testing with real audio

### Setup

1. **Environment Variables** (already configured):
   ```bash
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your_api_key
   LIVEKIT_API_SECRET=your_api_secret
   ```

2. **Run the Agent**:
   ```bash
   cd livekit-agent
   python agent.py
   ```

3. **Test via Phone Call**:
   - Make a call through SignalWire (routes to LiveKit)
   - Or use LiveKit's web interface to join a room
   - Agent will automatically join and start conversation

### Testing Scenarios

**Scenario A: New Caller**
- Call with a new phone number
- Should: greet → verify → qualify → answer/quote

**Scenario B: Verified Caller**
- Set `verified=True` in `conversation_state` for test phone
- Should: greet → qualify → answer/quote (skip verify)

**Scenario C: Verified + Qualified**
- Set both `verified=True` and `qualified=True`
- Should: greet → answer (skip verify + qualify)

## Option 2: Local LiveKit Server (Docker)

**Best for:** Testing without internet dependency

### Setup

1. **Install Docker** (if not already installed)

2. **Run LiveKit Server**:
   ```bash
   docker run -d \
     -p 7880:7880 \
     -p 7881:7881 \
     -p 7882:7882/udp \
     -e LIVEKIT_KEYS="devkey: devsecret" \
     livekit/livekit-server:latest \
     --dev
   ```

3. **Update Environment**:
   ```bash
   export LIVEKIT_URL=ws://localhost:7880
   export LIVEKIT_API_KEY=devkey
   export LIVEKIT_API_SECRET=devsecret
   ```

4. **Run Agent**:
   ```bash
   cd livekit-agent
   python agent.py
   ```

5. **Test via Web**:
   - Open http://localhost:7880
   - Create a room
   - Join with microphone
   - Agent will join automatically

## Option 3: Unit Tests (No LiveKit Server)

**Best for:** Testing individual components

### Run Existing Tests

```bash
cd livekit-agent

# Test conversation state
pytest tests/test_integration_conversation_state.py -v

# Test prompt loading
pytest tests/test_theme_loading.py -v

# Test without integration markers
pytest tests/ -v -m "not integration"
```

### Create Agent Import Test

Create a simple test to verify agents can be imported:

```bash
python -c "
import sys
sys.path.insert(0, '.')
from agents.greet import BarbaraGreetAgent
from agents.verify import BarbaraVerifyTask
from agents.qualify import BarbaraQualifyTask
from agents.answer import BarbaraAnswerAgent
print('✅ All agents imported successfully')
"
```

## Option 4: Mock Testing (Test Agent Logic)

**Best for:** Testing routing logic without audio

### Create Mock Test Script

Create `test_agent_routing.py`:

```python
"""Test agent routing logic without LiveKit server"""
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from agents.greet import BarbaraGreetAgent

async def test_greet_routing():
    """Test greet agent routes correctly based on database state"""
    
    # Mock database responses
    with patch('agents.greet.get_conversation_state') as mock_get_state:
        # Test 1: New caller (not verified, not qualified)
        mock_get_state.return_value = {
            'conversation_data': {
                'verified': False,
                'qualified': False
            }
        }
        
        agent = BarbaraGreetAgent(
            caller_phone="+15551234567",
            lead_data={"id": None, "first_name": "Test"},
            vertical="reverse_mortgage"
        )
        
        # Mock session
        agent.session = Mock()
        agent.session.chat_ctx = Mock()
        agent.session.chat_ctx.items = []
        
        # Test continue_to_verification tool
        from livekit.agents import RunContext
        context = RunContext()
        
        result = await agent.continue_to_verification(context)
        
        # Should return VerifyTask
        assert result.__class__.__name__ == "BarbaraVerifyTask"
        print("✅ Test 1 passed: New caller routes to verify")
        
        # Test 2: Verified but not qualified
        mock_get_state.return_value = {
            'conversation_data': {
                'verified': True,
                'qualified': False
            }
        }
        
        result = await agent.continue_to_verification(context)
        assert result.__class__.__name__ == "BarbaraQualifyTask"
        print("✅ Test 2 passed: Verified caller routes to qualify")
        
        # Test 3: Verified + Qualified
        mock_get_state.return_value = {
            'conversation_data': {
                'verified': True,
                'qualified': True
            }
        }
        
        result = await agent.continue_to_verification(context)
        assert result.__class__.__name__ == "BarbaraAnswerAgent"
        print("✅ Test 3 passed: Verified + qualified routes to answer")

if __name__ == "__main__":
    asyncio.run(test_greet_routing())
```

Run it:
```bash
cd livekit-agent
python test_agent_routing.py
```

## Option 5: LiveKit Dev Tools

**Best for:** Interactive testing with audio

### Using LiveKit Playground

1. **Install LiveKit CLI**:
   ```bash
   npm install -g livekit-cli
   ```

2. **Start Agent**:
   ```bash
   cd livekit-agent
   python agent.py
   ```

3. **Use LiveKit Playground**:
   - Open https://agents-playground.livekit.io
   - Connect to your LiveKit server
   - Create a room and join
   - Agent will automatically join

## Quick Test Checklist

### Pre-Testing Setup

- [ ] Environment variables set (`.env` file)
- [ ] Supabase connection working
- [ ] API keys configured (OpenAI, Deepgram, ElevenLabs, etc.)
- [ ] Database has test phone number configured
- [ ] Database has test lead with matching phone

### Basic Functionality Tests

- [ ] Agent starts without errors
- [ ] Can import all agent classes
- [ ] Database queries work (conversation_state)
- [ ] Prompt loading works (load_node_config)

### Routing Tests

- [ ] New caller → verify
- [ ] Verified caller → qualify
- [ ] Verified + qualified → answer
- [ ] Calculation question → quote
- [ ] Booking request → book
- [ ] Simple "yep" → stays in answer

## Troubleshooting

### "ModuleNotFoundError: No module named 'livekit.agents'"

**Solution:**
```bash
cd livekit-agent
pip install -r requirements.txt
```

### "Connection refused" or "Cannot connect to LiveKit"

**Check:**
- `LIVEKIT_URL` is correct
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are set
- LiveKit server is running (if local)
- Firewall allows connections

### "No active STT/LLM/TTS model found"

**Solution:**
- Check Supabase database
- Verify `livekit_available_stt_models` has `is_active=true` row
- Verify `livekit_available_llm_models` has `is_active=true` row
- Verify `livekit_available_voices` has `is_active=true` row

### Agent doesn't respond

**Check:**
- Agent joined the room (check logs)
- STT is working (check logs for transcription)
- LLM is responding (check logs for LLM calls)
- TTS is working (check logs for audio generation)

## Recommended Testing Flow

1. **Start with Unit Tests** (fastest):
   ```bash
   pytest tests/test_integration_conversation_state.py -v
   ```

2. **Test Agent Imports**:
   ```bash
   python -c "from agents.greet import BarbaraGreetAgent; print('✅ OK')"
   ```

3. **Test with LiveKit Cloud** (most realistic):
   - Run agent: `python agent.py`
   - Make test call
   - Check logs for routing

4. **Verify Database**:
   - Check `conversation_state` table
   - Verify flags are set correctly
   - Verify routing happened as expected

## Next Steps After Local Testing

1. Fix any issues found
2. Test all scenarios from `TESTING_GUIDE.md`
3. Deploy to staging
4. Monitor for 24 hours
5. Deploy to production

---

**Quick Start Command:**
```bash
cd livekit-agent
python agent.py
```

Then make a test call or join via LiveKit web interface.

