"""Knowledge base search tool - Fast keyword search (no embeddings)

This matches the SignalWire implementation which bypasses slow Vertex AI embeddings
and uses direct SQL keyword search on the content column instead.

Performance:
- Old (Vertex + Vector): 5-13 seconds → frequent timeouts
- New (Keyword search): <1 second → reliable
"""
from livekit.agents.llm import function_tool
from services.supabase import get_supabase_client
import logging
import json
import re

logger = logging.getLogger(__name__)

@function_tool
async def search_knowledge(question: str) -> str:
    """Search the reverse mortgage knowledge base for accurate information about eligibility, fees, objections, compliance, etc. Use this when leads ask complex questions beyond basic qualification.
    
    Args:
        question: The question or topic to search for (e.g., "what if they still have a mortgage", "costs and fees", "will they lose their home")
    """
    sb = get_supabase_client()
    import time
    start_time = time.time()
    
    try:
        logger.info(f"🔍 Starting knowledge search (keyword): \"{question}\"")
        
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
                          "rent", "rental", "income", "foreclosure", "payoff", "grandson",
                          "granddaughter", "family", "relative", "live", "living"]
        
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
        
        logger.info(f"🔑 KB search using keyword: '{pattern}' (from question: '{question[:50]}...')")
        
        # Direct SQL keyword search - MUCH faster than embeddings
        search_start_time = time.time()
        response = sb.table("vector_embeddings")\
            .select("content, metadata")\
            .eq("content_type", "reverse_mortgage_kb")\
            .ilike("content", f"%{pattern}%")\
            .limit(3)\
            .execute()
        
        search_duration_ms = int((time.time() - search_start_time) * 1000)
        logger.info(f"✅ Keyword search completed in {search_duration_ms}ms")
        
        results = response.data or []
        
        if len(results) == 0:
            logger.info('⚠️  No matching knowledge base content found')
            return json.dumps({
                "found": False,
                "fallback": True,
                "message": "That's a great question. I'll make sure we cover all those specifics during your appointment with the broker - they can walk you through exactly how that works for your situation."
            })
        
        # Format results
        formatted_knowledge = "\n\n---\n\n".join([item.get("content", "") for item in results if item.get("content")])
        
        total_duration_ms = int((time.time() - start_time) * 1000)
        logger.info(f"✅ Knowledge search complete in {total_duration_ms}ms (keyword search: {search_duration_ms}ms)")
        
        return json.dumps({
            "found": True,
            "question": question,
            "answer": formatted_knowledge,
            "sources_count": len(results),
            "message": "Use this information to answer the lead's question conversationally in 2 sentences max.",
            "performance": {
                "total_ms": total_duration_ms,
                "search_ms": search_duration_ms
            }
        })
        
    except Exception as e:
        total_duration_ms = int((time.time() - start_time) * 1000)
        logger.error(f"❌ Knowledge search failed after {total_duration_ms}ms: {e}")
        return json.dumps({
            "found": False,
            "error": str(e),
            "message": "I'm having trouble accessing that information right now. Let me connect you with one of our specialists who can help."
        })

