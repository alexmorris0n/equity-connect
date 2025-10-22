# PropertyRadar MCP Server

MCP (Model Context Protocol) server that exposes PropertyRadar list paging, property search, purchasing, and skip-trace tools for n8n's LangChain agent workflows. The server mirrors the approach used for `barbara-mcp`, but focuses on PropertyRadar API integrations and concurrent skip tracing.

## Features

- `get_list_items`: Walk a PropertyRadar list using Start/Limit paging, returning RadarIDs plus paging metadata for cursor management.
- `search_properties`: Run ad-hoc PropertyRadar criteria searches. Optional `purchase=true` flag unlocks records in the same call.
- `purchase_properties`: Purchase a set of RadarIDs to pull full property records (ownership, equity, loans, etc.).
- `batch_skip_trace`: Skip-trace multiple properties concurrently (one API call per property) with contact extraction (phones + emails) and batch statistics.
- `get_property_details`: Fetch property detail by RadarID with graceful purchase fallback.
- HTTP/SSE friendly Fastify server with `/health` and `/mcp` endpoints matching n8n MCP transport expectations.

## Prerequisites

- Node.js 20+
- PropertyRadar API key with list, property, and skip-trace access
- (Optional) n8n MCP client credentials for securing the service via bearer token

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
PROPERTYRADAR_API_KEY=your-api-key
PROPERTYRADAR_BASE_URL=https://api.propertyradar.com/v1
MAX_CONCURRENT_REQUESTS=20
HOST=0.0.0.0
PORT=3000
# MCP_BEARER_TOKEN=optional-shared-secret
```

`MAX_CONCURRENT_REQUESTS` caps skip-trace parallelism; per-call `max_concurrent` argument can further reduce it.

## Local Development

```bash
npm install
npm run dev
```

The server logs to stdout with pretty formatting. Health check: `GET http://localhost:3000/health`.

## MCP Endpoint

The server exposes a JSON-RPC MCP endpoint at `POST /mcp`.

- `initialize`: returns protocol version and available capabilities
- `tools/list`: lists all tool metadata
- `tools/call`: executes a tool by name with JSON arguments

### Tool Arguments Overview

#### `get_list_items`
```json
{
  "list_id": "1104847",
  "start": 0,
  "limit": 30
}
```

Response includes `items` array and `paging` object `{ start, returned, total, remaining, next_start }`.

#### `search_properties`
```json
{
  "criteria": [
    { "name": "InList", "value": "1104847" }
  ],
  "start": 0,
  "limit": 25,
  "purchase": false
}
```

Set `purchase` to `true` to append `?Purchase=1` and unlock results immediately.

#### `purchase_properties`
```json
{
  "radar_ids": ["P1234", "P5678"]
}
```

Purchases up to PropertyRadar's per-call limit (service usually accepts 30 IDs).

#### `batch_skip_trace`
```json
{
  "properties": [
    {
      "property_address": "123 Main St",
      "property_city": "Austin",
      "property_state": "TX",
      "property_zip": "78701",
      "firstname": "John",
      "lastname": "Doe"
    }
  ],
  "max_concurrent": 20
}
```

Each property executes as a separate API call. Successful entries include `contacts`, `phones`, `emails`, and `duration_ms`. Failed entries capture error messages. Batch stats provide success counts and latency metrics.

#### `get_property_details`
```json
{
  "radar_id": "P1234"
}
```

First attempts `GET /properties/{RadarID}`; falls back to purchase if necessary.

## Docker

Build and run container:

```bash
docker build -t propertyradar-mcp .
docker run -p 3000:3000 --env-file .env propertyradar-mcp
```

## Deploying to Northflank

1. Push this directory to a repository or upload via Northflank UI
2. Configure build using Node 20
3. Provide environment variables (`PROPERTYRADAR_API_KEY`, etc.) in project settings
4. Expose port 3000, map `/mcp` for n8n MCP clients

## n8n Integration

Example MCP client node configuration:

```json
{
  "type": "@n8n/n8n-nodes-langchain.mcpClientTool",
  "parameters": {
    "endpointUrl": "https://your-northflank-app.app/mcp",
    "serverTransport": "sse",
    "authentication": "headerAuth",
    "includeTools": [
      "get_list_items",
      "purchase_properties",
      "batch_skip_trace"
    ]
  },
  "credentials": {
    "httpHeaderAuth": {
      "name": "PropertyRadar MCP Token"
    }
  }
}
```

Combine with the existing Supabase MCP to filter RadarIDs before purchasing, as outlined in the n8n workflow instructions.

## Testing Checklist

1. `GET /health`
2. `POST /mcp` initialize & tools/list
3. `tools/call` `get_list_items` (small limit)
4. `tools/call` `search_properties` with simple criteria
5. `tools/call` `purchase_properties` for a known RadarID
6. `tools/call` `batch_skip_trace` with 1-2 properties (verify phones/emails)
7. Deploy container and re-test from n8n using SSE transport

## License

MIT © Equity Connect

