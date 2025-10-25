/**
 * Search Knowledge Base Tool
 * Vector search for reverse mortgage information
 * Performance: Typically 8-15 seconds (embeddings + vector search)
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { getSupabaseClient } from '../../services/supabase.js';
import { generateEmbedding } from '../../services/vertex-ai.js';
import { logger } from '../../utils/logger.js';

/**
 * Search the reverse mortgage knowledge base
 * Uses Vertex AI embeddings + Supabase vector search
 */
export const searchKnowledgeTool = realtimeTool({
  name: 'search_knowledge',
  description: 'Search the reverse mortgage knowledge base for accurate information about eligibility, fees, objections, compliance, etc. Use this when leads ask complex questions beyond basic qualification.',
  parameters: z.object({
    question: z.string().describe('The question or topic to search for (e.g., "what if they still have a mortgage", "costs and fees", "will they lose their home")')
  }),
  execute: async ({ question }) => {
    const sb = getSupabaseClient();
    const startTime = Date.now();
    
    try {
      logger.info(`🔍 Starting knowledge search: "${question}"`);
      
      // Check if Google credentials are available
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        logger.warn('⚠️  Google credentials not available - using fallback');
        return JSON.stringify({
          found: false,
          fallback: true,
          message: "I'd be happy to connect you with one of our specialists who can answer that question in detail. They have all the latest information about reverse mortgages."
        });
      }
      
      // Generate embedding for the question
      const embeddingStartTime = Date.now();
      const queryEmbedding = await generateEmbedding(question);
      const embeddingDuration = Date.now() - embeddingStartTime;
      
      logger.info(`✅ Embedding generated in ${embeddingDuration}ms`);
      
      // Search vector store using Supabase function
      const vectorSearchStartTime = Date.now();
      const { data, error } = await sb.rpc('find_similar_content', {
        query_embedding: queryEmbedding,
        content_type_filter: 'reverse_mortgage_kb',
        match_threshold: 0.7,
        match_count: 3
      });
      
      const vectorSearchDuration = Date.now() - vectorSearchStartTime;
      logger.info(`✅ Vector search completed in ${vectorSearchDuration}ms`);
      
      if (error) {
        logger.error('Vector search error:', error);
        return JSON.stringify({
          found: false,
          error: error.message,
          message: "I'm having trouble accessing that information. Let me connect you with one of our specialists."
        });
      }
      
      if (!data || data.length === 0) {
        logger.info('⚠️  No matching knowledge base content found');
        return JSON.stringify({
          found: false,
          fallback: true,
          message: "That's a great question. I'll make sure we cover all those specifics during your appointment with the broker - they can walk you through exactly how that works for your situation."
        });
      }
      
      // Format results for conversational use
      const formattedResults = data.map((item: any, index: number) => ({
        rank: index + 1,
        content: item.content,
        similarity: Math.round(item.similarity * 100) + '%'
      }));
      
      // Combine top results
      const combinedKnowledge = formattedResults
        .map((r: any) => r.content)
        .join('\n\n---\n\n');
      
      const totalDuration = Date.now() - startTime;
      logger.info(`✅ Knowledge search complete in ${totalDuration}ms (embedding: ${embeddingDuration}ms, search: ${vectorSearchDuration}ms)`);
      
      return JSON.stringify({
        found: true,
        question,
        answer: combinedKnowledge,
        sources_count: formattedResults.length,
        message: 'Use this information to answer the lead\'s question conversationally in 2 sentences max.',
        performance: {
          total_ms: totalDuration,
          embedding_ms: embeddingDuration,
          search_ms: vectorSearchDuration
        }
      });
      
    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      logger.error(`❌ Knowledge search failed after ${totalDuration}ms:`, error);
      return JSON.stringify({
        found: false,
        error: error.message,
        message: "I'm having trouble accessing that information right now. Let me connect you with one of our specialists who can help."
      });
    }
  }
});

