FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt ./

# Install SignalWire Agent SDK and dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and preserve package structure
# This creates /app/equity_connect/ with all modules
COPY . /app/equity_connect

EXPOSE 8080
# Run using module syntax to properly resolve imports
CMD ["python", "-m", "equity_connect.app"]


