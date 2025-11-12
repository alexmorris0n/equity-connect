"""Barbara Agent - SignalWire entry point"""
import logging
import os
from equity_connect.agent.barbara_agent import BarbaraAgent

# Configure logging
logging.basicConfig(
	level=os.getenv("LOG_LEVEL", "INFO"),
	format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
	logger.info("🚀 Starting Barbara agent on SignalWire SDK...")
	agent = BarbaraAgent()
	
	# SignalWire's agent.run() automatically:
	# - Sets up HTTP server on port 8080
	# - Handles /agent endpoint for SIP routing  
	# - Provides /healthz endpoint for Fly.io health checks
	# - Auto-detects environment (server/lambda/cloud function)
	agent.run()
