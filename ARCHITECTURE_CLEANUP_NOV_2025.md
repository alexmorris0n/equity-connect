# 🧹 Architecture Cleanup - November 10, 2025

## What Was Removed

### ❌ Self-Hosted Fly.io Infrastructure (Deprecated)

**Reason**: Migrated to LiveKit Cloud for reduced complexity and costs

**Deleted Files:**
- `Dockerfile.fly` - Old self-hosted Fly.io container
- `FLY_DEPLOYMENT_GUIDE.md` - Outdated deployment guide
- `FLY_GIT_DEPLOYMENT.md` - Outdated Git deployment guide
- `VOICE_BRIDGE_DEPLOYMENT.md` - Self-hosted bridge guide
- `WEBRTC_DEPLOYMENT_GUIDE.md` - Self-hosted WebRTC guide
- `WEBRTC_IMPLEMENTATION.md` - Self-hosted WebRTC implementation
- `deploy-barbara-bridge.sh` - Old bridge deployment script
- `setup-barbara-bridge.sh` - Old bridge setup script
- `livekit-agent/docs/SIGNALWIRE_SIP_SETUP.md` - Self-hosted SIP guide

**Deleted Directories:**
- `deploy/livekit-sip/` - Self-hosted SIP bridge
- `deploy/livekit-core/` - Self-hosted LiveKit core
- `deploy/api/` - Self-hosted API server
- `deploy/redis/` - Self-hosted Redis
- `deploy/minio/` - Self-hosted storage

### 📦 Archived (Not Deleted)

**Kept for Reference:**
- `bridge/` - Old OpenAI Realtime bridge (pre-LiveKit)
  - May be useful for future OpenAI Realtime integration
  - Contains PromptLayer integration code
- `self-hosted/` - Empty folder (safe to ignore)

---

## Current Architecture (Clean)

### ✅ Active Components

1. **LiveKit Cloud** (Managed)
   - SIP Bridge
   - Core/Rooms
   - Dispatch Rules

2. **Northflank** (Self-Hosted)
   - Agent Worker (`livekit-agent/`)
   - Dockerfile: `deploy/agent/Dockerfile`

3. **Fly.io** (Separate Services)
   - `barbara-v3/` - ElevenLabs webhook
   - `elevenlabs-webhook/` - Webhook handlers

4. **Supabase** (Database + Storage)
   - Postgres
   - Edge Functions
   - Storage

5. **Portal** (Admin Dashboard)
   - Vue.js frontend
   - Prompt management
   - Template editor

---

## New Documentation

**Primary Reference**: `CURRENT_ARCHITECTURE.md`

This document explains:
- Current architecture diagram
- Call flow (SignalWire → LiveKit Cloud → Northflank)
- Deployment process
- Monitoring and debugging
- Key differences from old architecture

---

## What's Next

1. **LiveKit Cloud Setup**
   - Create Cloud Agent: `inbound-agent`
   - Configure dispatch rules with `template_id` metadata
   - Test inbound calls

2. **Conversation Flow** (from plan)
   - Database migration: `conversation_state` table
   - LangGraph workflow: verify → qualify → answer → book → exit
   - Multi-call persistence
   - DB-driven routing

3. **Testing**
   - Inbound test call
   - Template loading verification
   - Conversation state tracking

---

## Cleanup Summary

- ✅ **15 files deleted** (old Fly.io self-hosted infrastructure)
- ✅ **5 directories removed** (livekit-sip, livekit-core, api, redis, minio)
- ✅ **1 new doc created** (`CURRENT_ARCHITECTURE.md`)
- ✅ **Clean foundation** for conversation flow development

**Result**: Codebase is now clean and focused on the current LiveKit Cloud architecture.

