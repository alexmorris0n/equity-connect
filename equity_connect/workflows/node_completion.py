"""Node completion detection for event-based routing.

This module checks if conversation nodes have met their goals based on DB state flags.
"""


def is_node_complete(node_name: str, state: dict) -> bool:
	"""Check if current node goals are met based on DB state
	
	Args:
	    node_name: Name of the node to check (greet, verify, qualify, etc.)
	    state: Conversation state dict from database
	    
	Returns:
	    True if the node's goals are met and it's ready to transition
	"""
	
	completion_criteria = {
		"greet": lambda s: s.get("ready_to_book") == True or s.get("verified") == True or s.get("wrong_person") == True,
		"verify": lambda s: s.get("verified") == True,
		"qualify": lambda s: s.get("qualified") != None,
		"quote": lambda s: s.get("quote_presented") == True,
		"answer": lambda s: s.get("questions_answered") or s.get("ready_to_book") or s.get("has_objections"),
		"objections": lambda s: s.get("objection_handled") == True,
		"book": lambda s: s.get("appointment_booked") == True,
		"exit": lambda s: True,
	}
	
	checker = completion_criteria.get(node_name)
	return checker(state) if checker else False

