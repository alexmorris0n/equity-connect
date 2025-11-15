# Barbara Agent (SignalWire SDK) - Dockerfile

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY equity_connect/requirements.txt /app/requirements.txt

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

COPY equity_connect /app/equity_connect

ENV PORT=8080
EXPOSE 8080

CMD ["python", "-m", "equity_connect.app"]
