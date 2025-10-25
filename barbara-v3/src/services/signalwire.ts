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

/**
 * Place an outbound call via SignalWire REST API
 * 
 * @param params - Call parameters
 * @returns SignalWire Call SID
 */
export async function placeOutboundCall(params: OutboundCallParams): Promise<string> {
  if (!SW_PROJECT_ID || !SW_TOKEN || !SW_SPACE) {
    throw new Error('SignalWire credentials not configured');
  }

  const { to, from, webhookUrl, leadId, brokerId } = params;
  
  // Build webhook URL with context
  let fullWebhookUrl = `${webhookUrl}?direction=outbound&from=${from}&to=${to}`;
  if (leadId) fullWebhookUrl += `&lead_id=${leadId}`;
  if (brokerId) fullWebhookUrl += `&broker_id=${brokerId}`;

  const url = `https://${SW_SPACE}/api/laml/2010-04-01/Accounts/${SW_PROJECT_ID}/Calls.json`;
  
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
      'Authorization': `Basic ${Buffer.from(`${SW_PROJECT_ID}:${SW_TOKEN}`).toString('base64')}`
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

