FROM node:20-slim

WORKDIR /app

# Copy package files (working directory is already elevenlabs-webhook/)
COPY package.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY personalize.js ./
COPY tools.js ./
COPY nylas-helpers.js ./

# Expose port 3001 (personalization + tools on same port)
EXPOSE 3001

# Start personalize.js (has both webhook and tool routes)
CMD ["node", "personalize.js"]

