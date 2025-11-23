# Barbara MCP - Dual Agent Support

**Updated:** November 23, 2025

The Barbara MCP now supports routing to **both** voice agents:
- **SWAIG** (SignalWire AI Gateway) - Pure SignalWire native agent
- **LiveKit** (LangGraph Multi-Agent) - Advanced conversation workflows

---

## 🎯 Configuration

### Environment Variables

```bash
# Existing variables (keep these)
BRIDGE_URL=https://bridge.northflank.app
BRIDGE_API_KEY=your-bridge-key

# SignalWire (for SWAIG agent)
SIGNALWIRE_PROJECT_ID=your-project-id
SIGNALWIRE_API_TOKEN=your-token
SIGNALWIRE_SPACE_URL=https://yourspace.signalwire.com
SIGNALWIRE_PHONE_NUMBER=+15559876543

# Agent URLs
SWAIG_AGENT_URL=https://barbara-swaig.fly.dev/agent/barbara
LIVEKIT_API_URL=https://barbara-livekit.fly.dev/api/outbound-call
LIVEKIT_API_KEY=your-livekit-api-key

# Routing Strategy (optional)
ROUTING_STRATEGY=round_robin
# Options: 'round_robin' (default), 'lead_based', 'swaig_only', 'livekit_only', 'weighted'

# Weighted routing (optional, only used if ROUTING_STRATEGY=weighted)
LIVEKIT_WEIGHT=0.5
# 0.5 = 50/50 split, 0.7 = 70% LiveKit / 30% SWAIG
```

---

## 📞 Usage from n8n

### Option 1: Let MCP Choose (Automatic Routing)

```json
POST https://barbara-mcp.your-url.com/mcp

{
  "method": "tools/call",
  "params": {
    "name": "create_outbound_call",
    "arguments": {
      "to_phone": "+15551234567",
      "lead_id": "lead-uuid-here",
      "broker_id": "broker-uuid-here",
      "agent": "auto"
    }
  }
}
```

### Option 2: Force SWAIG Agent

```json
{
  "method": "tools/call",
  "params": {
    "name": "create_outbound_call",
    "arguments": {
      "to_phone": "+15551234567",
      "lead_id": "lead-uuid-here",
      "agent": "swaig"
    }
  }
}
```

### Option 3: Force LiveKit Agent

```json
{
  "method": "tools/call",
  "params": {
    "name": "create_outbound_call",
    "arguments": {
      "to_phone": "+15551234567",
      "lead_id": "lead-uuid-here",
      "agent": "livekit"
    }
  }
}
```

---

## 🔀 Routing Strategies

### 1. Round Robin (Default)
Alternates between agents on each call:
- Call 1 → SWAIG
- Call 2 → LiveKit
- Call 3 → SWAIG
- Call 4 → LiveKit

**Config:**
```bash
ROUTING_STRATEGY=round_robin
```

### 2. Lead-Based
Consistent agent per lead (same lead always gets same agent):
- Uses hash of `lead_id`
- Ensures consistent experience per lead
- Good for A/B testing

**Config:**
```bash
ROUTING_STRATEGY=lead_based
```

### 3. Weighted Random
Probabilistic split (e.g., 70% LiveKit, 30% SWAIG):

**Config:**
```bash
ROUTING_STRATEGY=weighted
LIVEKIT_WEIGHT=0.7
```

### 4. Force Single Agent
Always use one agent:

**Config:**
```bash
ROUTING_STRATEGY=swaig_only
# OR
ROUTING_STRATEGY=livekit_only
```

---

## 🧪 A/B Testing Setup

### In n8n Workflow

**Scenario 1: Test by Campaign**
```javascript
// In n8n Code node
const agent = $json.campaign_type === 'warm' ? 'livekit' : 'swaig';

return {
  to_phone: $json.phone,
  lead_id: $json.lead_id,
  agent: agent
};
```

**Scenario 2: Test by Time of Day**
```javascript
const hour = new Date().getHours();
const agent = hour < 12 ? 'swaig' : 'livekit';  // Morning = SWAIG, Afternoon = LiveKit

return {
  to_phone: $json.phone,
  lead_id: $json.lead_id,
  agent: agent
};
```

**Scenario 3: Let MCP Handle (Database-Driven)**
```javascript
// MCP will consistently route based on lead_id
return {
  to_phone: $json.phone,
  lead_id: $json.lead_id,
  agent: 'auto'  // Uses ROUTING_STRATEGY env var
};
```

---

