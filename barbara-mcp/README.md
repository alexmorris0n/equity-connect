# Barbara MCP Server

A custom Model Context Protocol (MCP) server that exposes Barbara's outbound calling functionality as a tool for n8n's AI Agent. This uses ElevenLabs Conversational AI with SignalWire SIP trunk for high-quality voice calls.

## Features

- **Outbound Call Creation**: Create calls to leads using Barbara AI voice assistant via ElevenLabs
- **Dynamic Personalization**: Automatically injects lead/broker data into prompts using ElevenLabs dynamic variables
- **Lead Context Integration**: Automatically personalizes calls with lead information
- **Broker Assignment**: Uses lead's assigned broker or specified broker ID
- **SignalWire SIP Trunk**: Handles phone connectivity (same as inbound calls)
- **ElevenLabs Tools**: Calendar checking, appointment booking, knowledge base search
- **Error Handling**: Graceful fallbacks and comprehensive error reporting

## Prompt Selection Logic

The MCP server automatically determines the correct prompt variant based on lead qualification:

- **`outbound-qualified`**: For qualified leads (have property/equity data or marked qualified in DB)
- **`outbound-unqualified`**: For unqualified leads (no property data, cold outreach)

Qualification is determined by:
1. `qualified` field in lead record (if provided)
2. Presence of `property_value` or `estimated_equity` data

This is sent as a dynamic variable (`call_type`) to ElevenLabs, ensuring Barbara uses the appropriate tone and approach for each call.

## Quick Start

### 1. Install Dependencies

```bash
cd barbara-mcp
npm install
```

### 2. Configure Environment

Copy `env.example` to `.env` and update:

```bash
cp env.example .env
```

Required variables:
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key (e.g., `sk_...`)
- `ELEVENLABS_AGENT_ID`: Your ElevenLabs agent ID (e.g., `agent_...`)
- `ELEVENLABS_PHONE_NUMBER_ID`: Your ElevenLabs phone number ID (SignalWire SIP trunk)
- `BRIDGE_URL`: Your bridge server URL (for tools like calendar, knowledge base)
- `BRIDGE_API_KEY`: Secure API key for bridge authentication
- `NYLAS_API_KEY`: Nylas API key for calendar integration (optional)

### 3. Run Locally

```bash
npm start
```

The server will start on port 3000 with the following endpoints:
- `GET /health` - Health check
- `POST /mcp` - MCP protocol endpoint for n8n

### 4. Test with Cursor

Add to your Cursor MCP configuration:

```json
{
  "barbara": {
    "command": "node",
    "args": ["/absolute/path/to/barbara-mcp/index.js"],
    "env": {
      "BRIDGE_URL": "https://bridge.northflank.app",
      "BRIDGE_API_KEY": "your-secure-api-key-here"
    }
  }
}
```

Then test: `@barbara create_outbound_call to +16505300051 for lead <test-lead-id>`

## API Reference

### Tools

#### create_outbound_call

Creates an outbound call to a lead using Barbara AI voice assistant.

**Parameters:**
- `to_phone` (required): Phone number to call (will be normalized to E.164 format)
- `lead_id` (required): Lead ID from the database
- `broker_id` (optional): Broker ID (if not provided, will use lead's assigned broker)

**Response:**
```json
{
  "success": true,
  "message": "✅ Outbound Call Initiated Successfully!",
  "conversation_id": "conv_abc123...",
  "sip_call_id": "sip-call-id-xyz",
  "to_number": "+16505300051",
  "call_type": "Outbound Qualified"
}
```

### Endpoints

#### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### POST /mcp

MCP protocol endpoint for n8n integration.

**Request Body:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "create_outbound_call",
    "arguments": {
      "to_phone": "+16505300051",
      "lead_id": "lead-123",
      "broker_id": "broker-456"
    }
  }
}
```

## Deployment

### Docker

Build and run with Docker:

```bash
docker build -t barbara-mcp .
docker run -p 3000:3000 \
  -e ELEVENLABS_API_KEY=sk_your-api-key \
  -e ELEVENLABS_AGENT_ID=your-agent-id \
  -e ELEVENLABS_PHONE_NUMBER_ID=your-phone-number-id \
  -e BRIDGE_URL=https://bridge.northflank.app \
  -e BRIDGE_API_KEY=your-secure-api-key \
  -e NYLAS_API_KEY=your-nylas-api-key \
  barbara-mcp
```

### Northflank

1. Create new service: "barbara-mcp"
2. Connect to GitHub repo or upload files
3. Set environment variables:
   - `ELEVENLABS_API_KEY`: Your ElevenLabs API key
   - `ELEVENLABS_AGENT_ID`: Your ElevenLabs agent ID
   - `ELEVENLABS_PHONE_NUMBER_ID`: Your phone number ID (SignalWire SIP trunk)
   - `BRIDGE_URL`: Your bridge server URL
   - `BRIDGE_API_KEY`: Secure API key
   - `NYLAS_API_KEY`: Nylas API key (optional)
4. Port: 3000
5. Health check: `/health`

## Integration

### n8n Workflow

1. Remove existing VAPI MCP node
2. Add new "MCP Client Tool" node
3. Configure endpoint URL: `https://barbara-mcp.northflank.app/mcp`
4. Update AI Agent prompt to use `create_outbound_call` tool

### Bridge Server

The bridge server provides tool endpoints for ElevenLabs agent:
- `POST /api/tools/check_broker_availability` - Check calendar availability
- `POST /api/tools/book_appointment` - Book calendar appointments
- `POST /api/tools/cancel_appointment` - Cancel calendar appointments
- `POST /api/tools/reschedule_appointment` - Reschedule calendar appointments
- `POST /api/tools/update_lead_info` - Update lead information in Supabase

## Error Handling

The server includes comprehensive error handling:

- **Bridge API Errors**: Network failures, authentication issues
- **Tool Validation**: Missing required parameters, invalid formats
- **Graceful Fallbacks**: Returns structured error responses for AI parsing

All errors are logged with context for debugging.

## Development

### Local Development

```bash
npm run dev  # Watch mode with auto-restart
```

### Logging

The server uses structured logging with:
- Request/response logging
- Tool execution tracking
- Error context and stack traces
- Performance metrics

### Testing

Test the MCP server independently:

```bash
# Health check
curl http://localhost:3000/health

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'

# Create call
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_outbound_call",
      "arguments": {
        "to_phone": "+16505300051",
        "lead_id": "test-lead-id"
      }
    }
  }'
```

## Troubleshooting

### Common Issues

1. **Bridge API Connection Failed**
   - Check `BRIDGE_URL` and `BRIDGE_API_KEY` environment variables
   - Verify bridge server is running and accessible
   - Check network connectivity

2. **Tool Execution Errors**
   - Verify required parameters are provided
   - Check lead ID exists in database
   - Ensure phone number format is valid

3. **n8n Integration Issues**
   - Verify MCP endpoint URL is correct
   - Check authentication headers
   - Review n8n workflow logs

### Debug Mode

Enable debug logging by setting:

```bash
export LOG_LEVEL=debug
```

## License

MIT License - see LICENSE file for details.
