# CLI Testing Service

Complete standalone service for executing `swaig-test` CLI commands from the Portal UI to test Barbara prompt nodes.

## Overview

This service provides an HTTP API endpoint that:
- Accepts test requests from the Portal UI
- Spawns `swaig-test` Python CLI tool
- Executes tests against saved prompt versions in Supabase
- Returns SWML output and debug logs

## Architecture

```
Portal UI (Vercel)
    ↓ POST /api/test-cli { versionId, vertical, nodeName }
CLI Testing Service (Fly.io)
    ↓ spawn: swaig-test
    ↓ --user-vars { version_id, test_mode: true }
equity_connect/test_barbara.py
    ↓ Queries Supabase for version_id
    ↓ Loads prompt content from database
    ↓ Configures Barbara agent
    ↓ Generates SWML
    ↓ Returns: SWML JSON + verbose logs
CLI Testing Service captures output
    ↓ Returns to Portal
Portal displays results in modal
```

## Files

- `server.js` - Fastify HTTP server with `/api/test-cli` endpoint
- `test-cli.js` - Core logic for spawning and managing `swaig-test` processes
- `package.json` - Node.js dependencies
- `Dockerfile` - Container with Node.js + Python (for swaig-test)
- `fly.toml` - Fly.io deployment configuration

## Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `PORT` - HTTP port (default: 8080)
- `PORTAL_URL` - Portal Vercel URL (for CORS)

Optional:
- `NODE_ENV` - Environment (development/production)

## Local Development

```bash
# Install dependencies
cd cli-testing-service
npm install

# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key"
export PORTAL_URL="http://localhost:3000"

# Start server
npm start
```

## Deployment

### Fly.io

The service is automatically deployed via GitHub Actions when changes are pushed to `main`/`master` branch.

**Manual deployment:**
```bash
flyctl deploy --config cli-testing-service/fly.toml --dockerfile cli-testing-service/Dockerfile --app equity-connect-cli-testing
```

**Set secrets:**
```bash
flyctl secrets set SUPABASE_URL="..." -a equity-connect-cli-testing
flyctl secrets set SUPABASE_SERVICE_KEY="..." -a equity-connect-cli-testing
flyctl secrets set PORTAL_URL="https://your-portal.vercel.app" -a equity-connect-cli-testing
```

### Portal Configuration

Add to Vercel environment variables:
- `VITE_CLI_TESTING_URL` = `https://equity-connect-cli-testing.fly.dev`

## API Endpoints

### `GET /healthz`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "cli-testing-service",
  "timestamp": "2025-01-14T..."
}
```

### `POST /api/test-cli`
Execute CLI test for a prompt node.

**Request:**
```json
{
  "versionId": "uuid-here",
  "vertical": "reverse_mortgage",
  "nodeName": "greet"
}
```

**Response:**
```json
{
  "success": true,
  "output": "SWML JSON output...",
  "stderr": "Debug logs...",
  "exitCode": 0,
  "duration": 12345,
  "error": null
}
```

## Dependencies

- **Node.js 18+** - Runtime
- **Python 3.9+** - Required for `swaig-test` command
- **signalwire-agents** - Python package (installed in Docker image)
- **Fastify** - HTTP framework
- **@fastify/cors** - CORS middleware

## Notes

- This service is **separate from the deprecated `bridge/` folder**
- Tests always execute against **saved drafts** in Supabase (not live prompts)
- Test execution typically takes 10-45 seconds
- Timeout is set to 45 seconds to prevent hanging processes
- The service needs access to `equity_connect/test_barbara.py` and the Python agent code

