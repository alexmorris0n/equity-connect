#!/usr/bin/env python3
"""Diagnose payload size issues - check what's being sent to SignalWire"""

import json
import sys

# Simulate what we're sending
def estimate_payload_size():
    """Estimate payload sizes for different components"""
    
    # 1. Global data (what we set in configure_per_call)
    global_data = {
        # NESTED structure
        "lead": {
            "id": "abc-123",
            "first_name": "Testy",
            "last_name": "Mctesterson",
            "name": "Testy Mctesterson",
            "phone": "+16505300051",
            "email": "test@example.com",
            "age": "65"
        },
        "broker": {
            "id": "broker-456",
            "full_name": "Walter Richards",
            "company": "My Reverse Mortgage",
            "phone": "+15551234567",
            "email": "walter@example.com",
            "nylas_grant_id": "grant-123",
            "timezone": "America/Los_Angeles"
        },
        "property": {
            "address": "123 Main St",
            "city": "Inglewood",
            "state": "CA",
            "zip": "90301",
            "value": "500000",
            "equity": "300000"
        },
        "status": {
            "qualified": True,
            "call_direction": "inbound",
            "quote_presented": False,
            "verified": False
        },
        # ALSO flat keys (DUPLICATE DATA!)
        "first_name": "Testy",
        "last_name": "Mctesterson",
        "full_name": "Testy Mctesterson",
        "lead_phone": "+16505300051",
        "lead_email": "test@example.com",
        "lead_age": "65",
        "lead_id": "abc-123",
        "broker_name": "Walter Richards",
        "broker_company": "My Reverse Mortgage",
        "broker_phone": "+15551234567",
        "broker_email": "walter@example.com",
        "property_address": "123 Main St",
        "property_city": "Inglewood",
        "property_state": "CA",
        "property_zip": "90301",
        "property_value": "500000",
        "estimated_equity": "300000",
        "conversation_data": {
            "verified": True,
            "qualified": True,
            "greeted": True,
            "quote_presented": False
        }
    }
    
    # 2. Conversation history (what SignalWire sends back)
    # After 10 turns, this could be large
    call_log = []
    for i in range(10):
        call_log.append({
            "role": "user" if i % 2 == 0 else "assistant",
            "content": "This is a sample conversation turn that might be quite long. " * 5,  # ~250 chars
            "latency_ms": 1200
        })
    
    raw_call_log = []
    for i in range(10):
        raw_call_log.append({
            "role": "user" if i % 2 == 0 else "assistant",
            "content": "This is a sample conversation turn that might be quite long. " * 5,
            "timestamp": "2025-01-20T10:00:00.000Z"
        })
    
    # 3. Context instructions (EXIT context with all our additions)
    # Let's estimate the size of our verbose EXIT context
    exit_instructions = """
# Exit Context

## Pre-Loaded Data
- Name: $first_name $last_name
- Broker: $broker_name (phone: $broker_phone)

**CRITICAL: All lead data is already pre-loaded. Do NOT call get_lead_context - it is unnecessary and will be disabled if called.**

## Exit Scenarios & Actions
[9 scenarios with detailed instructions - ~2000 chars]

## Questions Handling
[Detailed instructions - ~500 chars]

## After Tool Execution / Continuation
[Detailed instructions - ~800 chars]

## CRITICAL: Handling Questions - Use route_to_context Tool
[Detailed instructions - ~600 chars]

## CRITICAL: After route_to_context Tool Completes
[Detailed instructions - ~400 chars]

## CRITICAL: Call Disconnection Prevention
[4 scenarios with detailed instructions - ~1200 chars]

## Send FAQ and Follow Up
[Instructions - ~200 chars]

## Reschedule Intent Detection
[Instructions - ~300 chars]
"""
    
    # Calculate sizes
    global_data_size = len(json.dumps(global_data))
    call_log_size = len(json.dumps(call_log))
    raw_call_log_size = len(json.dumps(raw_call_log))
    instructions_size = len(exit_instructions)
    
    # Total payload estimate
    total_estimate = global_data_size + call_log_size + raw_call_log_size + instructions_size
    
    print("=" * 80)
    print("PAYLOAD SIZE DIAGNOSIS")
    print("=" * 80)
    print(f"\n1. Global Data: {global_data_size:,} bytes ({global_data_size/1024:.2f} KB)")
    print(f"   - Nested structure: ~{len(json.dumps(global_data['lead'])) + len(json.dumps(global_data['broker'])) + len(json.dumps(global_data['property'])) + len(json.dumps(global_data['status'])):,} bytes")
    print(f"   - Flat keys (DUPLICATE): ~{len(json.dumps({k: v for k, v in global_data.items() if k not in ['lead', 'broker', 'property', 'status', 'conversation_data']})):,} bytes")
    print(f"   - conversation_data: ~{len(json.dumps(global_data['conversation_data'])):,} bytes")
    
    print(f"\n2. Conversation History (10 turns):")
    print(f"   - call_log: {call_log_size:,} bytes ({call_log_size/1024:.2f} KB)")
    print(f"   - raw_call_log: {raw_call_log_size:,} bytes ({raw_call_log_size/1024:.2f} KB)")
    print(f"   - Total history: {call_log_size + raw_call_log_size:,} bytes ({(call_log_size + raw_call_log_size)/1024:.2f} KB)")
    
    print(f"\n3. Context Instructions (EXIT):")
    print(f"   - Size: {instructions_size:,} bytes ({instructions_size/1024:.2f} KB)")
    print(f"   - Note: This is just text, not JSON-encoded")
    
    print(f"\n4. TOTAL ESTIMATE: {total_estimate:,} bytes ({total_estimate/1024:.2f} KB)")
    print(f"   - SignalWire Limit: 64,000 bytes (64 KB)")
    print(f"   - Margin: {64*1024 - total_estimate:,} bytes ({((64*1024 - total_estimate)/1024):.2f} KB remaining)")
    
    if total_estimate > 64 * 1024:
        print(f"\n⚠️  WARNING: Estimated payload exceeds 64 KB limit!")
        print(f"   - Over by: {total_estimate - 64*1024:,} bytes ({(total_estimate - 64*1024)/1024:.2f} KB)")
    elif total_estimate > 50 * 1024:
        print(f"\n⚠️  WARNING: Estimated payload is close to 64 KB limit!")
        print(f"   - Only {(64*1024 - total_estimate)/1024:.2f} KB remaining")
    else:
        print(f"\n✅ Estimated payload is within safe limits")
    
    print("\n" + "=" * 80)
    print("RECOMMENDATIONS:")
    print("=" * 80)
    print("\n1. REMOVE duplicate flat keys from global_data")
    print("   - Keep only nested structure (lead, broker, property, status)")
    print("   - Prompt variables should be substituted in Python, not sent in global_data")
    print(f"   - Savings: ~{len(json.dumps({k: v for k, v in global_data.items() if k not in ['lead', 'broker', 'property', 'status', 'conversation_data']})):,} bytes")
    
    print("\n2. LIMIT conversation history")
    print("   - SignalWire sends full history - we can't control this")
    print("   - But we can minimize what we store in conversation_data")
    print("   - Only store essential flags, not full transcripts")
    
    print("\n3. SIMPLIFY context instructions")
    print("   - Remove verbose disconnection prevention section")
    print("   - Simplify step_criteria")
    print("   - Remove redundant instruction sections")
    print(f"   - Current EXIT instructions: ~{instructions_size:,} bytes")
    print(f"   - Target: < 2000 bytes (remove ~{instructions_size - 2000:,} bytes)")
    
    print("\n4. ADD payload size logging")
    print("   - Log size of global_data before set_global_data()")
    print("   - Log size of context instructions")
    print("   - Log total payload size in configure_per_call")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    estimate_payload_size()

