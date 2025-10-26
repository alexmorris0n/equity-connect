#!/bin/bash

# Barbara Bridge Deployment Script
# Run this from your local machine to deploy to the droplet

DROPLET_IP="YOUR_DROPLET_IP_HERE"
DROPLET_USER="root"

echo "🚀 Deploying Barbara Bridge to $DROPLET_IP..."

# Create deployment package
echo "📦 Creating deployment package..."
tar -czf barbara-bridge.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=*.log \
    --exclude=.env \
    bridge/ \
    config/ \
    database/ \
    docs/ \
    prompts/ \
    scripts/ \
    supabase/ \
    templates/ \
    workflows/ \
    package.json \
    README.MD

# Upload to droplet
echo "📤 Uploading to droplet..."
scp barbara-bridge.tar.gz $DROPLET_USER@$DROPLET_IP:/opt/barbara-bridge/

# Extract and setup on droplet
echo "🔧 Setting up on droplet..."
ssh $DROPLET_USER@$DROPLET_IP << 'EOF'
cd /opt/barbara-bridge
tar -xzf barbara-bridge.tar.gz
rm barbara-bridge.tar.gz

# Install dependencies
cd bridge
npm install

# Create environment file template
cat > .env << 'ENVEOF'
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# SignalWire Configuration  
SIGNALWIRE_PROJECT_ID=your_signalwire_project_id
SIGNALWIRE_TOKEN=your_signalwire_token
SIGNALWIRE_SPACE=your_signalwire_space

# Server Configuration
PORT=3000
NODE_ENV=production

# Add other environment variables as needed
ENVEOF

echo "✅ Deployment complete!"
echo "📝 Don't forget to edit /opt/barbara-bridge/bridge/.env with your actual API keys"
echo "🚀 Start the bridge with: pm2 start server.js"
EOF

# Clean up local files
rm barbara-bridge.tar.gz

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. SSH into your droplet: ssh root@$DROPLET_IP"
echo "2. Edit environment file: nano /opt/barbara-bridge/bridge/.env"
echo "3. Start the bridge: cd /opt/barbara-bridge/bridge && pm2 start server.js"
echo "4. Check status: pm2 status"
