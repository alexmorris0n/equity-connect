/**
 * SignalWire Service
 * Handle outbound call placement via SignalWire REST API
 */

import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

const SW_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID;
const SW_TOKEN = process.env.SIGNALWIRE_API_TOKEN;
const SW_SPACE = process.env.SIGNALWIRE_SPACE;

export interface OutboundCallParams {
  to: string;           // E.164 phone number
  from: string;         // SignalWire number
  webhookUrl: string;   // Barbara V3 webhook URL
  leadId?: string;
  brokerId?: string;
}

export interface SendSmsParams {
  to: string;
  from: string;
  body: string;
  statusCallback?: string;
  metadata?: Record<string, any>;
}

interface SignalWireCredentials {
  projectId: string;
  token: string;
  space: string;
}

function requireCredentials(): SignalWireCredentials {
  if (!SW_PROJECT_ID || !SW_TOKEN || !SW_SPACE) {
    throw new Error('SignalWire credentials not configured');
  }

  return {
    projectId: SW_PROJECT_ID,
    token: SW_TOKEN,
    space: SW_SPACE
  };
}

/**
 * Place an outbound call via SignalWire REST API
 * 
 * @param params - Call parameters
 * @returns SignalWire Call SID
 */
export async function placeOutboundCall(params: OutboundCallParams): Promise<string> {
  const { projectId, token, space } = requireCredentials();

  const { to, from, webhookUrl, leadId, brokerId } = params;
  
  // Build webhook URL with context
  let fullWebhookUrl = `${webhookUrl}?direction=outbound&from=${from}&to=${to}`;
  if (leadId) fullWebhookUrl += `&lead_id=${leadId}`;
  if (brokerId) fullWebhookUrl += `&broker_id=${brokerId}`;

  const url = `https://${space}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`;
  
  const body = new URLSearchParams({
    To: to,
    From: from,
    Url: fullWebhookUrl
  });

  logger.info(`📞 Placing outbound call: ${from} → ${to}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${projectId}:${token}`).toString('base64')}`
    },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`SignalWire call failed: ${response.status} ${errorText}`);
    throw new Error(`Failed to place call: ${response.status}`);
  }

  const data: any = await response.json();
  const callSid = data.sid;
  
  logger.info(`✅ Call placed successfully: ${callSid}`);
  
  return callSid;
}

/**
 * Send an outbound SMS via SignalWire REST API
 */
export async function sendSmsMessage(params: SendSmsParams): Promise<any> {
  const { projectId, token, space } = requireCredentials();
  const { to, from, body, statusCallback } = params;

  const url = `https://${space}/api/laml/2010-04-01/Accounts/${projectId}/Messages.json`;

  const payload = new URLSearchParams({
    To: to,
    From: from,
    Body: body
  });

  if (statusCallback) {
    payload.append('StatusCallback', statusCallback);
  }

  logger.info(`💬 Sending SMS: ${from} → ${to}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${projectId}:${token}`).toString('base64')}`
    },
    body: payload.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`SignalWire SMS failed: ${response.status} ${errorText}`);
    throw new Error(`Failed to send SMS: ${response.status}`);
  }

  const json = await response.json();
  return json;
}

