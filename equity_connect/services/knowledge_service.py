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
	# Extract meaningful keywords (skip common words)
	tokens = [tok.lower() for tok in re.split(r"[^A-Za-z0-9]+", question or "") if tok]
	
	# Remove stop words
	stop_words = {"a", "an", "the", "is", "are", "was", "were", "be", "been", "being", 
	              "have", "has", "had", "do", "does", "did", "will", "would", "should", 
	              "could", "may", "might", "can", "about", "if", "in", "on", "at", "to",
	              "for", "of", "with", "by", "from", "up", "out", "as", "but", "or", "and",
	              "i", "you", "he", "she", "it", "we", "they", "my", "your", "his", "her"}
	
	keywords = [tok for tok in tokens if tok not in stop_words and len(tok) > 2]
	
	# Use the most specific keyword (prefer longer, domain-specific terms)
	# Priority: reverse mortgage terms > general real estate terms > verbs
	priority_terms = ["spouse", "mortgage", "equity", "hecm", "borrower", "lien", 
	                  "property", "house", "home", "die", "dies", "death", "airbnb", 
	                  "rent", "rental", "income", "foreclosure", "payoff"]
	
	pattern = None
	for term in priority_terms:
		if term in keywords:
			pattern = term
			break
	
	# If no priority term, use longest keyword
	if not pattern and keywords:
		pattern = max(keywords, key=len)
	
	# Fallback to first token or default
	if not pattern:
		pattern = tokens[0] if tokens else "reverse mortgage"
	
	logger.info(f"KB search using keyword: '{pattern}' (from question: '{question[:50]}...')")
	
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

