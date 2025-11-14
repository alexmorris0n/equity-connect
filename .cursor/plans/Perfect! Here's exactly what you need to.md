Perfect! Here's exactly what you need to do:

# Deploy Bridge to Fly.io - 3 Steps

## Step 1: Create Fly App for Bridge

```bash
cd bridge
fly launch --no-deploy
```

**When prompted:**
- App name: `equity-connect-bridge` (or whatever you want)
- Region: Choose one close to you
- Postgres: **No**
- Redis: **No**

## Step 2: Set Environment Variables

```bash
fly secrets set SUPABASE_URL="your-supabase-url-here"
fly secrets set SUPABASE_KEY="your-supabase-anon-key-here"
```

(Use the same values from your current `.env` files)

## Step 3: Deploy Bridge

```bash
fly deploy
```

**After deploy completes:**
```bash
fly info
```

Look for the **Hostname** - it'll be something like: `equity-connect-bridge.fly.dev`

---

# Update Portal (Vercel)

Go to your Vercel project:

1. **Settings → Environment Variables**
2. **Add new variable:**
   - Name: `VITE_BRIDGE_URL`
   - Value: `https://equity-connect-bridge.fly.dev` (use YOUR hostname from above)
3. **Redeploy** your portal (Vercel → Deployments → click "Redeploy")

---

# Update 2 Files

## File 1: `bridge/server.js` (line ~62)

**Add your Vercel domain to CORS:**

```javascript
origin: [
  'https://your-portal-name.vercel.app',  // ← Add this (your actual Vercel URL)
  'http://localhost:3000',
  'http://localhost:5173'
]
```

Then redeploy bridge: `fly deploy`

## File 2: `portal/src/components/TestCliModal.vue` (line ~163)

**Change from:**
```typescript
const response = await fetch('http://localhost:8080/api/test-cli', {
```

**To:**
```typescript
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'http://localhost:8080';
const response = await fetch(`${BRIDGE_URL}/api/test-cli`, {
```

Then push to git (Vercel will auto-redeploy).

---

# Test It

1. Go to your deployed portal (vercel.app URL)
2. Prompt Management → Select vertical/node → Save → Test Node
3. Should work! 🎉

---

# If It Doesn't Work

**Check 3 things:**

1. **Bridge running?** → `fly status`
2. **CORS allows your Vercel domain?** → Check `bridge/server.js`
3. **Portal has bridge URL?** → Check Vercel env vars

That's it! Let me know if any step fails.