# Self‑Hosted LiveKit SIP Setup (SignalWire → LiveKit SIP → Agent)

This guide sets up a fully self‑hosted SIP bridge and core LiveKit server, plus our agent & API. No LiveKit Cloud required.

---

## Components
- livekit (core) – WebRTC signaling/data
- livekit-sip – SIP↔WebRTC bridge
- redis – shared state
- agent – our Python `livekit-agents` worker
- api – SWML/webhooks + recording URL

---

## Quick start (docker-compose)

1) Copy env and fill values:
```
cp self-hosted/env.example self-hosted/.env
```

2) Start stack:
```
cd self-hosted
docker compose --env-file ./.env up -d
```

3) Verify:
- LiveKit WS: `ws://<server>:7880`
- SIP listening: UDP/TCP 5060
- RTP: UDP 10000–20000 (open firewall/NAT to this host)
- API: `http://<server>:8080/health`

---

## SWML (SignalWire) → LiveKit SIP

Point your SignalWire number to:
```
GET https://<your-api-host>/api/swml-inbound?to={To}&from={From}
```

The endpoint returns a SWML script that connects to:
```
to:   sip:{E164_to}@${LIVEKIT_SIP_DOMAIN};transport=tcp
from: sip:{E164_from}@${LIVEKIT_SIP_DOMAIN};transport=tcp
```

Set `${LIVEKIT_SIP_DOMAIN}` to your public FQDN resolving to the host running livekit-sip.

---

## NAT / Firewall
- Open and forward:
  - 5060/udp (and optionally 5060/tcp) → livekit-sip
  - 10000–20000/udp → livekit-sip (RTP)
  - 7880/tcp → livekit (optional external access)
  - 8080/tcp → api (for SWML + recording URL)
- Set `PUBLIC_IP` in `self-hosted/env.example` so livekit-sip advertises correct IP in SDP.

---

## Environment variables (key ones)
- LIVEKIT_API_KEY / LIVEKIT_API_SECRET – used by both livekit and livekit-sip
- LIVEKIT_SIP_DOMAIN – FQDN for SIP bridge (e.g., `sip.example.com`)
- PUBLIC_IP – the server’s public IP (used by SIP for RTP)
- LIVEKIT_URL – internal WS URL for SIP→LiveKit (default `ws://livekit:7880`)
- SUPABASE_URL / SUPABASE_SERVICE_KEY – DB
- Provider keys – OpenAI/OpenRouter/EdenAI/Deepgram/ElevenLabs
- AWS_* – for recording signed URLs

See `self-hosted/env.example`.

---

## Notes
- The agent connects to `LIVEKIT_URL` and processes rooms (including SIP rooms).
- SWML endpoints already implemented in `api_server.py` – no Cloud dispatch rules needed.
- Use TCP transport in SWML if your provider prefers it: `;transport=tcp`
- For TLS/SRTP (secure trunking), consult `livekit-sip` docs to enable TLS ports and certificates.

---

## Troubleshooting
- No audio? Verify RTP ports and `PUBLIC_IP`.
- SIP INVITE failing? Check provider IP allowlist/firewall and that 5060/udp is reachable.
- Agent not joining? Confirm `LIVEKIT_URL`, API keys, and logs in the `agent` container.


