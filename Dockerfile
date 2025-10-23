# OpenAI Realtime Voice Bridge - Dockerfile
# For deployment to Northflank

FROM node:20-slim

# Install dumb-init and build dependencies for native modules (wrtc)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      dumb-init \
      python3 \
      make \
      g++ \
      cmake && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install node-pre-gyp globally (needed by wrtc) and production deps
RUN npm install -g node-pre-gyp node-gyp && \
    npm install --omit=dev

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

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "bridge/server.js"]

