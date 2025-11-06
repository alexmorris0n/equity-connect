FROM node:20-slim

WORKDIR /app

# Build context is parent directory, so copy from elevenlabs-webhook/
COPY elevenlabs-webhook/package.json ./
COPY elevenlabs-webhook/package-lock.json ./

# Install dependencies
RUN npm ci --production

# Copy source code from elevenlabs-webhook/
COPY elevenlabs-webhook/personalize.js ./
COPY elevenlabs-webhook/tools.js ./

# Expose port 3001 (personalization + tools on same port)
EXPOSE 3001

# Start personalize.js (has both webhook and tool routes)
CMD ["node", "personalize.js"]

