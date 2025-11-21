"""
Backend integration for automatic step_criteria generation.

This module provides the core logic to be integrated into your FastAPI/Flask backend.
It handles:
1. Smart detection of changed nodes
2. Automatic generation of SW and LK criteria
3. Fallback handling
4. Report generation for frontend

Usage in your API endpoint:
    from database.scripts.backend_integration import StepCriteriaGenerator
    
    generator = StepCriteriaGenerator(openai_api_key)
    result = await generator.process_vertical_save(nodes_data, vertical)
    
    return {
        "success": True,
        "generation_report": result
    }
"""

import os
import sys
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

# Add scripts to path
sys.path.insert(0, os.path.dirname(__file__))

from model_selector import ModelSelector

logger = logging.getLogger(__name__)


@dataclass
class NodeData:
    """
    Represents a single node from the frontend.
    
    Attributes:
        node_name: Name of the node (e.g., 'greet', 'verify')
        step_criteria_source: Natural language criteria (from Vue)
        step_criteria_sw: SignalWire criteria (auto-generated, may be None)
        step_criteria_lk: LiveKit criteria (auto-generated, may be None)
    """
    node_name: str
    step_criteria_source: Optional[str] = None
    step_criteria_sw: Optional[str] = None
    step_criteria_lk: Optional[str] = None


class StepCriteriaGenerator:
    """
    Handles step_criteria generation during vertical save.
    
    Features:
    - Smart change detection (only regenerate if source changed)
    - Automatic fallback handling
    - Detailed reporting for frontend
    - Cost tracking
    """
    
    def __init__(self, openai_client, supabase_client=None):
        """
        Initialize generator.
        
        Args:
            openai_client: Initialized OpenAI client
            supabase_client: Optional Supabase client for DB lookups
        """
        self.openai_client = openai_client
        self.supabase = supabase_client
        self.selector = ModelSelector(openai_client)
    
    async def process_vertical_save(
        self,
        nodes: List[Dict[str, Any]],
        vertical: str = "reverse_mortgage"
    ) -> Dict[str, Any]:
        """
        Process nodes during vertical save.
        
        This is the main entry point for your API endpoint.
        
        Args:
            nodes: List of node data from frontend
            vertical: Vertical name (for DB lookups)
        
        Returns:
            Dict containing generation report for frontend modal
        """
        report_nodes = []
        nodes_processed = 0
        
        for node_data in nodes:
            node_name = node_data.get('node_name')
            source = node_data.get('step_criteria_source')
            
            # Skip if no source provided
            if not source or not source.strip():
                continue
            
            # Check if source changed
            should_regenerate = await self._should_regenerate(
                node_name,
                source,
                vertical
            )
            
            if not should_regenerate:
                logger.debug(f"Skipping {node_name} - no changes detected")
                continue
            
            # Generate criteria
            try:
                result = self.selector.generate_with_fallback(node_name, source)
                
                # Update node data with generated criteria
                node_data['step_criteria_sw'] = result['sw']
                node_data['step_criteria_lk'] = result['lk']
                
                # Build report entry
                has_warning = (
                    result['sw_method'] == 'manual' or 
                    result['lk_method'] == 'manual' or
                    result['lk_method'] == 'full'
                )
                
                warning_msg = self._build_warning_message(result)
                
                report_nodes.append({
                    'node_name': node_name,
                    'sw_method': result['sw_method'],
                    'lk_method': result['lk_method'],
                    'has_warning': has_warning,
                    'warning_message': warning_msg
                })
                
                nodes_processed += 1
                
            except Exception as e:
                logger.error(f"Generation failed for {node_name}: {e}", exc_info=True)
                
                # Use manual fallbacks
                from prompts.fallbacks import get_signalwire_fallback, get_livekit_fallback
                node_data['step_criteria_sw'] = get_signalwire_fallback(node_name)
                node_data['step_criteria_lk'] = get_livekit_fallback(node_name)
                
                report_nodes.append({
                    'node_name': node_name,
                    'sw_method': 'manual',
                    'lk_method': 'manual',
                    'has_warning': True,
                    'warning_message': f'Generation error: {str(e)}'
                })
                
                nodes_processed += 1
        
        # Build final report
        stats = self.selector.stats
        return {
            'nodes': report_nodes,
            'stats': {
                'total_processed': nodes_processed,
                'mini_success': stats['mini_success'],
                'full_used': stats['full_success'],
                'manual_used': stats['manual_used'],
                'cost_estimate': self._estimate_cost(stats)
            }
        }
    
    async def _should_regenerate(
        self,
        node_name: str,
        new_source: str,
        vertical: str
    ) -> bool:
        """
        Check if criteria should be regenerated.
        
        Compares new source against existing DB value.
        
        Args:
            node_name: Name of the node
            new_source: New step_criteria_source from frontend
            vertical: Vertical name
        
        Returns:
            True if should regenerate, False otherwise
        """
        # If no Supabase client, always regenerate (safe default)
        if not self.supabase:
            logger.debug(f"No Supabase client - regenerating {node_name}")
            return True
        
        try:
            # Fetch existing criteria from database
            result = (
                self.supabase
                .table('prompt_versions')
                .select('content')
                .eq('is_active', True)
                .execute()
            )
            
            if not result.data:
                logger.debug(f"No existing data for {node_name} - regenerating")
                return True
            
            # Find matching node
            for row in result.data:
                content = row.get('content', {})
                if content.get('node_name') == node_name:
                    existing_source = content.get('step_criteria_source', '')
                    
                    # Compare sources
                    if existing_source.strip() == new_source.strip():
                        logger.debug(f"{node_name} unchanged - skipping")
                        return False
                    else:
                        logger.debug(f"{node_name} changed - regenerating")
                        return True
            
            # Node not found in DB, regenerate
            logger.debug(f"{node_name} not found in DB - regenerating")
            return True
        
        except Exception as e:
            logger.error(f"Error checking {node_name}: {e}")
            # On error, regenerate (safe default)
            return True
    
    def _build_warning_message(self, result: Dict[str, Any]) -> Optional[str]:
        """
        Build user-friendly warning message from generation result.
        
        Args:
            result: Result dict from ModelSelector.generate_with_fallback()
        
        Returns:
            Warning message string, or None if no warning
        """
        sw_method = result['sw_method']
        lk_method = result['lk_method']
        
        warnings = []
        
        # Check SignalWire
        if sw_method == 'manual':
            warnings.append("SignalWire: Using manual fallback (generation failed)")
        elif sw_method == 'full':
            warnings.append("SignalWire: Required GPT-4o (complex input)")
        
        # Check LiveKit
        if lk_method == 'manual':
            warnings.append("LiveKit: Using manual fallback (generation failed)")
        elif lk_method == 'full':
            warnings.append("LiveKit: Required GPT-4o for validation")
        
        if not warnings:
            return None
        
        return " | ".join(warnings)
    
    def _estimate_cost(self, stats: Dict[str, int]) -> str:
        """
        Estimate API cost based on generation stats.
        
        Rough estimates:
        - GPT-4o-mini: ~$0.0001 per conversion
        - GPT-4o: ~$0.001 per conversion
        
        Args:
            stats: Statistics from ModelSelector
        
        Returns:
            Formatted cost string (e.g., "$0.004")
        """
        mini_cost = stats['mini_success'] * 0.0001
        full_cost = stats['full_success'] * 0.001
        total = mini_cost + full_cost
        
        if total < 0.001:
            return "<$0.001"
        else:
            return f"${total:.4f}"


