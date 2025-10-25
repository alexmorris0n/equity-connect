/**
 * Google Vertex AI Service
 * Handles embeddings generation for knowledge base vector search
 */

import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

let vertexAuthClient: any = null;

/**
 * Get authentication token for Vertex AI
 */
async function getVertexAIToken(): Promise<string> {
  if (!vertexAuthClient) {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    
    if (!credentialsJson) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set');
    }

    const credentials = JSON.parse(credentialsJson);
    const auth = new GoogleAuth({
      credentials: credentials,
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    
    vertexAuthClient = await auth.getClient();
  }

  const token = await vertexAuthClient.getAccessToken();
  return token.token;
}

/**
 * Generate embedding vector for a text query
 * Uses Vertex AI text-embedding-005 (768 dimensions)
 * 
 * @param question - The text to generate embeddings for
 * @returns Array of 768 floating point numbers
 */
export async function generateEmbedding(question: string): Promise<number[]> {
  const startTime = Date.now();
  
  try {
    const projectId = process.env.GOOGLE_PROJECT_ID || 'barbara-475319';
    const location = 'us-central1';
    const model = 'text-embedding-005';
    
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getVertexAIToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [{ content: question }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Vertex AI embeddings failed: ${response.status} ${errorText}`);
      throw new Error(`Vertex AI embeddings failed: ${response.status}`);
    }

    const data: any = await response.json();
    const embedding = data.predictions[0].embeddings.values;
    
    const duration = Date.now() - startTime;
    logger.debug(`✅ Generated embedding in ${duration}ms (${embedding.length} dimensions)`);
    
    return embedding;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Embedding generation failed after ${duration}ms:`, error.message);
    throw error;
  }
}