## 📊 Tracking Agent Usage

### In Supabase Interactions Table

Add a column to track which agent was used:

```sql
ALTER TABLE interactions ADD COLUMN agent_used TEXT;
CREATE INDEX idx_interactions_agent_used ON interactions(agent_used);
```

### In n8n - Log Agent Used

After MCP call, parse response and log:

```javascript
// Parse MCP response
const response = $json;
const agentUsed = response.result.content[0].text.includes('SWAIG') ? 'swaig' : 'livekit';

// Log to Supabase
INSERT INTO interactions (
  lead_id,
  type,
  agent_used,
  content,
  created_at
) VALUES (
  '{{ $json.lead_id }}',
  'outbound_call_initiated',
  '${agentUsed}',
  'Call initiated via ${agentUsed}',
  NOW()
);
```

### Analyze Results

```sql
-- Compare agent performance
SELECT 
  agent_used,
  COUNT(*) as total_calls,
  AVG(CASE WHEN outcome = 'positive' THEN 1 ELSE 0 END) * 100 as success_rate,
  AVG(duration_seconds) as avg_duration,
  SUM(CASE WHEN appointment_booked THEN 1 ELSE 0 END) as appointments_booked
FROM interactions
WHERE type = 'outbound_call_completed'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY agent_used;
```

---

## 🚀 How It Works

### SWAIG Path
```
n8n → MCP → SignalWire API → SWAIG Agent (/agent/barbara)
                                ↓
                          Conversation handled by
                          SignalWire AI Gateway
```

### LiveKit Path
```
n8n → MCP → LiveKit API (/api/outbound-call) → LiveKit Agent
                            ↓
                      SignalWire → LiveKit SIP → Agent
                            ↓
                      LangGraph workflows
```

---

## 📝 Response Format

Both agents return consistent response format:

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Outbound Call Created!\n\n🤖 Agent: SWAIG (SignalWire AI Gateway)\n📞 Call ID: CA123...\n📱 From: +15559876543\n📱 To: +15551234567\n👤 Lead ID: lead-uuid\n💬 Status: initiated"
      }
    ]
  }
}
```

---

## 🔧 Deployment

### Update Northflank/Fly.io

Add new environment variables to your deployment:

```bash
# Via Fly.io
fly secrets set \
  SWAIG_AGENT_URL=https://barbara-swaig.fly.dev/agent/barbara \
  LIVEKIT_API_URL=https://barbara-livekit.fly.dev/api/outbound-call \
  LIVEKIT_API_KEY=your-key \
  ROUTING_STRATEGY=round_robin

# Via Northflank
# Add via dashboard: Settings → Environment Variables
```

### Restart Service

```bash
fly deploy -a barbara-mcp
# OR
# Restart via Northflank dashboard
```

---

## ✅ Testing

### Test SWAIG
```bash
curl -X POST https://barbara-mcp.your-url.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+15551234567",
        "lead_id": "test-lead-123",
        "agent": "swaig"
      }
    }
  }'
```

### Test LiveKit
```bash
curl -X POST https://barbara-mcp.your-url.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+15551234567",
        "lead_id": "test-lead-123",
        "agent": "livekit"
      }
    }
  }'
```

### Test Auto-Routing
```bash
curl -X POST https://barbara-mcp.your-url.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+15551234567",
        "lead_id": "test-lead-123",
        "agent": "auto"
      }
    }
  }'
```

---

## 🐛 Troubleshooting

### Error: "SignalWire credentials not configured for SWAIG agent"
- Verify `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`, `SIGNALWIRE_SPACE_URL` are set
- Check `SWAIG_AGENT_URL` points to your deployed SWAIG agent

### Error: "LiveKit credentials not configured"
- Verify `LIVEKIT_API_URL` and `LIVEKIT_API_KEY` are set
- Test LiveKit API directly: `curl https://livekit-api-url/health`

### Calls Always Going to Same Agent
- Check `ROUTING_STRATEGY` env var
- Verify `agent` parameter in n8n is set to `"auto"` not hardcoded

### MCP Not Using Latest Code
- Restart the MCP service after deployment
- Check logs: `fly logs -a barbara-mcp` or Northflank logs

---

## 📚 Related Docs

- [SWAIG Agent Documentation](../swaig-agent/)
- [LiveKit Agent Documentation](../livekit-agent/)
- [n8n Integration Guide](./README.md)

---

**Questions?** Check logs with:
```bash
fly logs -a barbara-mcp --follow
```




