# OpenAI Realtime Voice Bridge - Dockerfile for Fly.io
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

# Copy package files (build context should be project root)
COPY package*.json ./

# Install node-pre-gyp globally first (needed by wrtc)
RUN npm install -g node-pre-gyp node-gyp

# Install dependencies
RUN npm install --production

# Copy bridge code (build context is project root, so bridge/ is relative to root)
COPY bridge/ ./bridge/

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

