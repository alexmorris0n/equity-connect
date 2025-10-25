/**
 * Send Appointment Confirmation Tool
 * Send MFA code to confirm appointment via SMS
 * NEW: Based on SignalWire digital_employees MFA pattern
 */

import { z } from 'zod';
import { tool as realtimeTool } from '@openai/agents/realtime';
import { sendMFACode, verifyMFACode } from '../../services/mfa.js';
import { logger } from '../../utils/logger.js';

/**
 * Send appointment confirmation code via SMS
 * Returns MFA session ID for later verification
 */
export const sendAppointmentConfirmationTool = realtimeTool({
  name: 'send_appointment_confirmation',
  description: 'Send a 6-digit confirmation code via SMS to verify the appointment. Use this after booking to confirm the lead will attend.',
  parameters: z.object({
    phone_number: z.string().describe('Lead phone number (E.164 format recommended)'),
    signalwire_number: z.string().describe('SignalWire number to send from')
  }),
  execute: async ({ phone_number, signalwire_number }) => {
    try {
      logger.info(`📱 Sending appointment confirmation to: ${phone_number}`);
      
      const mfaSession = await sendMFACode(phone_number, signalwire_number);
      
      return JSON.stringify({
        success: mfaSession.success,
        mfa_session_id: mfaSession.id,
        message: `Confirmation code sent to ${phone_number}. Please ask the lead for the 6-digit code they received.`
      });
      
    } catch (error: any) {
      logger.error('Error sending confirmation code:', error);
      return JSON.stringify({
        success: false,
        error: error.message,
        message: 'Unable to send confirmation code. You can skip this step and proceed with the appointment.'
      });
    }
  }
});

/**
 * Verify appointment confirmation code
 * Checks if the 6-digit code matches the MFA session
 */
export const verifyAppointmentConfirmationTool = realtimeTool({
  name: 'verify_appointment_confirmation',
  description: 'Verify the 6-digit confirmation code provided by the lead.',
  parameters: z.object({
    mfa_session_id: z.string().describe('MFA session ID from send_appointment_confirmation'),
    code: z.string().describe('6-digit code provided by the lead')
  }),
  execute: async ({ mfa_session_id, code }) => {
    try {
      logger.info(`🔐 Verifying confirmation code for session: ${mfa_session_id}`);
      
      const isValid = await verifyMFACode(mfa_session_id, code);
      
      return JSON.stringify({
        success: true,
        verified: isValid,
        message: isValid 
          ? 'Appointment confirmed! The lead has verified they will attend.'
          : 'Invalid code. Please ask the lead to try again or proceed without verification.'
      });
      
    } catch (error: any) {
      logger.error('Error verifying confirmation code:', error);
      return JSON.stringify({
        success: false,
        verified: false,
        error: error.message,
        message: 'Unable to verify code. You can skip verification and proceed with the appointment.'
      });
    }
  }
});

