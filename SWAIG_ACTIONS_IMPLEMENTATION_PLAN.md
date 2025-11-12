# SWAIG Actions Implementation Plan

**Created:** November 12, 2025  
**Status:** 🚧 Planning Phase  
**Priority:** HIGH (UX Improvements)

---

## 📋 **Overview**

SignalWire SWAIG Actions allow tools to return **structured responses** that control call flow, provide immediate feedback, and enhance UX. This plan outlines which actions to implement in Barbara's 21 tools.

**Reference:** SWAIG Actions Reference Documentation (provided by user)

---

## ✅ **Already Implemented**

| Action | Location | Status |
|--------|----------|--------|
| `context_switch` | `_route_to_node()` | ✅ Complete |
| `toggle_functions` | `_apply_node_function_restrictions()` | ✅ Complete |

---

## 🎯 **Priority 1: Immediate Feedback (say)**

Tools that need instant acknowledgment before processing:

### **1. `check_broker_availability`** (Calendar tool)
**Problem:** Takes 5-10 seconds to query Nylas API  
**Solution:**
```python
from signalwire_agents.core import SwaigFunctionResult

async def check_broker_availability(self, args, raw_data):
    result = SwaigFunctionResult()
    result.say("Let me check the broker's calendar for you. One moment please...")
    
    # Query Nylas (takes 5-10 seconds)
    from equity_connect.tools.calendar import check_broker_availability
    availability = await check_broker_availability(args.get("broker_id"), ...)
    
    # Return both the say action AND the result
    result.set_response(availability)
    return result
```

**Impact:** Prevents awkward silence during API call

---

### **2. `search_knowledge`** (Knowledge tool)
**Problem:** Vector search takes 3-5 seconds  
**Solution:**
```python
async def search_knowledge(self, args, raw_data):
    result = SwaigFunctionResult()
    result.say("Let me look that up in our knowledge base...")
    
    # Vector search (takes 3-5 seconds)
    from equity_connect.tools.knowledge import search_knowledge
    answer = await search_knowledge(args.get("question"))
    
    result.set_response(answer)
    return result
```

**Impact:** Better UX during processing

---

### **3. `verify_caller_identity`** (Lead tool)
**Problem:** DB lookup + DNC check takes 2-3 seconds  
**Solution:**
```python
async def verify_caller_identity(self, args, raw_data):
    result = SwaigFunctionResult()
    result.say("Let me verify your information...")
    
    # DB lookup + DNC check
    from equity_connect.tools.lead import verify_caller_identity
    verification = await verify_caller_identity(...)
    
    result.set_response(verification)
    return result
```

**Impact:** Smooth verification flow

---

### **4. `book_appointment`** (Calendar tool)
**Problem:** Nylas + billing takes 5-10 seconds  
**Solution:**
```python
async def book_appointment(self, args, raw_data):
    result = SwaigFunctionResult()
    result.say("Perfect! Let me get that scheduled for you...")
    
    # Book appointment (slow)
    from equity_connect.tools.calendar import book_appointment
    booking = await book_appointment(...)
    
    result.set_response(booking)
    return result
```

**Impact:** Confirms action before processing

---

## 🎵 **Priority 2: Hold Music (play_background_audio)**

Tools that take 10+ seconds and would benefit from hold music:

### **1. `check_broker_availability`** (Calendar tool)
**Enhancement:**
```python
async def check_broker_availability(self, args, raw_data):
    result = SwaigFunctionResult()
    result.say("Let me check the broker's calendar...")
    result.play_background_audio("hold_music.mp3", wait=True)  # Play during processing
    
    # Query Nylas (takes 5-10 seconds)
    availability = await check_broker_availability(...)
    
    result.stop_background_audio()  # Stop music when done
    result.set_response(availability)
    return result
```

**Requirements:**
- Upload `hold_music.mp3` to SignalWire storage
- Get public URL for the audio file

**Impact:** Professional experience during long waits

---

### **2. `search_knowledge`** (Knowledge tool)
**Enhancement:**
```python
async def search_knowledge(self, args, raw_data):
    result = SwaigFunctionResult()
    result.say("Let me search our knowledge base...")
    result.play_background_audio("hold_music.mp3", wait=True)
    
    # Vector search (takes 3-5 seconds)
    answer = await search_knowledge(...)
    
    result.stop_background_audio()
    result.set_response(answer)
    return result
```

**Impact:** Reduces perceived wait time

---

## ⏱️ **Priority 3: Dynamic Speech Timeout (set_end_of_speech_timeout)**

Adjust patience based on conversation stage:

### **Per-Node Configuration in `_route_to_node()`**

