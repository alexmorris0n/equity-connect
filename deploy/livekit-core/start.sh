#!/bin/sh

set -e

if [ -z "$LIVEKIT_API_KEY" ] || [ -z "$LIVEKIT_API_SECRET" ]; then
  echo "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set"
  exit 1
fi

# Northflank provides REDIS_HOST (hostname) and REDIS_PORT separately
# LiveKit expects REDIS_HOST to include port, so we combine them
export REDIS_HOST="${REDIS_HOST}:${REDIS_PORT}"

cat <<EOF >/tmp/livekit.yaml
port: 7880
bind_addresses:
  - 0.0.0.0
keys:
  "${LIVEKIT_API_KEY}": "${LIVEKIT_API_SECRET}"
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
echo "REDIS_HOST (from Northflank): ${REDIS_HOST}"
echo "REDIS_PASSWORD (from Northflank): ${REDIS_PASSWORD}"

# LiveKit will automatically use $REDIS_HOST and $REDIS_PASSWORD env vars
/livekit-server --config /tmp/livekit.yaml
