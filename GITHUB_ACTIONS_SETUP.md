# GitHub Actions Setup Guide

## Step 1: Add Fly.io Token to GitHub

### Your Fly.io Org-Level Deploy Token (works for ALL apps):
```
FlyV1 fm2_lJPECAAAAAAACqIJxBBo6gezJnHKU41afSjsuC5FwrVodHRwczovL2FwaS5mbHkuaW8vdjGUAJLOABQngR8Lk7lodHRwczovL2FwaS5mbHkuaW8vYWFhL3YxxDygCq+J1Iuuqy+sFVoepFpSo4FgYaQUpBcumLmrPAkrnlfJfmRlKLVR0fpchyKyl/F171VN9n13gruJJ63ETq/By2agFQ6+e0Er6txaXfReqc7tYvq34V4OI/lDtlrQCV6V/Z0RSEsRcUbytfcgVZb5laIaoUnnnPHvA3j67t/JXgDo7EEVb7UgOgzlDMQgfoGIcV/3l69Lf1npYcxbFxC1qZg0wH7Gsc5JiasMIak=,fm2_lJPETq/By2agFQ6+e0Er6txaXfReqc7tYvq34V4OI/lDtlrQCV6V/Z0RSEsRcUbytfcgVZb5laIaoUnnnPHvA3j67t/JXgDo7EEVb7UgOgzlDMQQ7EywRVBZ1/IpaGqlg/S+18O5aHR0cHM6Ly9hcGkuZmx5LmlvL2FhYS92MZgEks5pD/MGzo6n+SQXzgATXB4Kkc4AE1weDMQQpBtm7Ok2SOzVB2XRTCD9r8Qgv0loqv9Pwtey+QPzurkOplw+8KFK8Lq+z9iPn9ULoYQ=
```
**This single token deploys all 5 apps** (core, sip, agent, api, minio)

### Add to GitHub:

1. **Go to your repository on GitHub**
   - URL format: `https://github.com/YOUR_USERNAME/equity-connect`

2. **Navigate to Settings**
   - Click **Settings** (top right of repo)
   - Click **Secrets and variables** (left sidebar)
   - Click **Actions**

3. **Add the secret**
   - Click **"New repository secret"**
   - **Name**: `FLY_API_TOKEN`
   - **Value**: Paste the token above (entire thing starting with `FlyV1`)
   - Click **"Add secret"**

## Step 2: Commit and Push Workflows

```bash
git add .github/workflows/
git commit -m "ci: add GitHub Actions for automated Fly.io deployment"
git push origin main
```

## Step 3: Watch Deployment

After pushing, your workflows will automatically run:

1. Go to: `https://github.com/YOUR_USERNAME/equity-connect/actions`
2. You'll see the **"Deploy All Services"** workflow running
3. Click on it to watch the logs

## What Gets Deployed Automatically:

- ✅ **LiveKit Core** - When `deploy/livekit-core/**` changes
- ✅ **LiveKit SIP** - When `deploy/livekit-sip/**` changes
- ✅ **Agent Workers** - When `livekit-agent/**` changes
- ✅ **API Server** - When `livekit-agent/**` or `deploy/api/**` changes
- ✅ **MinIO** - When `deploy/minio/**` changes
- ✅ **All services** - When you push to `main` branch

## Manual Trigger

You can also manually trigger deployments:
1. Go to **Actions** tab
2. Select a workflow (e.g., "Deploy Agent Workers")
3. Click **"Run workflow"**
4. Select branch `main`
5. Click **"Run workflow"**

## Health Checks

The `health-check.yml` workflow runs every hour and verifies:
- API Server is responding (`/health` endpoint)
- LiveKit Core is reachable

If any service is down, the workflow will fail and you'll get a notification.

---

**That's it!** Once you add the `FLY_API_TOKEN` secret to GitHub, your entire stack will auto-deploy on every push. 🚀

