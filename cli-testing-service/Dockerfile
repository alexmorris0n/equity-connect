# CLI Testing Service - Dockerfile for Fly.io
# This service needs both Node.js and Python to execute swaig-test

FROM node:20-slim

# Install Python 3 and pip (required for swaig-test)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-venv \
      build-essential && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY cli-testing-service/package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Allow pip to install system-wide in Debian-based image
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Copy CLI testing service code
COPY cli-testing-service/ ./cli-testing-service/

# Copy Python agent code (needed for test_barbara.py)
COPY equity_connect/ ./equity_connect/

# Install Python dependencies for the agent
# Note: This assumes requirements.txt exists in equity_connect/
COPY equity_connect/requirements.txt ./equity_connect/requirements.txt
RUN pip3 install --no-cache-dir -r equity_connect/requirements.txt

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
CMD ["node", "cli-testing-service/server.js"]

