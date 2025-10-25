/**
 * Barbara Voice Assistant Configuration
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import type { OpenAIRealtimeModels } from '@openai/agents/realtime';
import { AUDIO_FORMAT, ERROR_MESSAGES } from './constants.js';
import { logger } from './utils/logger.js';
import type { AudioFormat } from './types/index.js';

// Load environment variables
dotenv.config();

// ============================================================================
// Helper Functions
// ============================================================================

function getOpenAIApiKey(): string {
  // Try Docker secret first
  const secretPath = '/run/secrets/openai_api_key';
  try {
    if (fs.existsSync(secretPath)) {
      const apiKey = fs.readFileSync(secretPath, 'utf8').trim();
      if (apiKey) return apiKey;
    }
  } catch (error) {
    logger.debug('No Docker secret found, using environment variable');
  }

  const envApiKey = process.env.OPENAI_API_KEY;
  if (envApiKey) return envApiKey;

  return '';
}

// ============================================================================
// Environment Variables
// ============================================================================

export const OPENAI_API_KEY = getOpenAIApiKey();

if (!OPENAI_API_KEY) {
  logger.section('❌ Configuration Error', [
    'Missing OPENAI_API_KEY',
    '',
    'Set OPENAI_API_KEY environment variable or use Docker secrets.'
  ]);
  throw new Error(ERROR_MESSAGES.API_KEY_MISSING);
}

// ============================================================================
// Server Configuration
// ============================================================================

export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT || '8080', 10),
  host: '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info' // 'debug', 'info', 'error'
} as const;

// ============================================================================
// Database Configuration (Supabase)
// ============================================================================

export const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL || '',
  serviceKey: process.env.SUPABASE_SERVICE_KEY || ''
} as const;

// ============================================================================
// AI Agent Configuration
// ============================================================================

export const AGENT_CONFIG = {
  name: 'Barbara',
  voice: 'alloy' as const,
  model: (process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview') as OpenAIRealtimeModels,
  audioFormat: (process.env.AUDIO_FORMAT || AUDIO_FORMAT.G711_ULAW) as AudioFormat,
  
  // Default instructions (can be overridden per call)
  instructions: `
You are Barbara, a warm and professional AI assistant helping with reverse mortgage inquiries.

PERSONALITY:
- Warm, friendly, and conversational
- Professional but approachable  
- Patient and empathetic
- Clear and concise

GUIDELINES:
- Always greet the caller warmly
- Listen actively and respond naturally
- Keep responses conversational (you're on a phone call)
- Use available tools to help the caller
- Confirm actions before taking them

Remember: You're here to help and make the caller feel comfortable and supported.
  `.trim()
} as const;

// Validate audio format
const validAudioFormats = Object.values(AUDIO_FORMAT);
if (!validAudioFormats.includes(AGENT_CONFIG.audioFormat as any)) {
  logger.section('❌ Configuration Error', [
    `Invalid AUDIO_FORMAT: "${process.env.AUDIO_FORMAT || 'undefined'}"`,
    '',
    `Valid options: ${validAudioFormats.join(', ')}`,
    '',
    'Examples:',
    '- AUDIO_FORMAT="g711_ulaw" (default, 8kHz telephony)',
    '- AUDIO_FORMAT="pcm16" (high quality, 24kHz)'
  ]);
  throw new Error(`Invalid audio format: ${AGENT_CONFIG.audioFormat}`);
}

