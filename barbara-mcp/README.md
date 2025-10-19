# Barbara MCP Server

A custom Model Context Protocol (MCP) server that exposes Barbara's outbound calling functionality as a tool for n8n's AI Agent. This replaces the VAPI MCP node with our SignalWire + OpenAI Realtime system.

## Features

- **Outbound Call Creation**: Create calls to leads using Barbara AI voice assistant
- **Lead Context Integration**: Automatically personalizes calls with lead information
- **Broker Assignment**: Uses lead's assigned broker or specified broker ID
- **SignalWire Integration**: Handles phone number normalization and call routing
- **Error Handling**: Graceful fallbacks and comprehensive error reporting

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
- `BRIDGE_URL`: Your bridge server URL (e.g., `https://bridge.northflank.app`)
- `BRIDGE_API_KEY`: Secure API key for bridge authentication

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
  "message": "✅ Call created successfully!",
  "call_id": "signalwire-call-sid",
  "internal_id": "call-timestamp-random",
  "from": "+15551234567",
  "to": "+16505300051"
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
  -e BRIDGE_URL=https://bridge.northflank.app \
  -e BRIDGE_API_KEY=your-secure-api-key \
  barbara-mcp
```

### Northflank

1. Create new service: "barbara-mcp"
2. Connect to GitHub repo or upload files
3. Set environment variables:
   - `BRIDGE_URL`: Your bridge server URL
   - `BRIDGE_API_KEY`: Secure API key
4. Port: 3000
5. Health check: `/health`

## Integration

### n8n Workflow

1. Remove existing VAPI MCP node
2. Add new "MCP Client Tool" node
3. Configure endpoint URL: `https://barbara-mcp.northflank.app/mcp`
4. Update AI Agent prompt to use `create_outbound_call` tool

### Bridge Server

The bridge server must have the following endpoints:
- `POST /api/outbound-call` - Creates SignalWire calls
- `GET /public/outbound-xml` - Serves LaML for outbound calls
- `POST /api/call-status` - Handles call status callbacks

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
