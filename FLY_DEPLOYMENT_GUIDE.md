# 🚀 Barbara Bridge on Fly.io - Super Simple Deployment

## Why Fly.io is Better
- ✅ **No SSH drama** - just deploy
- ✅ **Automatic scaling** - handles traffic spikes
- ✅ **Global edge** - fast worldwide
- ✅ **UDP support** - perfect for audio streaming
- ✅ **Zero config** - just push and go

## 🚀 Quick Deploy (5 minutes)

### 1. Install Fly CLI
```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Or download from: https://fly.io/docs/hands-on/install-flyctl/
```

### 2. Login to Fly.io
```bash
fly auth login
```

### 3. Create App
```bash
fly launch --no-deploy
```

### 4. Set Environment Variables
```bash
# Set your API keys
fly secrets set OPENAI_API_KEY="your_openai_key_here"
fly secrets set SIGNALWIRE_PROJECT_ID="your_project_id"
fly secrets set SIGNALWIRE_TOKEN="your_token"
fly secrets set SIGNALWIRE_SPACE="your_space"
```

### 5. Deploy
```bash
fly deploy
```

### 6. Check Status
```bash
fly status
fly logs
```

## 🔧 Configuration Files

### `fly.toml` - Fly.io configuration
- **UDP ports** for audio streaming (10000-20000, 3478, 5349, 49152-65535)
- **HTTP service** on port 3000
- **Health checks** for monitoring
- **Auto-scaling** configuration

### `Dockerfile.fly` - Container setup
- **Node.js 18** Alpine Linux
- **System dependencies** for audio processing
- **Security** with non-root user
- **Health checks** built-in

## 📊 Monitoring & Management

```bash
# View logs
fly logs

# Check status
fly status

# Scale up/down
fly scale count 2

# SSH into container (if needed)
fly ssh console

# View metrics
fly dashboard
```

## 🌍 Global Deployment

```bash
# Deploy to multiple regions
fly regions set sjc sea dfw ord lax

# Check performance
fly dashboard
```

## 🔥 Benefits Over Droplets

| Feature | DigitalOcean | Fly.io |
|---------|-------------|---------|
| Setup Time | 30+ minutes | 5 minutes |
| SSH Issues | Common | None |
| Firewall Config | Manual | Automatic |
| Scaling | Manual | Automatic |
| Global Edge | No | Yes |
| UDP Support | Manual config | Built-in |
| Monitoring | Basic | Advanced |

## 🚨 Troubleshooting

```bash
# Check app status
fly status

# View recent logs
fly logs --tail

# Restart app
fly apps restart

# Check health
curl https://your-app.fly.dev/health
```

## 💰 Cost Comparison
- **Fly.io**: ~$5-10/month for small apps
- **DigitalOcean**: ~$12/month + management time
- **Time saved**: Priceless! 😄

## 🎯 Next Steps
1. **Install Fly CLI**
2. **Run `fly launch`**
3. **Set your secrets**
4. **Deploy with `fly deploy`**
5. **Done!** 🎉

No more droplet drama - just push and go!
