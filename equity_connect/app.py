import logging
from typing import Any

# Placeholder application entrypoint for the SignalWire agent runtime.
# This file wires the HTTP/SIP server once the SignalWire SDK is integrated.
#
# For now, we expose a lightweight health endpoint to satisfy Fly.io checks.

from http.server import BaseHTTPRequestHandler, HTTPServer
import os

logger = logging.getLogger(__name__)


class HealthHandler(BaseHTTPRequestHandler):
	def do_GET(self) -> None:  # type: ignore[override]
		if self.path == "/healthz":
			self.send_response(200)
			self.send_header("Content-Type", "text/plain")
			self.end_headers()
			self.wfile.write(b"ok")
			return
		if self.path.startswith("/agent"):
			self.send_response(200)
			self.send_header("Content-Type", "application/json")
			self.end_headers()
			self.wfile.write(b'{"status":"ready","message":"SignalWire agent endpoint placeholder"}')
			return
		self.send_response(404)
		self.end_headers()


def run_server() -> None:
	port = int(os.getenv("PORT", "8080"))
	server = HTTPServer(("0.0.0.0", port), HealthHandler)
	logger.info(f"Starting health server on :{port}")
	server.serve_forever()


if __name__ == "__main__":
	logging.basicConfig(level=logging.INFO)
	run_server()


