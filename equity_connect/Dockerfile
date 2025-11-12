FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Copy the build context (which is already equity_connect/) directly to /app
COPY . /app

# Install dependencies for the agent runtime if a requirements.txt exists
RUN if [ -f "livekit-agent/requirements.txt" ]; then pip install --no-cache-dir -r livekit-agent/requirements.txt; fi
RUN if [ -f "requirements.txt" ]; then pip install --no-cache-dir -r requirements.txt; fi

EXPOSE 8080
CMD ["python", "app.py"]


