/**
 * SignalWire REST API Client
 * 
 * Handles outbound call placement via SignalWire REST API
 */

const fetch = require('node-fetch');

class SignalWireClient {
  constructor(projectId, authToken, space) {
    this.projectId = projectId;
    this.authToken = authToken;
    this.space = space;
    this.baseUrl = `https://${space}/api/laml/2010-04-01/Accounts/${projectId}`;
  }

  /**
   * Place an outbound call
   * @param {object} params - Call parameters
   * @param {string} params.to - Destination phone number (E.164)
   * @param {string} params.from - Source phone number (E.164)
   * @param {string} params.url - LaML URL to execute when call answers
   * @param {string} [params.statusCallback] - Webhook for call status updates
   * @returns {Promise<object>} - Call details
   */
  async createCall({ to, from, url, statusCallback }) {
    const auth = Buffer.from(`${this.projectId}:${this.authToken}`).toString('base64');
    
    const body = new URLSearchParams({
      From: from,
      To: to,
      Url: url,
      ...(statusCallback && { StatusCallback: statusCallback })
    });

    const apiUrl = `${this.baseUrl}/Calls.json`;
    console.log('📞 SignalWire API Request:', {
      url: apiUrl,
      from,
      to,
      callbackUrl: url
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: body.toString()
    });

    // Read response body as text first for debugging
    const responseText = await response.text();
    
    console.log('📡 SignalWire API Response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      bodyLength: responseText.length
    });

    if (!response.ok) {
      console.error('❌ SignalWire API Error:', responseText);
      throw new Error(`SignalWire API error: ${response.status} - ${responseText}`);
    }

    // Parse JSON from text
    if (!responseText || responseText.length === 0) {
      console.error('❌ Empty response body from SignalWire');
      throw new Error('SignalWire returned empty response');
    }

    try {
      const parsed = JSON.parse(responseText);
      console.log('✅ Call created:', parsed.sid);
      return parsed;
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.error('❌ Response text:', responseText.substring(0, 200));
      throw new Error(`Failed to parse SignalWire response: ${parseError.message}`);
    }
  }

  /**
   * Get call details
   * @param {string} callSid - Call SID
   * @returns {Promise<object>} - Call details
   */
  async getCall(callSid) {
    const auth = Buffer.from(`${this.projectId}:${this.authToken}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/Calls/${callSid}.json`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SignalWire API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Update an active call
   * @param {string} callSid - Call SID
   * @param {object} params - Update parameters (e.g., { Status: 'completed' })
   * @returns {Promise<object>} - Updated call details
   */
  async updateCall(callSid, params) {
    const auth = Buffer.from(`${this.projectId}:${this.authToken}`).toString('base64');
    
    const body = new URLSearchParams(params);

    const response = await fetch(`${this.baseUrl}/Calls/${callSid}.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: body.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SignalWire API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Hang up an active call
   * @param {string} callSid - Call SID
   * @returns {Promise<object>} - Call details
   */
  async hangupCall(callSid) {
    return await this.updateCall(callSid, { Status: 'completed' });
  }
}

module.exports = SignalWireClient;

