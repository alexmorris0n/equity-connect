/**
 * Supabase Service
 * Centralized database client for all business operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

let supabase: SupabaseClient | null = null;

/**
 * Initialize and return Supabase client
 * Singleton pattern - only creates one instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabase) {
    return supabase;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const error = 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables';
    logger.error(error);
    throw new Error(error);
  }

  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  logger.info('✅ Supabase client initialized');
  return supabase;
}

/**
 * Helper: Normalize phone number to last 10 digits
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

/**
 * Helper: Format phone number patterns for SQL search
 * Returns: ['6505300051', '650-530-0051']
 */
export function phoneSearchPatterns(phone: string): string[] {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) {
    return [normalized];
  }
  
  const last10 = normalized.slice(-10);
  const formatted = `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`;
  
  return [last10, formatted, `+1${last10}`];
}