# ============================================================================
# Example FastAPI Integration
# ============================================================================

"""
# In your FastAPI app (e.g., api/routes/verticals.py)

from fastapi import APIRouter, Depends
from openai import OpenAI
from database.scripts.backend_integration import StepCriteriaGenerator

router = APIRouter()

def get_openai_client():
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_supabase_client():
    from supabase import create_client
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY")
    )

@router.post("/api/verticals/{vertical}")
async def save_vertical(
    vertical: str,
    data: dict,
    openai_client: OpenAI = Depends(get_openai_client),
    supabase_client = Depends(get_supabase_client)
):
    '''
    Save vertical configuration with automatic step_criteria generation.
    '''
    try:
        # Initialize generator
        generator = StepCriteriaGenerator(openai_client, supabase_client)
        
        # Process nodes and generate criteria
        generation_report = await generator.process_vertical_save(
            nodes=data.get('nodes', []),
            vertical=vertical
        )
        
        # Save to database (your existing save logic)
        await save_vertical_to_db(vertical, data)
        
        # Return with generation report
        return {
            "success": True,
            "message": "Vertical saved successfully",
            "generation_report": generation_report
        }
    
    except Exception as e:
        logger.error(f"Save failed: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }
"""


# ============================================================================
# Example Flask Integration
# ============================================================================

"""
# In your Flask app (e.g., api/routes/verticals.py)

from flask import Blueprint, request, jsonify
from openai import OpenAI
from database.scripts.backend_integration import StepCriteriaGenerator

verticals_bp = Blueprint('verticals', __name__)

@verticals_bp.route('/api/verticals/<vertical>', methods=['POST'])
async def save_vertical(vertical):
    '''
    Save vertical configuration with automatic step_criteria generation.
    '''
    try:
        data = request.get_json()
        
        # Initialize clients
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        supabase_client = get_supabase_client()
        
        # Initialize generator
        generator = StepCriteriaGenerator(openai_client, supabase_client)
        
        # Process nodes and generate criteria
        generation_report = await generator.process_vertical_save(
            nodes=data.get('nodes', []),
            vertical=vertical
        )
        
        # Save to database (your existing save logic)
        await save_vertical_to_db(vertical, data)
        
        # Return with generation report
        return jsonify({
            "success": True,
            "message": "Vertical saved successfully",
            "generation_report": generation_report
        })
    
    except Exception as e:
        logger.error(f"Save failed: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
"""


# ============================================================================
# Standalone Testing
# ============================================================================

if __name__ == "__main__":
    """Test the generator with sample data."""
    import asyncio
    from openai import OpenAI
    
    # Check API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)
    
    # Sample node data (as would come from Vue)
    sample_nodes = [
        {
            'node_name': 'greet',
            'step_criteria_source': 'Complete after greeting and initial rapport. Route based on their response.'
        },
        {
            'node_name': 'verify',
            'step_criteria_source': 'Complete when caller confirms their info is correct OR you have updated incorrect info.'
        }
    ]
    
    async def test():
        client = OpenAI(api_key=api_key)
        generator = StepCriteriaGenerator(client)
        
        print("=" * 80)
        print("BACKEND INTEGRATION TEST")
        print("=" * 80)
        print()
        
        result = await generator.process_vertical_save(sample_nodes)
        
        print("Generation Report:")
        print()
        print(f"Nodes processed: {result['stats']['total_processed']}")
        print()
        
        for node in result['nodes']:
            print(f"Node: {node['node_name']}")
            print(f"  SW: {node['sw_method']}")
            print(f"  LK: {node['lk_method']}")
            if node['has_warning']:
                print(f"  Warning: {node['warning_message']}")
            print()
        
        print(f"Cost: {result['stats']['cost_estimate']}")
        print()
        print("=" * 80)
    
    asyncio.run(test())

