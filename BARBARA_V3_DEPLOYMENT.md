# Barbara V3 - Git-Based Deployment Guide

**Date:** October 25, 2025  
**Status:** ✅ Production Ready

---

## 🚀 Quick Start

### **Automatic Deployment (Recommended)**

```bash
# 1. Make changes to Barbara
cd barbara-v3/src/tools/business
# ... edit files ...

# 2. Commit and push
git add .
git commit -m "Updated appointment booking logic"
git push origin main

# 3. Done! GitHub Actions auto-deploys to Fly.io
```

**That's it!** No manual `fly deploy`, no Docker cache issues.

---

## 🔧 One-Time Setup

### **Step 1: Add Fly.io API Token to GitHub**

1. Get your Fly.io API token:
```bash
fly auth token
```

2. Add to GitHub repo:
   - Go to: `https://github.com/YOUR_USERNAME/equity-connect/settings/secrets/actions`
   - Click: **New repository secret**
   - Name: `FLY_API_TOKEN`
   - Value: (paste the token from step 1)
   - Click: **Add secret**

### **Step 2: Verify Workflow File**

The workflow is already configured at:
```
.github/workflows/deploy-barbara.yml
```

It triggers on:
- Any push to `main` or `master` that touches `barbara-v3/**`
- Manual trigger via GitHub Actions UI

---

## 📋 Workflow Details

### **What Happens on Git Push:**

```yaml
Trigger: barbara-v3/** changes detected
    ↓
GitHub Actions starts
    ↓
Checkout code
    ↓
Setup Flyctl CLI
    ↓
cd barbara-v3
    ↓
fly deploy --remote-only --no-cache --build-arg CACHEBUST=$(date +%s)
    ↓
Fly.io builds fresh Docker image
    ↓
Deploy to 2 machines (zero-downtime)
    ↓
Verify deployment status
    ↓
✅ Done!
```

**Build time:** 30-45 seconds  
**Deployment time:** 5-10 seconds  
**Total:** ~1 minute from push to live

---

## 🛡️ Why This Prevents Docker Cache Issues

### **The Problem We Had:**

Old workflow:
```bash
cd barbara-v3
fly deploy
```

Result:
- ❌ Docker cached `COPY src` layer
- ❌ Deployed stale code 3x in a row
- ❌ Had to manually bust cache with version bumps
- ❌ Wasted 20 minutes debugging "phantom old code"

### **The Solution:**

New workflow:
```yaml
fly deploy --no-cache --build-arg CACHEBUST=$(date +%s)
```

Result:
- ✅ `--no-cache` disables layer caching
- ✅ `CACHEBUST` timestamp forces fresh rebuild
- ✅ Every deploy = fresh source code
- ✅ Git commit SHA is source of truth

---

## 🔍 Monitoring Deployments

### **View GitHub Actions:**
https://github.com/YOUR_USERNAME/equity-connect/actions

### **View Fly.io Dashboard:**
https://fly.io/apps/barbara-v3-voice/monitoring

### **Check Logs:**
```bash
fly logs --app barbara-v3-voice
```

### **Verify Deployment:**
```bash
fly status --app barbara-v3-voice
```

Should show:
```
Machines:
  7819704f123de8  started  (fresh deployment)
  d891265a016528  started  (fresh deployment)
```

---

## 🚨 Manual Deployment (Fallback)

If GitHub Actions is down or you need to deploy immediately:

```bash
cd barbara-v3
fly deploy --remote-only --no-cache --build-arg CACHEBUST=$(date +%s)
```

**Always include:**
- `--no-cache` (prevents stale Docker layers)
- `--build-arg CACHEBUST=$(date +%s)` (forces rebuild)

---

## 🔑 Environment Variables

All secrets are stored on Fly.io (not in Git):

```bash
# View all secrets
fly secrets list --app barbara-v3-voice

# Set a new secret
fly secrets set NEW_KEY=value --app barbara-v3-voice

# Set multiple secrets at once
fly secrets set \
  OPENAI_API_KEY=sk-... \
  SUPABASE_URL=https://... \
  --app barbara-v3-voice
```

**Secrets auto-restart the app** when changed.

---

## 📦 What Gets Deployed

### **Included in Docker image:**
- ✅ `src/**` (TypeScript source)
- ✅ `package.json` (dependencies)
- ✅ `tsconfig.json` (TypeScript config)
- ✅ `Dockerfile` (build instructions)

### **Excluded (via .gitignore):**
- ❌ `node_modules/` (rebuilt in Docker)
- ❌ `dist/` (compiled in Docker)
- ❌ `.env` (secrets are on Fly.io)
- ❌ `.git/` (not needed in container)

---

## 🔄 Rollback Procedure

If a deployment breaks:

### **Option 1: Git Revert (Recommended)**
```bash
# Revert the bad commit
git revert HEAD
git push origin main

# GitHub Actions auto-deploys the reverted code
```

### **Option 2: Manual Rollback**
```bash
# List recent deployments
fly releases --app barbara-v3-voice

# Rollback to previous version
fly releases rollback v{N-1} --app barbara-v3-voice
```

---

## 🧪 Testing Before Deployment

### **Local Build Test:**
```bash
cd barbara-v3
npm run build
```

If this passes, the Fly.io build will pass.

### **Local Runtime Test:**
```bash
# Copy production secrets to .env (temporarily)
fly secrets list --app barbara-v3-voice

# Create .env with secrets
# Edit barbara-v3/.env

# Start locally
npm start

# Test webhook endpoint
curl http://localhost:8080/health
```

---

## 📚 Related Documentation

- **Barbara V3 README:** `barbara-v3/README.md`
- **Master Production Plan:** `MASTER_PRODUCTION_PLAN.md`
- **Bridge V1 Guide:** `VOICE_BRIDGE_DEPLOYMENT.md`
- **Fly.io Guide:** `FLY_DEPLOYMENT_GUIDE.md`

---

## ✅ Deployment Checklist

Before pushing Barbara changes:

- [ ] Code compiles locally (`npm run build`)
- [ ] All Zod schemas use `.nullish()` (not `.optional()` alone)
- [ ] Environment variables documented in `env.example`
- [ ] README updated if adding new tools
- [ ] Commit message describes the change
- [ ] Push to `main` branch
- [ ] Monitor GitHub Actions for success
- [ ] Check Fly.io logs after deployment
- [ ] Test with a real call

---

**With this setup, deploying Barbara is as simple as `git push`. No more Docker cache nightmares!** 🎉

