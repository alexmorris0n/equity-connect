"""Knowledge base search tool"""
from livekit.agents.llm import function_tool
from services.supabase import get_supabase_client
from services.vertex import generate_embedding
import logging
import json
import os

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
        logger.info(f"🔍 Starting knowledge search: \"{question}\"")
        
        # Check if Google credentials are available
        if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON"):
            logger.warn('⚠️  Google credentials not available - using fallback')
            return json.dumps({
                "found": False,
                "fallback": True,
                "message": "I'd be happy to connect you with one of our specialists who can answer that question in detail. They have all the latest information about reverse mortgages."
            })
        
        # Generate embedding for the question
        embedding_start_time = time.time()
        query_embedding = await generate_embedding(question)
        embedding_duration_ms = int((time.time() - embedding_start_time) * 1000)
        
        logger.info(f"✅ Embedding generated in {embedding_duration_ms}ms")
        
        # Search vector store using Supabase function
        vector_search_start_time = time.time()
        response = sb.rpc('find_similar_content', {
            "query_embedding": query_embedding,
            "content_type_filter": "reverse_mortgage_kb",
            "match_threshold": 0.7,
            "match_count": 3
        }).execute()
        
        vector_search_duration_ms = int((time.time() - vector_search_start_time) * 1000)
        logger.info(f"✅ Vector search completed in {vector_search_duration_ms}ms")
        
        if response.error:
            logger.error(f'Vector search error: {response.error}')
            return json.dumps({
                "found": False,
                "error": str(response.error),
                "message": "I'm having trouble accessing that information. Let me connect you with one of our specialists."
            })
        
        data = response.data or []
        
        if len(data) == 0:
            logger.info('⚠️  No matching knowledge base content found')
            return json.dumps({
                "found": False,
                "fallback": True,
                "message": "That's a great question. I'll make sure we cover all those specifics during your appointment with the broker - they can walk you through exactly how that works for your situation."
            })
        
        # Format results for conversational use
        formatted_results = []
        for idx, item in enumerate(data):
            formatted_results.append({
                "rank": idx + 1,
                "content": item.get("content", ""),
                "similarity": f"{int(item.get('similarity', 0) * 100)}%"
            })
        
        # Combine top results
        combined_knowledge = "\n\n---\n\n".join([r["content"] for r in formatted_results])
        
        total_duration_ms = int((time.time() - start_time) * 1000)
        logger.info(f"✅ Knowledge search complete in {total_duration_ms}ms (embedding: {embedding_duration_ms}ms, search: {vector_search_duration_ms}ms)")
        
        return json.dumps({
            "found": True,
            "question": question,
            "answer": combined_knowledge,
            "sources_count": len(formatted_results),
            "message": "Use this information to answer the lead's question conversationally in 2 sentences max.",
            "performance": {
                "total_ms": total_duration_ms,
                "embedding_ms": embedding_duration_ms,
                "search_ms": vector_search_duration_ms
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

