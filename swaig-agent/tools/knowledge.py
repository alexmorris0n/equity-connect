"""
Knowledge base search tool - Fast keyword search (no embeddings)

This uses direct SQL keyword search on the content column for fast, reliable results.

Performance:
- Keyword search: <1 second → reliable
- Old (Vector + Embeddings): 5-13 seconds → frequent timeouts
"""

from typing import Dict, Any
import logging
import asyncio
import re
from services.database import supabase as sb

logger = logging.getLogger(__name__)


# Fallback responses for common questions when KB search fails/times out
FALLBACK_RESPONSES = {
    "fees": (
        "Fees vary by lender, but typically include origination fees and closing costs. "
        "Your assigned broker will provide exact figures based on your property and loan amount."
    ),
    "how much": (
        "The amount depends on your age, property value, and existing mortgage balance. "
        "Your broker will calculate the exact amount based on your specific situation."
    ),
    "death": (
        "When the borrower passes away, the home can be sold or the heirs can pay off the loan. "
        "Your broker can explain all the options for estate planning with reverse mortgages."
    ),
    "die": (
        "When the borrower passes away, the home can be sold or the heirs can pay off the loan. "
        "Your broker can explain all the options for estate planning with reverse mortgages."
    ),
    "spouse": (
        "If both spouses are on the loan, the reverse mortgage continues even if one passes away. "
        "This is an important topic - your broker can walk you through how it works for your situation."
    ),
    "mortgage": (
        "Reverse mortgages are available even if you have an existing mortgage. "
        "The reverse mortgage proceeds would first pay off your existing mortgage, then provide you with access to the remaining equity."
    ),
    "equity": (
        "The amount you can access depends on your age, property value, and existing mortgage balance. "
        "Your broker will calculate the exact amount available to you."
    ),
    "cost": (
        "There are some upfront costs like origination fees and closing costs. "
        "Your broker can provide exact figures and explain what's included."
    ),
}


def get_fallback_response(query: str) -> str:
    """Get fallback response based on query keywords"""
    query_lower = query.lower()
    
    for keyword, response in FALLBACK_RESPONSES.items():
        if keyword in query_lower:
            return response
    
    return (
        "That's a great question about reverse mortgages. "
        "I'll make sure we cover all those specifics during your appointment with the broker - "
        "they can walk you through exactly how that works for your situation."
    )


async def _perform_keyword_search(query: str):
    """Perform the actual keyword search in Supabase"""
    # Extract meaningful keywords (skip common words)
    tokens = [tok.lower() for tok in re.split(r"[^A-Za-z0-9]+", query or "") if tok]
    
    # Remove stop words
    stop_words = {"a", "an", "the", "is", "are", "was", "were", "be", "been", "being", 
                  "have", "has", "had", "do", "does", "did", "will", "would", "should", 
                  "could", "may", "might", "can", "about", "if", "in", "on", "at", "to",
                  "for", "of", "with", "by", "from", "up", "out", "as", "but", "or", "and",
                  "i", "you", "he", "she", "it", "we", "they", "my", "your", "his", "her"}
    
    keywords = [tok for tok in tokens if tok not in stop_words and len(tok) > 2]
    
    # Use the most specific keyword (prefer longer, domain-specific terms)
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
    
    logger.info(f"[KNOWLEDGE] KB search using keyword: '{pattern}' (from query: '{query[:50]}...')")
    
    # Direct SQL keyword search - MUCH faster than embeddings
    response = sb.table("vector_embeddings")\
        .select("content, metadata")\
        .eq("content_type", "reverse_mortgage_kb")\
        .ilike("content", f"%{pattern}%")\
        .limit(3)\
        .execute()
    
    return response.data or []


async def handle_knowledge_search(caller_id: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Search knowledge base for reverse mortgage questions using fast keyword search.
    Wrapped with 20-second timeout and fallback responses.
    """
    query = args.get('query', '')
    
    if not query:
        return {
            "response": "What would you like to know about reverse mortgages?"
        }
    
    logger.info(f"[KNOWLEDGE] Search query: {query}")
    
    try:
        # Wrap search in timeout (20 seconds)
        results = await asyncio.wait_for(
            _perform_keyword_search(query),
            timeout=20.0
        )
        
        if results:
            # Format results
            formatted_knowledge = "\n\n---\n\n".join([
                item.get('content', '') for item in results if item.get('content')
            ])
            
            response_text = (
                f"Based on your question, here's what I can tell you: {formatted_knowledge[:500]}. "
                "Would you like more specific information about any aspect?"
            )
            
            logger.info(f"[KNOWLEDGE] ✅ Search completed successfully ({len(results)} results)")
            
            return {
                "response": response_text
            }
        else:
            # No results found - use fallback
            logger.info('[KNOWLEDGE] ⚠️  No matching knowledge base content found, using fallback')
            fallback = get_fallback_response(query)
            
            return {
                "response": f"{fallback} Would you like me to have a licensed advisor provide more detailed information?"
            }
        
    except asyncio.TimeoutError:
        logger.error(f"[KNOWLEDGE] ❌ Search timeout after 20s for query: {query}")
        
        # Return fallback response
        fallback = get_fallback_response(query)
        
        return {
            "response": (
                f"{fallback} "
                "Would you like me to have a licensed advisor provide more detailed information?"
            )
        }
    
    except Exception as e:
        logger.error(f"[KNOWLEDGE] ❌ Search error: {e}")
        
        # Return fallback response
        fallback = get_fallback_response(query)
        
        return {
            "response": (
                f"{fallback} "
                "I'm having trouble accessing the information right now. "
                "Would you like me to have someone call you with more details?"
            )
        }

