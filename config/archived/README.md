# Archived VAPI Configuration Files

**Archived Date:** October 20, 2025  
**Reason:** Replaced by OpenAI Realtime + SignalWire Bridge system

---

## What Was Replaced

**Old System:** VAPI (third-party voice AI platform)
- Cost: ~$2.40 per 8-minute call
- Limited control over voice behavior
- External dependency

**New System:** Custom Bridge (`/bridge/`)
- **Bridge Server:** SignalWire PSTN ↔ OpenAI Realtime API
- **Barbara MCP:** Custom MCP server for n8n integration
- Cost: ~$0.19 per 8-minute call (92% reduction!)
- Full control over prompts and behavior
- Direct Supabase tool integration

---

## Archived Files

### VAPI Assistant Configs
- `BARBRA_BOT_V2.JSON` - Old VAPI assistant configuration
- `vapi_bot.json` - Old VAPI bot settings
- `gpt_barbara.json` - Legacy VAPI GPT configuration
- `VAPI_VARIABLE_VALUES_PRODUCTION.json` - Old variable system

### SignalWire + VAPI Integration (Deprecated)
- `signalwire-vapi-outbound-script.yaml` - SWML script for VAPI routing
- `signalwire-vapi-setup-commands.sh` - VAPI API setup commands
- `SIGNALWIRE_SETUP_COMPLETE.md` - SignalWire + VAPI setup guide

---

## Current Production System

### Active Components
1. **Bridge Server** (`/bridge/server.js`)
   - Handles inbound/outbound calls via SignalWire
   - Streams audio to OpenAI Realtime API
   - Executes Supabase tools (lead lookup, appointments, KB search)

2. **Barbara MCP** (`/barbara-mcp/index.js`)
   - Custom MCP server for n8n AI Agent
   - Replaces VAPI MCP integration
   - Creates outbound calls via bridge API

3. **Active Prompts**
   - `/prompts/BarbaraInboundPrompt` - Inbound call handling
   - `/prompts/BarbaraVapiPrompt_V2_Realtime_Optimized` - Outbound calls

### Documentation
- `/bridge/README.md` - Bridge deployment guide
- `/barbara-mcp/README.md` - MCP server guide
- `/docs/VOICE_BRIDGE_DEPLOYMENT.md` - Production deployment

---

## Migration Notes

**Completed:** October 2025  
**Migration Path:** VAPI → Custom Bridge  
**Status:** ✅ Production-ready, all VAPI references archived

---

## If You Need Old VAPI Configs

These files are preserved for reference but should **NOT** be used in production. The bridge system is the current standard.

