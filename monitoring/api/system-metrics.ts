import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSystemMetrics } from '../services/system-metrics.js';

/**
 * Vercel API Route: GET /api/system-metrics
 * Returns system metrics for monitoring dashboard
 */
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Enable CORS
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Only allow GET
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const metrics = await getSystemMetrics();

    return response.status(200).json({
      success: true,
      metrics: metrics
    });
  } catch (error: any) {
    console.error('Error getting system metrics:', error);
    return response.status(500).json({
      success: false,
      error: error.message
    });
  }
}

