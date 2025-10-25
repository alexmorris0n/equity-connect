FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (use npm install since package-lock.json is gitignored)
RUN npm install --production=false

# Bust cache for source code
ARG CACHEBUST=1

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]

