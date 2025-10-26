# Barbara Bridge Droplet Setup Guide

## 🚀 Quick Setup Steps

### 1. Create New DigitalOcean Droplet
- **OS**: Ubuntu 22.04 LTS
- **Size**: 2GB RAM minimum (4GB recommended)
- **Region**: Choose closest to your users
- **Add SSH Key**: For secure access

### 2. Initial Server Setup
```bash
# SSH into your new droplet
ssh root@YOUR_DROPLET_IP

# Run the setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/setup-barbara-bridge.sh | bash
```

### 3. Deploy Your Code
```bash
# From your local machine, edit the deploy script with your droplet IP
nano deploy-barbara-bridge.sh
# Change YOUR_DROPLET_IP_HERE to your actual IP

# Run deployment
chmod +x deploy-barbara-bridge.sh
./deploy-barbara-bridge.sh
```

### 4. Configure Environment
```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Edit environment file
nano /opt/barbara-bridge/bridge/.env
# Add your actual API keys:
# - OPENAI_API_KEY
# - SIGNALWIRE_PROJECT_ID  
# - SIGNALWIRE_TOKEN
# - SIGNALWIRE_SPACE
```

### 5. Start the Bridge
```bash
cd /opt/barbara-bridge/bridge
pm2 start server.js
pm2 save
pm2 startup
```

## 🔥 Firewall Configuration
The setup script automatically opens these ports:
- **22** (SSH)
- **3000** (HTTP Bridge Server)
- **10000-20000/udp** (Audio Streaming)
- **3478/udp** (STUN)
- **5349/udp** (TURN over TLS)
- **49152-65535/udp** (Additional WebRTC)

## 📊 Monitoring
```bash
# Check bridge status
pm2 status

# View logs
pm2 logs server

# Restart if needed
pm2 restart server
```

## 🔧 Troubleshooting
- **Port issues**: Check `ufw status` to verify ports are open
- **Audio problems**: Ensure UDP ports 10000-20000 are accessible
- **Connection issues**: Check SignalWire configuration
- **Performance**: Monitor with `htop` and `pm2 monit`

## 📁 Project Structure on Droplet
```
/opt/barbara-bridge/
├── bridge/           # Main bridge server
├── config/           # Configuration files
├── database/          # Database migrations
├── prompts/          # AI prompts
└── .env              # Environment variables
```

## 🚨 Important Notes
- **Backup your .env file** - it contains sensitive API keys
- **Monitor resource usage** - audio processing is CPU intensive
- **Keep dependencies updated** - run `npm update` regularly
- **Test UDP connectivity** - use online WebRTC testing tools
