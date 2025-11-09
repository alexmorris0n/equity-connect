FROM docker.io/livekit/livekit-server:latest

WORKDIR /app

COPY deploy/livekit-core/start.sh /start.sh
RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]

