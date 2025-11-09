# GitHub Actions CI/CD for Fly.io Deployment

This directory contains GitHub Actions workflows for automated deployment of the LiveKit voice agent stack to Fly.io.

## Workflows

### Individual Service Deployments

Each service has its own workflow that triggers on changes to specific paths:

- **`deploy-livekit-core.yml`** - LiveKit Core server
  - Triggers on: `deploy/livekit-core/**` changes
  
- **`deploy-livekit-sip.yml`** - LiveKit SIP bridge
  - Triggers on: `deploy/livekit-sip/**` changes
  
- **`deploy-agent.yml`** - Agent workers
  - Triggers on: `livekit-agent/**` or `deploy/agent/**` changes
  
- **`deploy-api.yml`** - API server
  - Triggers on: `livekit-agent/**` or `deploy/api/**` changes
  
- **`deploy-minio.yml`** - MinIO storage
  - Triggers on: `deploy/minio/**` changes

### Full Stack Deployment

- **`deploy-all.yml`** - Deploys all services in correct order
  - Triggers on: Any push to `main` branch
  - Deployment order:
    1. LiveKit Core
    2. LiveKit SIP + MinIO (parallel)
    3. Agent Workers
    4. API Server

## Setup

### 1. Create Fly.io API Token

```bash
# Generate a deploy token
fly tokens create deploy -x 999999h

# Copy the token (starts with "fly_...")
```

### 2. Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FLY_API_TOKEN`
5. Value: Paste your Fly.io token
6. Click **Add secret**

### 3. Test Deployment

Push to main or manually trigger a workflow:

```bash
# Commit and push changes
git add .
git commit -m "feat: update agent logic"
git push origin main

# Or manually trigger from GitHub UI:
# Actions tab → Select workflow → Run workflow
```

## Workflow Features

- ✅ **Automatic deployment** on push to `main`
- ✅ **Manual trigger** via `workflow_dispatch`
- ✅ **Path filtering** - only deploys changed services
- ✅ **Dependency ordering** - ensures services deploy in correct sequence
- ✅ **Remote builds** - uses Fly.io's remote builder (no local Docker needed)
- ✅ **No HA** - deploys single instances for cost efficiency

## Monitoring Deployments

### View in GitHub:
- Go to **Actions** tab
- Click on workflow run to see logs

### View in Fly.io:
```bash
# Watch deployment
fly status --app <app-name>

# View logs
fly logs --app <app-name>
```

## Deployment Order (for manual deployments)

If deploying manually, follow this order:

1. **Redis** (managed service, no deployment needed)
2. **LiveKit Core** - Core WebRTC server
3. **MinIO** + **LiveKit SIP** - Storage and SIP bridge (parallel)
4. **Agent Workers** - Connects to Core and MinIO
5. **API Server** - Depends on all services

## Secrets Required

These must be set via `fly secrets set` (not in GitHub):

### LiveKit Core:
```bash
fly secrets set \
  LIVEKIT_API_KEY=lk_prod_... \
  LIVEKIT_API_SECRET=... \
  -a equity-livekit-core
```

### LiveKit SIP:
```bash
fly secrets set \
  LIVEKIT_API_KEY=lk_prod_... \
  LIVEKIT_API_SECRET=... \
  REDIS_PASSWORD=... \
  -a equity-livekit-sip
```

### Agent Workers:
```bash
fly secrets set \
  LIVEKIT_API_KEY=... \
  LIVEKIT_API_SECRET=... \
  LIVEKIT_URL=... \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_KEY=... \
  OPENAI_API_KEY=... \
  OPENROUTER_API_KEY=... \
  EDENAI_API_KEY=... \
  AWS_ACCESS_KEY_ID=minioadmin \
  AWS_SECRET_ACCESS_KEY=minioadmin \
  -a equity-agent
```

### API Server:
```bash
fly secrets set \
  LIVEKIT_API_KEY=... \
  LIVEKIT_API_SECRET=... \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_KEY=... \
  SIGNALWIRE_PROJECT_ID=... \
  SIGNALWIRE_TOKEN=... \
  SIGNALWIRE_SPACE=... \
  AWS_ACCESS_KEY_ID=minioadmin \
  AWS_SECRET_ACCESS_KEY=minioadmin \
  -a equity-agent-api
```

## Troubleshooting

### Deployment fails with "not found":
- Verify the app exists: `fly apps list`
- Check the `fly.toml` app name matches

### Build context errors:
- Ensure `build_context` in `fly.toml` is correct
- Verify COPY paths in Dockerfile match build context

### Secret errors:
- List secrets: `fly secrets list --app <app-name>`
- Set missing secrets: `fly secrets set KEY=value --app <app-name>`

## Manual Deployment

If you need to deploy manually:

```bash
# Single service
cd deploy/<service>
fly deploy --ha=false

# Or from repo root
fly deploy --app <app-name> --config deploy/<service>/fly.toml --ha=false
```

## Rollback

If a deployment fails:

```bash
# List releases
fly releases --app <app-name>

# Rollback to previous version
fly releases rollback <version> --app <app-name>
```

