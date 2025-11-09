FROM python:3.11-slim

WORKDIR /app

# Install system packages
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
  && rm -rf /var/lib/apt/lists/*

# Build context is deploy/agent, copy from ../../livekit-agent
COPY ../../livekit-agent/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY ../../livekit-agent/config.py config.py
COPY ../../livekit-agent/agent.py agent.py
COPY ../../livekit-agent/api_server.py api_server.py
COPY ../../livekit-agent/services services
COPY ../../livekit-agent/providers providers
COPY ../../livekit-agent/tools tools

ENV PYTHONUNBUFFERED=1

CMD ["python", "agent.py", "start"]

