# OpenAI Realtime Voice Bridge - Dockerfile
# For deployment to Northflank

FROM node:20-alpine

# Install dumb-init and build dependencies for native modules (wrtc)
RUN apk add --no-cache \
    dumb-init \
    python3 \
    make \
    g++ \
    cmake

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install node-pre-gyp globally (needed by wrtc)
RUN npm install -g node-pre-gyp node-gyp

# Install production dependencies
RUN npm ci --omit=dev

# Remove build dependencies to reduce image size
RUN apk del python3 make g++ cmake

# Copy application code
COPY bridge/ ./bridge/
COPY prompts/ ./prompts/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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

