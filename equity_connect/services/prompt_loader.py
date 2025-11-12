"""Prompt loading service for node-based conversation flow.

Loads node-specific prompts from database (Plan 2/3 integration) with fallback
to markdown files for development/testing.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


def load_theme(vertical: str = "reverse_mortgage") -> str:
	"""Load universal theme prompt for a vertical from database
	
	Theme defines Barbara's core personality across ALL nodes.
	Applied before every node prompt for consistency.
	
	Args:
	    vertical: Business vertical (default: "reverse_mortgage")
	
	Returns:
	    Theme prompt content defining core personality
	"""
	# TRY DATABASE FIRST
	try:
		from equity_connect.services.supabase import get_supabase_client
		
		sb = get_supabase_client()
		result = sb.table('theme_prompts').select('content').eq('vertical', vertical).eq('is_active', True).execute()
		
		if result.data and len(result.data) > 0:
			theme = result.data[0].get('content', '')
			if theme:
				logger.info(f"✅ Loaded theme for {vertical}: {len(theme)} chars")
				return theme
			else:
				logger.warning(f"Database returned empty theme for {vertical}, using fallback")
		else:
			logger.warning(f"No theme found in database for {vertical}, using fallback")
	
	except Exception as e:
		logger.warning(f"Failed to load theme from database: {e}, using fallback")
	
	# FALLBACK: Basic theme if database fails
	fallback_theme = """# Barbara - Core Personality

You are Barbara, a warm and professional voice assistant.

## Speaking Style
- Brief, natural responses
- Simple language, no jargon
- Patient with seniors

