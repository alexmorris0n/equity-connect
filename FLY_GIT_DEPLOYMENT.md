# 🚀 Deploy Barbara Bridge from Git - Super Simple!

## Option 1: Deploy from Your Git Repo (Recommended)

### 1. Install Fly CLI
```bash
# Windows PowerShell
iwr https://fly.io/install.ps1 -useb | iex
```

### 2. Login to Fly.io
```bash
fly auth login
```

### 3. Launch from Git (One Command!)
```bash
# Deploy directly from your git repo
fly launch --remote-only --no-deploy

# This will:
# - Create the app
# - Pull from your git repo
# - Set up the configuration
# - Ready to deploy
```

### 4. Set Your Environment Variables
```bash
fly secrets set OPENAI_API_KEY="your_openai_key_here"
fly secrets set SIGNALWIRE_PROJECT_ID="your_project_id"
fly secrets set SIGNALWIRE_TOKEN="your_token"
fly secrets set SIGNALWIRE_SPACE="your_space"
fly secrets set SUPABASE_URL="your_supabase_url"
fly secrets set SUPABASE_SERVICE_KEY="your_service_key"
```

### 5. Deploy!
```bash
fly deploy
```

## Option 2: Deploy from Local Directory

### 1. Make sure you're in your project directory
```bash
cd C:\Users\alex\OneDrive\Desktop\Cursor\equity-connect
```

### 2. Launch Fly app
```bash
fly launch --no-deploy
```

### 3. Set secrets and deploy
```bash
# Set your API keys
fly secrets set OPENAI_API_KEY="your_key"
fly secrets set SIGNALWIRE_PROJECT_ID="your_project_id"
fly secrets set SIGNALWIRE_TOKEN="your_token"
fly secrets set SIGNALWIRE_SPACE="your_space"

# Deploy
fly deploy
```

## 🎯 What Happens:

1. **Fly.io pulls your code** from git
2. **Builds the Docker container** using Dockerfile.fly
3. **Sets up UDP ports** for audio streaming
4. **Deploys globally** with edge network
5. **Auto-scales** based on traffic

## 🔧 Configuration Files:

- **`fly.toml`** - Fly.io configuration (UDP ports, scaling)
- **`Dockerfile.fly`** - Container setup (Node.js, dependencies)
- **Your existing code** - No changes needed!

## 📊 Benefits:

- ✅ **No file copying** - pulls from git
- ✅ **Automatic builds** - updates on every deploy
- ✅ **Version control** - track deployments
- ✅ **Rollback easy** - `fly releases` and `fly rollback`
- ✅ **Zero server management** - Fly.io handles everything

## 🚀 Super Simple Workflow:

```bash
# 1. Make changes to your code
git add .
git commit -m "Update bridge"
git push

# 2. Deploy to Fly.io
fly deploy

# 3. Done! 🎉
```

## 🔍 Monitoring:

```bash
# Check status
fly status

# View logs
fly logs

# Scale up if needed
fly scale count 2
```

**That's it!** No more droplet drama, no SSH issues, just git push and deploy! 🎉
