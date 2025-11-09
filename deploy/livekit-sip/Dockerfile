FROM docker.io/livekit/sip:latest

WORKDIR /sip

# Create entrypoint that generates config from env vars at runtime
COPY <<'EOF' /sip/entrypoint.sh
#!/bin/sh
set -e

echo "Generating LiveKit SIP config..."

cat > /sip/config.yaml <<YAML
log_level: ${LOG_LEVEL:-info}
api_key: ${LIVEKIT_API_KEY}
api_secret: ${LIVEKIT_API_SECRET}
ws_url: ${LIVEKIT_WS_URL}
redis:
  address: ${REDIS_ADDRESS}
  username: ${REDIS_USERNAME:-default}
  password: ${REDIS_PASSWORD}
  db: ${REDIS_DB:-0}
sip_port: ${SIP_PORT:-5060}
rtp_port: ${RTP_PORT_RANGE:-60000-61000}
YAML

echo "Config generated. Starting LiveKit SIP..."
echo "  ws_url: ${LIVEKIT_WS_URL}"
echo "  redis: ${REDIS_ADDRESS}"
echo "  redis_username: ${REDIS_USERNAME:-default}"
echo "  sip_port: ${SIP_PORT:-5060}"
echo "  rtp_port_range: ${RTP_PORT_RANGE:-60000-61000}"

exec livekit-sip --config=/sip/config.yaml
EOF

RUN chmod +x /sip/entrypoint.sh

# Override base image's entrypoint completely
ENTRYPOINT ["/sip/entrypoint.sh"]
CMD []
