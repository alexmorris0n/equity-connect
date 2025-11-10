#!/bin/sh

set -e

if [ -z "$LIVEKIT_API_KEY" ] || [ -z "$LIVEKIT_API_SECRET" ]; then
  echo "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set"
  exit 1
fi

# Northflank provides REDIS_HOST and REDIS_PORT separately
# Combine them as host:port (no rediss:// scheme - TLS configured separately)
REDIS_ADDR="${REDIS_HOST}:${REDIS_PORT}"

cat <<EOF >/tmp/livekit.yaml
port: 7880
bind_addresses:
  - 0.0.0.0
keys:
  "${LIVEKIT_API_KEY}": "${LIVEKIT_API_SECRET}"
redis:
  address: "${REDIS_ADDR}"
  password: "${REDIS_PASSWORD}"
  tls:
    enabled: false
rtc:
  port_range_start: 50000
  port_range_end: 60000
  tcp_port: 7881
  use_external_ip: true
logging:
  level: info
EOF

# Log config
echo "Generated LiveKit config (YAML):"
cat /tmp/livekit.yaml
echo ""
echo "REDIS_MASTER_URL: ${REDIS_MASTER_URL}"

# Redis configured in YAML
/livekit-server --config /tmp/livekit.yaml
