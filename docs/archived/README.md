# Archived VAPI Documentation

**Archived Date:** October 20, 2025  
**Reason:** Replaced by OpenAI Realtime + SignalWire Bridge system

---

## Archived Documentation Files

### VAPI Integration Guides (Deprecated)
- `VAPI_AI_VOICE_INTEGRATION.md` - Old VAPI setup and integration guide
- `VAPI_PRODUCTION_IMPLEMENTATION.md` - Old production deployment guide
- `reverse_mortgage_kb_section_6_VAPI_SCENARIOS.md` - VAPI-specific call scenarios

### Historical Records & Completed Tasks
- `DAILY_SUMMARY_OCT_18_2025.md` - Daily summary from October 18, 2025
- `PROPERTYRADAR_CLEANUP_SUMMARY.md` - Completed PropertyRadar workflow cleanup (Oct 11)
- `COMPLIANCE_CORRECTIONS.md` - Completed compliance documentation corrections (Oct 11)
- `SIGNALWIRE_API_VERIFICATION.md` - Completed API endpoint verification
- `VECTOR_STORE_TESTING.md` - Vector store setup testing guide (completed)
- `PHONE_NUMBER_APPOINTMENT_HOLDS.md` - Phone number appointment flow (partially implemented)

---

## Current Documentation

### Active Voice System Guides
- `/bridge/README.md` - OpenAI Realtime bridge deployment
- `/barbara-mcp/README.md` - Barbara MCP server for n8n
- `/docs/VOICE_BRIDGE_DEPLOYMENT.md` - Production deployment guide

### Active Prompts
- `/prompts/BarbaraInboundPrompt` - Inbound call prompt (422 lines)
- `/prompts/BarbaraVapiPrompt_V2_Realtime_Optimized` - Outbound prompt (133 lines)

### Architecture Reference
- `/docs/SIGNALWIRE_INTEGRATION_GUIDE.md` - SignalWire PSTN integration
- `/docs/SIGNALWIRE_PHONE_POOL_GUIDE.md` - Phone number management

---

## Why We Moved Away from VAPI

### Cost Savings
- **VAPI:** ~$2.40 per 8-minute call
- **Bridge:** ~$0.19 per 8-minute call
- **Savings:** 92% reduction

### Control & Flexibility
- Direct access to OpenAI Realtime API
- Custom tool integration with Supabase
- Full control over voice behavior and prompts
- No external platform dependencies

### Performance
- Lower latency (direct OpenAI connection)
- Better error handling and logging
- Seamless Supabase tool execution

---

## System Architecture

```
Caller → SignalWire Number → Bridge Server → OpenAI Realtime API
                                    ↓
                              Supabase Tools
                              (leads, appointments, KB)
```

**Bridge Endpoints:**
- Inbound: `GET /public/inbound-xml`
- Outbound: `POST /api/outbound-call`
- WebSocket: `ws://bridge/audiostream`

---

## Migration Completed

**Date:** October 2025  
**Status:** ✅ All production traffic on bridge system  
**VAPI Status:** Decommissioned

These archived docs are preserved for historical reference only.

