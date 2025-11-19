"""
Prompt building service
Combines theme + context + node prompts per BarbGraph architecture
"""

from typing import Optional, Dict, Any
from services.database import get_node_prompt, get_theme_prompt
import logging

logger = logging.getLogger(__name__)


def build_context_injection(lead_context: Optional[Dict[str, Any]], phone: str, call_type: str = "inbound") -> str:
    """
    Build context string to inject into prompt
    Creates formatted text block with call-specific information
    """
    if not lead_context:
        return ""
    
    context_parts = [
        "=== CALLER INFORMATION ===",
        f"Phone: {phone}",
    ]
    
    # Add lead information if available
    if lead_context.get('id'):
        context_parts.append(f"Lead ID: {lead_context['id']}")
    
    if lead_context.get('first_name'):
        context_parts.append(f"Name: {lead_context['first_name']}")
        if lead_context.get('last_name'):
            context_parts[-1] += f" {lead_context['last_name']}"
    
    if lead_context.get('qualified') is not None:
        context_parts.append(f"Qualified: {'Yes' if lead_context['qualified'] else 'No'}")
    
    # Property information
    if lead_context.get('property_address'):
        context_parts.append(f"Property Address: {lead_context['property_address']}")
    elif lead_context.get('property_city'):
        city = lead_context['property_city']
        if lead_context.get('property_state'):
            city += f", {lead_context['property_state']}"
        context_parts.append(f"Property Location: {city}")
    
    if lead_context.get('estimated_equity'):
        context_parts.append(f"Estimated Equity: ${lead_context['estimated_equity']:,}")
    
    if lead_context.get('property_value'):
        context_parts.append(f"Property Value: ${lead_context['property_value']:,}")
    
    if lead_context.get('age'):
        context_parts.append(f"Age: {lead_context['age']}")
    
    # Broker information
    if lead_context.get('assigned_broker_id') and lead_context.get('brokers'):
        broker = lead_context['brokers']
        broker_name = broker.get('contact_name', 'Unknown')
        if broker.get('company_name'):
            broker_name += f" ({broker['company_name']})"
        context_parts.append(f"Assigned Broker: {broker_name}")
    
    # Status
    if lead_context.get('status'):
        context_parts.append(f"Lead Status: {lead_context['status']}")
    
    context_parts.append("===================")
    
    return "\n".join(context_parts)


async def build_full_prompt(
    node_name: str,
    lead_context: Optional[Dict[str, Any]] = None,
    phone_number: Optional[str] = None,
    vertical: str = "reverse_mortgage",
    call_type: str = "inbound"
) -> str:
    """
    Build complete prompt for a node (theme + context + node)
    
    This is the main function that combines:
    1. Theme (universal personality)
    2. Caller context (injected information)
    3. Node-specific instructions
    
    Returns complete prompt text ready for SWML
    """
    # 1. Load theme (universal personality)
    theme = await get_theme_prompt(vertical)
    
    # 2. Load node prompt
    node_instructions = await get_node_prompt(node_name, vertical)
    
    if not node_instructions:
        logger.warning(f"[PROMPTS] No instructions found for node: {node_name}, using fallback")
        node_instructions = f"You are Barbara. Continue the conversation naturally."
    
    # 3. Build context injection (if we have lead data)
    context_block = ""
    if lead_context and phone_number:
        context_block = build_context_injection(lead_context, phone_number, call_type)
    
    # 4. Combine: Theme → Context → Node
    parts = []
    
    if theme:
        parts.append(theme)
        parts.append("---")
    
    if context_block:
        parts.append(context_block)
        parts.append("---")
    
    parts.append(node_instructions)
    
    full_prompt = "\n\n".join(parts)
    
    logger.info(f"[PROMPTS] Built prompt for node: {node_name} ({len(full_prompt)} chars)")
    
    return full_prompt

