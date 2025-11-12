"""Test entry point for swaig-test CLI

This file exists solely for local testing with the SignalWire swaig-test CLI tool.
It instantiates Barbara at the module level so swaig-test can discover her.

Usage:
    # List all 21 tools
    swaig-test equity_connect/test_barbara.py --list-tools
    
    # Test a tool
    swaig-test equity_connect/test_barbara.py --exec get_lead_context --phone "+15551234567"
    
    # Generate SWML
    swaig-test equity_connect/test_barbara.py --dump-swml
    
    # Test with verbose output
    swaig-test equity_connect/test_barbara.py --verbose --exec verify_caller_identity --phone "+15551234567" --name "John Doe"
"""
import logging
import os
from equity_connect.agent.barbara_agent import BarbaraAgent

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Instantiate Barbara at module level for swaig-test discovery
# This is the ONLY difference from app.py - no if __name__ check
agent = BarbaraAgent()