## Core Rules
- Never pressure
- Use tools for facts
- Listen more than talk
"""
	logger.info(f"Using fallback theme for {vertical}: {len(fallback_theme)} chars")
	return fallback_theme


def load_node_prompt(node_name: str, vertical: str = "reverse_mortgage") -> str:
	"""Load node prompt from database or fallback to markdown file
	
	This connects Plan 1 (backend) → Plan 2 (database) → Plan 3 (Vue portal).
	Portal edits are immediately available to the agent runtime.
	
	Args:
	    node_name: Node name (e.g., "greet", "verify", "qualify")
	    vertical: Business vertical (default: "reverse_mortgage")
	
	Returns:
	    Node prompt content (generic instructions, no call-type branching)
	"""
	# TRY DATABASE FIRST (Plan 2/3 integration)
	try:
		from equity_connect.services.supabase import get_supabase_client
		
		sb = get_supabase_client()
		result = sb.rpc('get_node_prompt', {
			'p_vertical': vertical,
			'p_node_name': node_name
		}).execute()
		
		if result.data and len(result.data) > 0:
			# Extract JSONB content from Plan 2 structure
			content = result.data[0].get('content', {})
			
			# Build prompt from JSONB fields (Plan 2 schema)
			prompt_parts = []
			if content.get('role'):
				prompt_parts.append(f"## Role\n{content['role']}\n")
			if content.get('instructions'):
				prompt_parts.append(f"## Instructions\n{content['instructions']}")
			
			if prompt_parts:
				node_prompt = "\n".join(prompt_parts)
				logger.info(f"✅ Loaded {node_name} from database (vertical={vertical})")
				
				# Load theme and combine: Theme → Node
				theme = load_theme(vertical)
				combined_prompt = f"{theme}\n\n---\n\n{node_prompt}"
				
				logger.info(f"Combined theme ({len(theme)} chars) + node ({len(node_prompt)} chars) = {len(combined_prompt)} chars")
				return combined_prompt
			else:
				# Database returned a row but content is empty
				logger.warning(f"Database returned empty content for {node_name}/{vertical}, falling back to file")
				# Fall through to file fallback
	
	except Exception as e:
		logger.warning(f"Failed to load from database: {e}, falling back to file")
	
	# FALLBACK TO FILE (development/testing)
	module_dir = os.path.dirname(__file__)
	prompt_path = os.path.join(module_dir, "..", "prompts", vertical, "nodes", f"{node_name}.md")
	prompt_path = os.path.abspath(prompt_path)
	
	try:
		with open(prompt_path, 'r') as f:
			node_prompt = f.read()
			logger.info(f"✅ Loaded {node_name} from file: {prompt_path}")
			
			# Load theme and combine
			theme = load_theme(vertical)
			combined_prompt = f"{theme}\n\n---\n\n{node_prompt}"
			
			return combined_prompt
	except FileNotFoundError:
		logger.warning(f"Prompt file not found: {prompt_path}")
		return f"You are in the {node_name} phase. Continue naturally."


def build_context_injection(call_type: str, lead_context: dict, phone_number: str) -> str:
	"""Build context string to inject before node prompt
	
	This provides the LLM with situational awareness so the same node prompt
	can adapt to different call types (inbound/outbound, qualified/unqualified).
	
	Args:
	    call_type: Type of call (inbound-qualified, outbound-warm, etc.)
	    lead_context: Dict with lead_id, name, qualified, property info, etc.
	    phone_number: Caller's phone number
	
	Returns:
	    Formatted context string to prepend to node prompt
	"""
	# Determine call direction
	is_inbound = call_type.startswith("inbound")
	is_qualified = lead_context.get("qualified", False)
	lead_id = lead_context.get("lead_id")
	lead_name = lead_context.get("name", "Unknown")
	
	context_parts = [
		"=== CALL CONTEXT ===",
		f"Call Type: {call_type}",
		f"Direction: {'Inbound' if is_inbound else 'Outbound'}",
		f"Phone: {phone_number}",
	]
	
	if lead_id:
		context_parts.append(f"Lead Status: Known (ID: {lead_id})")
		context_parts.append(f"Lead Name: {lead_name}")
		context_parts.append(f"Qualified: {'Yes' if is_qualified else 'No'}")
		
		# Add property context if available
		property_parts = []
		if lead_context.get("property_address"):
			property_parts.append(lead_context['property_address'])
		elif lead_context.get("property_city") or lead_context.get("property_state"):
			# Construct address from city/state if address not available
			addr_parts = []
			if lead_context.get("property_city"):
				addr_parts.append(lead_context['property_city'])
			if lead_context.get("property_state"):
				addr_parts.append(lead_context['property_state'])
			if addr_parts:
				property_parts.append(", ".join(addr_parts))
		
		if property_parts:
			context_parts.append(f"Property: {', '.join(property_parts)}")
		
		if lead_context.get("estimated_equity"):
			context_parts.append(f"Est. Equity: ${lead_context['estimated_equity']:,}")
		
		# Add email if available (for verification scenarios)
		if lead_context.get("email") or lead_context.get("primary_email"):
			context_parts.append(f"Email: {lead_context.get('email') or lead_context.get('primary_email')}")
	else:
		context_parts.append("Lead Status: Unknown (new caller)")
	
	context_parts.append("===================\n")
	
	return "\n".join(context_parts)


def build_instructions_for_node(
	node_name: str,
	call_type: str = "outbound",
	lead_context: Optional[dict] = None,
	phone_number: Optional[str] = None,
	vertical: str = "reverse_mortgage"
) -> str:
	"""Build complete instructions for a node (theme + context + node prompt)
	
	This is the main function called by BarbaraAgent to get full prompt text for SignalWire.
	Combines theme, call context, and node-specific instructions in the correct order.
	
	Args:
		node_name: Current conversation node (greet, verify, qualify, quote, answer, objections, book, exit)
		call_type: "inbound" or "outbound"
		lead_context: Optional lead information dict to inject into context
		phone_number: Caller's phone number
		vertical: Business vertical (default: reverse_mortgage)
	
	Returns:
		Complete prompt text ready for agent.set_prompt_text()
	
	Example:
		instructions = build_instructions_for_node(
			node_name="verify",
			call_type="outbound",
			lead_context={"lead_id": "123", "name": "John Doe"},
			phone_number="+15551234567"
		)
		agent.set_prompt_text(instructions)
	"""
	# 1. Load node prompt (already includes theme from load_node_prompt())
	# load_node_prompt() returns: theme + "---" + node
	node_prompt_with_theme = load_node_prompt(node_name, vertical)
	
	# 2. Build context injection (if we have context)
	context = None
	if lead_context and phone_number:
		context = build_context_injection(call_type, lead_context, phone_number)
	
	# 3. Combine: Node (with theme) → Context
	# load_node_prompt already combined theme + node, so we just inject context if available
	if context:
		# Insert context between theme and node sections
		# Split on the separator "---" that load_node_prompt adds
		if "\n---\n" in node_prompt_with_theme:
			theme_part, node_part = node_prompt_with_theme.split("\n---\n", 1)
			instructions = f"{theme_part}\n\n{context}\n\n---\n{node_part}"
		else:
			# Fallback: append context after everything
			instructions = f"{node_prompt_with_theme}\n\n{context}"
	else:
		# No context: use node prompt as-is (already has theme)
		instructions = node_prompt_with_theme
	
	logger.debug(f"📄 Built instructions for node '{node_name}': {len(instructions)} chars")
	return instructions


