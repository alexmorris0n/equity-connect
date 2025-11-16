"""Knowledge base search service."""

from typing import Optional, Dict, Any
import logging
import json
import re

from equity_connect.services.supabase import get_supabase_client

logger = logging.getLogger(__name__)


def search_knowledge_core(
	question: str,
	raw_data: Optional[Dict[str, Any]] = None,
) -> str:
	"""Return JSON search results for the knowledge base."""
	sb = get_supabase_client()
	
	try:
		logger.info(f"Knowledge search (keyword) for: {question!r}")
		return _keyword_search(sb, question)
	except Exception as e:
		logger.error(f"Knowledge search failed: {e}")
		return json.dumps(
			{
				"found": False,
				"fallback": True,
				"error": str(e),
				"message": "I'm having trouble accessing that info right now. Let me connect you with a specialist.",
			}
		)


def _keyword_search(sb, question: str, error: Optional[str] = None) -> str:
	tokens = [tok for tok in re.split(r"[^A-Za-z0-9]+", question or "") if tok]
	pattern = tokens[0] if tokens else (question or "")[:32]
	if not pattern:
		pattern = "reverse mortgage"
	
	try:
		response = (
			sb.table("vector_embeddings")
			.select("content, metadata")
			.eq("content_type", "reverse_mortgage_kb")
			.ilike("content", f"%{pattern}%")
			.limit(3)
			.execute()
		)
		results = response.data or []
	except Exception as fetch_error:
		logger.error(f"Keyword search failed: {fetch_error}")
		return json.dumps(
			{
				"found": False,
				"fallback": True,
				"message": "I'm having trouble accessing that info right now. Let me connect you with a specialist.",
				"error": error or str(fetch_error),
			}
		)
	
	if not results:
		return json.dumps(
			{
				"found": False,
				"fallback": True,
				"message": "I couldn't find that in the knowledge base, but I'll ask a specialist to follow up.",
				"error": error,
			}
		)
	
	formatted = "\n\n---\n\n".join(item.get("content", "") for item in results if item.get("content"))
	return json.dumps(
		{
			"found": True,
			"question": question,
			"answer": formatted,
			"fallback": True,
			"message": "Keyword search results from internal notes.",
			"error": error,
		}
	)

