FROM python:3.10

WORKDIR /app

# Install system packages (ffmpeg needed for PyAV audio decoding)
# tini for proper subprocess/signal handling
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ffmpeg \
    tini \
    procps \
  && rm -rf /var/lib/apt/lists/*

# Ensure proper permissions for temp and cache directories (needed for subprocess creation)
RUN mkdir -p /tmp /root/.cache/huggingface && \
    chmod 1777 /tmp && \
    chmod -R 777 /root/.cache

# Copy from livekit-agent folder (build context is repo root /)
COPY livekit-agent/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY livekit-agent/config.py config.py
COPY livekit-agent/agent.py agent.py
COPY livekit-agent/api_server.py api_server.py
COPY livekit-agent/services services
COPY livekit-agent/providers providers
COPY livekit-agent/tools tools
COPY livekit-agent/workflows workflows
COPY livekit-agent/prompts prompts

# Set HuggingFace cache directory
ENV HF_HOME=/root/.cache/huggingface
ENV HF_HUB_CACHE=/root/.cache/huggingface/hub
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface

# Pre-download plugin assets using the LiveKit Agents CLI hook
RUN python agent.py download-files

# Download model weights for LiveKit turn detector to avoid first-boot download (belt & suspenders)
# 1) English model (v1.2.2-en)
# 2) Multilingual model (v1.2.2-multilingual)
# Using HF_HOME ensures files persist in the cache directory
RUN HF_HOME=/root/.cache/huggingface python -c "\
from huggingface_hub import hf_hub_download; \
from transformers import AutoTokenizer; \
hf_hub_download(repo_id='livekit/turn-detector', filename='model_q8.onnx', subfolder='onnx', revision='v1.2.2-en'); \
hf_hub_download(repo_id='livekit/turn-detector', filename='languages.json', revision='v1.2.2-en'); \
AutoTokenizer.from_pretrained('livekit/turn-detector', revision='v1.2.2-en'); \
print('✅ Turn detector model downloaded successfully'); \
"

ENV PYTHONUNBUFFERED=1

# Use tini as entrypoint for proper subprocess/signal handling (critical for inference executor)
ENTRYPOINT ["/usr/bin/tini", "--"]

# Run the agent
CMD ["python", "agent.py", "start"]