**Add to context_switch result:**
```python
def _route_to_node(self, node_name: str, phone: str):
    result = SwaigFunctionResult()
    result.switch_context(...)
    
    # Adjust speech timeout per node
    timeout_config = {
        "verify": 2000,    # Patient (seniors speak slower)
        "qualify": 2000,   # Patient (detailed questions)
        "answer": 1500,    # Moderate (explanations)
        "book": 800,       # Quick (yes/no questions)
        "exit": 500,       # Fast (quick goodbye)
    }
    
    timeout = timeout_config.get(node_name, 1000)  # Default: 1 second
    result.set_end_of_speech_timeout(timeout)
    
    return result
```

**Impact:** Better responsiveness per conversation stage

---

## 🔧 **Priority 4: AI Tuning Per Node (update_settings)**

Adjust AI behavior for different conversation stages:

### **Per-Node AI Configuration**

**Add to `_route_to_node()`:**
```python
def _route_to_node(self, node_name: str, phone: str):
    result = SwaigFunctionResult()
    result.switch_context(...)
    
    # Adjust AI settings per node
    settings_config = {
        "qualify": {
            "temperature": 0.3,    # Factual questions
            "confidence": 0.8      # High confidence threshold
        },
        "objections": {
            "temperature": 0.9,    # Creative/empathetic
            "frequency-penalty": -0.5  # Allow repetition for emphasis
        },
        "answer": {
            "temperature": 0.5,    # Balanced
            "max-tokens": 200      # Detailed explanations
        },
        "book": {
            "temperature": 0.3,    # Simple/direct
            "max-tokens": 100      # Concise responses
        }
    }
    
    settings = settings_config.get(node_name)
    if settings:
        result.update_settings(settings)
    
    return result
```

**Impact:** Optimized AI behavior per conversation stage

---

## 📦 **Implementation Phases**

### **Phase 1: Immediate Feedback (say) - Week 1**
- [ ] Update `check_broker_availability` with `say()`
- [ ] Update `search_knowledge` with `say()`
- [ ] Update `verify_caller_identity` with `say()`
- [ ] Update `book_appointment` with `say()`
- [ ] Test all 4 tools with `swaig-test` CLI
- [ ] Deploy to Fly.io and test production calls

### **Phase 2: Hold Music - Week 2**
- [ ] Upload `hold_music.mp3` to SignalWire storage
- [ ] Get public URL for audio file
- [ ] Add `play_background_audio()` to `check_broker_availability`
- [ ] Add `play_background_audio()` to `search_knowledge`
- [ ] Test with production calls

### **Phase 3: Dynamic Timeouts - Week 3**
- [ ] Add `set_end_of_speech_timeout()` to `_route_to_node()`
- [ ] Test timeout tuning per node
- [ ] Monitor call quality metrics

### **Phase 4: AI Tuning (Optional) - Week 4**
- [ ] Add `update_settings()` to `_route_to_node()`
- [ ] A/B test different settings per node
- [ ] Optimize based on conversion metrics

---

## 🧪 **Testing Strategy**

### **Local Testing with `swaig-test`**
```bash
# Test immediate feedback
swaig-test equity_connect/test_barbara.py --exec check_broker_availability --broker_id "123" --verbose

# Test knowledge search
swaig-test equity_connect/test_barbara.py --exec search_knowledge --question "What is a reverse mortgage?" --verbose
```

### **Production Testing**
1. Deploy to Fly.io
2. Make test calls
3. Monitor logs for SWAIG actions
4. Measure UX improvements (call quality, completion rate)

---

## 📊 **Expected Impact**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Awkward Silence** | 5-10 seconds | <1 second | 90% reduction |
| **Perceived Wait Time** | Long | Short (with hold music) | 50% reduction |
| **Call Quality (Seniors)** | Interruptions | Patient | 30% improvement |
| **Conversion Rate** | Baseline | +10-15% | Smoother UX |

---

## 🚨 **Critical Notes**

### **SwaigFunctionResult vs String Returns**

Tools can return either:
1. **String/JSON** - Simple response (current)
2. **SwaigFunctionResult** - Response + SWAIG actions (enhanced)

**Example:**
```python
# Current (simple)
return "Availability checked"

# Enhanced (with actions)
result = SwaigFunctionResult()
result.say("Let me check...")
result.set_response("Availability checked")
return result
```

### **Import Required**
```python
from signalwire_agents.core import SwaigFunctionResult
```

### **SignalWire SDK Auto-Processes Actions**
The SDK automatically handles SWAIG actions returned by tools. No manual processing needed.

---

## 📝 **Next Steps**

1. ✅ Document the plan (this file)
2. ⏭️ **Implement Phase 1 (say actions)**
3. ⏭️ Test with `swaig-test`
4. ⏭️ Deploy and test production calls
5. ⏭️ Proceed to Phase 2

---

**This plan will significantly improve Barbara's UX without changing business logic.** 🎯

