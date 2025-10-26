#!/bin/bash

# Barbara Bridge Droplet Setup Script
# Run this on your new Ubuntu droplet

echo "🚀 Setting up Barbara Bridge System..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install system dependencies
echo "📦 Installing system dependencies..."
apt install -y git curl wget unzip build-essential

# Configure firewall
echo "🔥 Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow 22/tcp

# Allow HTTP for bridge server
ufw allow 3000/tcp

# Allow UDP ports for audio streaming (WebRTC range)
ufw allow 10000:20000/udp

# Allow STUN/TURN ports
ufw allow 3478/udp
ufw allow 5349/udp

# Allow additional common WebRTC ports
ufw allow 49152:65535/udp

# Enable firewall
ufw --force enable

echo "✅ Firewall configured with UDP ports open"

# Create application directory
mkdir -p /opt/barbara-bridge
cd /opt/barbara-bridge

# Install PM2 for process management
npm install -g pm2

# Create systemd service for PM2
pm2 startup systemd -u root --hp /root

echo "✅ System setup complete!"
echo ""
echo "Next steps:"
echo "1. Upload your bridge code to /opt/barbara-bridge"
echo "2. Install dependencies: npm install"
echo "3. Configure your environment variables"
echo "4. Start the bridge: pm2 start server.js"
echo ""
echo "Required environment variables:"
echo "- OPENAI_API_KEY"
echo "- SIGNALWIRE_PROJECT_ID"
echo "- SIGNALWIRE_TOKEN"
echo "- Any other API keys from your .env file"
