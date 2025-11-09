FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY config.py .
COPY agent.py .
COPY api_server.py .

# Copy services directory
COPY services/ ./services/

# Copy providers directory
COPY providers/ ./providers/

# Copy tools directory
COPY tools/ ./tools/

# Expose port for API server (if running separately)
EXPOSE 8080

# Default command: run the LiveKit agent
# The agent connects to LiveKit Cloud via environment variables
CMD ["python", "agent.py"]

