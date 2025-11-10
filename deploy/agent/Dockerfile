FROM python:3.11-slim

WORKDIR /app

# Install system packages (ffmpeg needed for PyAV audio decoding)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# livekit-agent folder is copied into deploy/agent/ by GitHub Actions
COPY livekit-agent/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY livekit-agent/config.py config.py
COPY livekit-agent/agent.py agent.py
COPY livekit-agent/api_server.py api_server.py
COPY livekit-agent/services services
COPY livekit-agent/providers providers
COPY livekit-agent/tools tools

# Download model weights
# 1. Silero VAD (via agent.py download-files)
RUN python agent.py download-files

# 2. Turn detector - manual download from Hugging Face
# Downloads English model (v1.2.2-en) including ONNX weights, tokenizer, and languages.json
RUN python -c "\
from huggingface_hub import hf_hub_download; \
from transformers import AutoTokenizer; \
hf_hub_download(repo_id='livekit/turn-detector', filename='model_q8.onnx', subfolder='onnx', revision='v1.2.2-en'); \
hf_hub_download(repo_id='livekit/turn-detector', filename='languages.json', revision='v1.2.2-en'); \
AutoTokenizer.from_pretrained('livekit/turn-detector', revision='v1.2.2-en'); \
"

ENV PYTHONUNBUFFERED=1

CMD ["python", "agent.py", "start"]

