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
import json
from supabase import create_client, Client
from equity_connect.agent.barbara_agent import BarbaraAgent

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def get_prompt_version_from_db(version_id: str) -> dict:
    """
    Query Supabase for prompt version content.
    Used during CLI testing to load the draft/active version being tested.
    """
    supabase_url = os.environ.get('SUPABASE_URL')
    # Use SUPABASE_SERVICE_KEY to match backend infrastructure (bridge/server.js)
    supabase_key = os.environ.get('SUPABASE_SERVICE_KEY')
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment")
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Query prompt_versions table
    response = supabase.table('prompt_versions').select('*').eq('id', version_id).execute()
    
    if not response.data or len(response.data) == 0:
        raise ValueError(f"Prompt version not found: {version_id}")
    
    return response.data[0]

# Instantiate Barbara at module level for swaig-test discovery
# This is the ONLY difference from app.py - no if __name__ check
agent = BarbaraAgent()

