# OpenAI Realtime Voice Bridge - Dockerfile
# For deployment to DigitalOcean App Platform

FROM node:20-slim

# Install build dependencies for native modules (wrtc)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      cmake \
      git \
      build-essential && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm install --production=false

# Copy application code
COPY bridge/ ./bridge/
COPY prompts/ ./prompts/

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /usr/sbin/nologin --create-home nodejs

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Start application
CMD ["node", "bridge/server.js"]

