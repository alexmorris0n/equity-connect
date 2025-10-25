/**
 * SignalWire MFA Service
 * Handles Multi-Factor Authentication via SMS
 * Based on SignalWire digital_employees MFA pattern
 */

import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

const SW_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID;
const SW_TOKEN = process.env.SIGNALWIRE_API_TOKEN;
const SW_SPACE = process.env.SIGNALWIRE_SPACE;

export interface MFASession {
  id: string;
  success: boolean;
}

/**
 * Send MFA code via SMS
 * Uses SignalWire's native MFA API
 * 
 * @param toPhone - Recipient phone number (E.164 format)
 * @param fromPhone - SignalWire phone number
 * @returns MFA session ID for verification
 */
export async function sendMFACode(
  toPhone: string,
  fromPhone: string
): Promise<MFASession> {
  if (!SW_PROJECT_ID || !SW_TOKEN || !SW_SPACE) {
    throw new Error('SignalWire credentials not configured');
  }

  const url = `https://${SW_SPACE}/api/relay/rest/mfa/sms`;
  
  const body = {
    to: toPhone,
    from: fromPhone,
    message: 'Your verification code is: ',
    allow_alpha: false,
    token_length: 6,
    valid_for: 7200,  // 2 hours
    max_attempts: 4
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${SW_PROJECT_ID}:${SW_TOKEN}`).toString('base64')}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`MFA send failed: ${response.status} ${errorText}`);
    throw new Error(`Failed to send MFA code: ${response.status}`);
  }

  const data: any = await response.json();
  
  logger.info(`✅ MFA code sent to ${toPhone} (session: ${data.id})`);
  
  return {
    id: data.id,
    success: data.success || false
  };
}

/**
 * Verify MFA code
 * 
 * @param mfaId - MFA session ID from sendMFACode
 * @param token - 6-digit code entered by user
 * @returns True if code is valid
 */
export async function verifyMFACode(
  mfaId: string,
  token: string
): Promise<boolean> {
  if (!SW_PROJECT_ID || !SW_TOKEN || !SW_SPACE) {
    throw new Error('SignalWire credentials not configured');
  }

  const url = `https://${SW_SPACE}/api/relay/rest/mfa/${mfaId}/verify`;
  
  const body = { token };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${SW_PROJECT_ID}:${SW_TOKEN}`).toString('base64')}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`MFA verify failed: ${response.status} ${errorText}`);
    return false;
  }

  const data: any = await response.json();
  const isValid = data.success === 'true' || data.success === true;
  
  logger.info(`${isValid ? '✅' : '❌'} MFA verification ${isValid ? 'succeeded' : 'failed'} for session ${mfaId}`);
  
  return isValid;
}

