# HMAC Verification Implementation for N8N Workflows

## Overview
This guide implements HMAC signature verification for CSV uploads to prevent tampering and ensure data integrity.

---

## Architecture

```
Client (Node.js/Python)
  ↓
  Signs CSV file with HMAC-SHA256
  ↓
  Sends: CSV + Signature + Timestamp + Content-SHA256
  ↓
n8n Webhook (Raw Body Mode)
  ↓
  Verify timestamp (±5 min window)
  ↓
  Verify HMAC signature
  ↓
  Check replay guard (prevent duplicate uploads)
  ↓
  Process CSV
```

---

## Client Implementation (Node.js)

### Upload Script with HMAC Signing

```javascript
// upload-leads.js
import crypto from 'node:crypto';
import fs from 'node:fs';
import fetch from 'node-fetch';

// Configuration
const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const HMAC_KEY = process.env.HMAC_SECRET_KEY;

async function uploadLeadsWithHMAC(filePath) {
  // Read the CSV file
  const fileBuffer = fs.readFileSync(filePath);
  
  // Generate content SHA-256 hash
  const contentHash = crypto
    .createHash('sha256')
    .update(fileBuffer)
    .digest('hex');
  
  // Generate HMAC signature
  const hmacSignature = crypto
    .createHmac('sha256', HMAC_KEY)
    .update(fileBuffer)
    .digest('hex');
  
  // Generate RFC3339 timestamp
  const timestamp = new Date().toISOString();
  
  // Make request
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      'X-Signature': `sha256=${hmacSignature}`,
      'X-Content-SHA256': contentHash,
      'X-Signature-Timestamp': timestamp,
      'X-Upload-Source': 'propstream-batch'
    },
    body: fileBuffer
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log('Upload successful:', result);
  return result;
}

// Usage
uploadLeadsWithHMAC('./leads-export.csv')
  .then(() => console.log('Done'))
  .catch(err => console.error('Upload failed:', err));
```

---

## Client Implementation (Python)

### Upload Script with HMAC Signing

```python
# upload_leads.py
import os
import hmac
import hashlib
import requests
from datetime import datetime, timezone

WEBHOOK_URL = os.getenv('N8N_WEBHOOK_URL')
HMAC_KEY = os.getenv('HMAC_SECRET_KEY').encode('utf-8')

def upload_leads_with_hmac(file_path):
    """Upload CSV file with HMAC signature"""
    
    # Read file
    with open(file_path, 'rb') as f:
        file_content = f.read()
    
    # Generate content SHA-256 hash
    content_hash = hashlib.sha256(file_content).hexdigest()
    
    # Generate HMAC signature
    hmac_signature = hmac.new(
        HMAC_KEY,
        file_content,
        hashlib.sha256
    ).hexdigest()
    
    # Generate RFC3339 timestamp
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Make request
    headers = {
        'Content-Type': 'text/csv',
        'X-Signature': f'sha256={hmac_signature}',
        'X-Content-SHA256': content_hash,
        'X-Signature-Timestamp': timestamp,
        'X-Upload-Source': 'propstream-batch'
    }
    
    response = requests.post(
        WEBHOOK_URL,
        data=file_content,
        headers=headers
    )
    
    response.raise_for_status()
    print(f'Upload successful: {response.json()}')
    return response.json()

if __name__ == '__main__':
    upload_leads_with_hmac('./leads-export.csv')
```

---

## N8N Webhook Configuration

### Webhook Node Settings

```json
{
  "parameters": {
    "httpMethod": "POST",
    "path": "upload-leads-secured",
    "responseMode": "onReceived",
    "options": {
      "rawBody": true,
      "binaryData": true
    }
  },
  "name": "Secure CSV Upload Webhook",
  "type": "n8n-nodes-base.webhook"
}
```

---

## N8N Function Node: HMAC Verification

### Function Node (placed immediately after Webhook)

```javascript
// HMAC Verification Function Node
const crypto = require('crypto');

// ===================================
// CONFIGURATION
// ===================================
const HMAC_SECRET = $env.HMAC_SECRET_KEY; // Set in n8n credentials
const TIMESTAMP_WINDOW_SECONDS = 300; // ±5 minutes

// ===================================
// HELPER FUNCTIONS
// ===================================

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function verifyTimestamp(timestampStr) {
  const requestTime = new Date(timestampStr).getTime();
  const currentTime = Date.now();
  const diff = Math.abs(currentTime - requestTime) / 1000;
  
  if (diff > TIMESTAMP_WINDOW_SECONDS) {
    throw new Error(`Timestamp outside acceptable window. Diff: ${diff}s, Max: ${TIMESTAMP_WINDOW_SECONDS}s`);
  }
  
  return true;
}

// ===================================
// MAIN VERIFICATION LOGIC
// ===================================

try {
  // Extract headers
  const headers = $json.headers || {};
  const signature = headers['x-signature'];
  const contentSha256 = headers['x-content-sha256'];
  const timestamp = headers['x-signature-timestamp'];
  const uploadSource = headers['x-upload-source'] || 'unknown';
  
  // Validate required headers
  if (!signature || !signature.startsWith('sha256=')) {
    throw new Error('Missing or invalid X-Signature header');
  }
  
  if (!timestamp) {
    throw new Error('Missing X-Signature-Timestamp header');
  }
  
  // Verify timestamp (replay attack protection)
  verifyTimestamp(timestamp);
  
  // Extract signature value
  const expectedSignature = signature.slice('sha256='.length);
  
  // Get raw body from webhook
  const rawData = items[0].binary?.data?.data;
  if (!rawData) {
    throw new Error('No raw body data received');
  }
  
  // Convert from base64 to buffer
  const bodyBuffer = Buffer.from(rawData, 'base64');
  
  // Compute HMAC
  const computedSignature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(bodyBuffer)
    .digest('hex');
  
  // Timing-safe comparison
  const isValid = timingSafeEqual(computedSignature, expectedSignature);
  
  if (!isValid) {
    throw new Error('HMAC signature mismatch - data may have been tampered with');
  }
  
  // Optional: Verify content SHA-256 hash
  if (contentSha256) {
    const computedContentHash = crypto
      .createHash('sha256')
      .update(bodyBuffer)
      .digest('hex');
    
    if (computedContentHash !== contentSha256) {
      throw new Error('Content SHA-256 mismatch - file integrity check failed');
    }
  }
  
  // Verification successful - pass through with metadata
  return [{
    json: {
      verified: true,
      timestamp: timestamp,
      contentLength: bodyBuffer.length,
      uploadSource: uploadSource,
      receivedAt: new Date().toISOString()
    },
    binary: {
      data: items[0].binary.data
    }
  }];
  
} catch (error) {
  // Log verification failure
  console.error('HMAC Verification Failed:', error.message);
  
  // Return error for DLQ handling
  return [{
    json: {
      verified: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }];
}
```

---

## N8N Function Node: Replay Attack Protection

### Check Replay Guard (After HMAC Verification)

```javascript
// Replay Attack Protection Function Node
const crypto = require('crypto');

// Get verified data
const verifiedData = $input.first().json;
const binaryData = $input.first().binary?.data?.data;

if (!verifiedData.verified) {
  // HMAC verification failed - send to DLQ
  return [{
    json: {
      error: 'HMAC verification failed',
      reason: verifiedData.error,
      destination: 'dlq'
    }
  }];
}

// Compute SHA-256 of content for replay detection
const bodyBuffer = Buffer.from(binaryData, 'base64');
const contentHash = crypto
  .createHash('sha256')
  .update(bodyBuffer)
  .digest('hex');

// Prepare Supabase upsert to replay guard table
return [{
  json: {
    content_sha256: contentHash,
    received_at: verifiedData.receivedAt,
    request_headers: JSON.stringify({
      timestamp: verifiedData.timestamp,
      source: verifiedData.uploadSource
    }),
    source: verifiedData.uploadSource
  },
  binary: {
    data: {
      data: binaryData
    }
  }
}];
```

---

## N8N Supabase Node: Insert Replay Guard

### Supabase Node Configuration

```json
{
  "parameters": {
    "operation": "insert",
    "table": "ingest_replay_guard",
    "fieldsUi": {
      "fieldValues": [
        {
          "fieldName": "content_sha256",
          "fieldValue": "={{ $json.content_sha256 }}"
        },
        {
          "fieldName": "received_at",
          "fieldValue": "={{ $json.received_at }}"
        },
        {
          "fieldName": "request_headers",
          "fieldValue": "={{ $json.request_headers }}"
        },
        {
          "fieldName": "source",
          "fieldValue": "={{ $json.source }}"
        }
      ]
    },
    "options": {
      "onConflict": "error"
    }
  },
  "name": "Check Replay Guard",
  "type": "n8n-nodes-base.supabase"
}
```

### Error Handling (If Duplicate Detected)

```javascript
// Error Handler Function Node
const error = $json.error;

if (error && error.message && error.message.includes('duplicate key')) {
  // Duplicate upload detected - reject
  return [{
    json: {
      status: 'rejected',
      reason: 'Duplicate upload - content already processed',
      content_hash: $('Check Replay Guard').item.json.content_sha256
    }
  }];
}

// Other error - send to DLQ
return [{
  json: {
    status: 'dlq',
    reason: error.message || 'Unknown error',
    source: 'replay_guard_check'
  }
}];
```

---

## Complete N8N Workflow: Secured CSV Upload

### Workflow Structure

```
1. Webhook (Raw Body, Binary Data)
   ↓
2. HMAC Verification Function
   ↓
3. IF: Verification Success?
   ├─ Yes → Continue
   └─ No → Send to DLQ
   ↓
4. Replay Guard Check (Supabase Insert)
   ↓
5. IF: Duplicate Detected?
   ├─ Yes → Reject (Return 409 Conflict)
   └─ No → Continue
   ↓
6. CSV Parser
   ↓
7. Lead Staging (Insert to leads_staging)
   ↓
8. Dedupe & Upsert (Call upsert_lead function)
   ↓
9. Success Response
```

---

## Environment Variables Required

Add these to your n8n environment or credentials:

```bash
# HMAC Secret (must match client)
HMAC_SECRET_KEY=your-super-secret-hmac-key-change-this

# N8N Webhook URL
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/upload-leads-secured

# Supabase Credentials (for replay guard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

---

## Security Best Practices

### 1. Key Management
- Store HMAC secret in environment variable or secrets manager
- Rotate keys periodically (every 90 days)
- Use different keys for different environments (dev/staging/prod)

### 2. Timestamp Window
- Keep window small (5 minutes recommended)
- Log rejected requests for monitoring
- Alert on high rejection rates

### 3. Replay Protection
- Clean old replay guard entries (keep 7 days)
- Index content_sha256 for fast lookups
- Monitor duplicate attempt rates

### 4. Error Handling
- Never reveal signature details in error messages
- Log failures to DLQ for analysis
- Set up alerts for verification failures

---

## Testing

### Test Script

```javascript
// test-hmac-upload.js
const crypto = require('crypto');
const fs = require('fs');

// Test with sample CSV
const testCSV = 'first_name,last_name,email\nJohn,Doe,john@example.com';
const testBuffer = Buffer.from(testCSV);

const HMAC_KEY = 'test-key';

// Generate signature
const signature = crypto
  .createHmac('sha256', HMAC_KEY)
  .update(testBuffer)
  .digest('hex');

console.log('Test CSV:', testCSV);
console.log('HMAC Signature:', signature);
console.log('Content SHA-256:', crypto.createHash('sha256').update(testBuffer).digest('hex'));
```

---

## Monitoring & Observability

### Metrics to Track
1. Total upload attempts
2. HMAC verification success rate
3. Timestamp rejections (replay attempts?)
4. Duplicate uploads detected
5. Average verification time

### Alerts to Set Up
1. HMAC verification failure rate > 5%
2. Duplicate upload rate > 10%
3. Timestamp rejection spike
4. DLQ queue depth > 100 items

---

## Troubleshooting

### Common Issues

**Issue: "HMAC signature mismatch"**
- Ensure client and server use same secret key
- Verify raw body is being signed (not parsed/modified)
- Check for encoding issues (UTF-8, line endings)

**Issue: "Timestamp outside acceptable window"**
- Check system clock synchronization (NTP)
- Verify timezone handling
- Increase window temporarily for debugging

**Issue: "Duplicate upload detected"**
- Intentional - working as designed
- Check if retries are happening
- Review client upload logic

---

## Next Steps

1. Deploy updated n8n workflow
2. Test with sample CSV files
3. Monitor verification success rates
4. Set up DLQ processing workflow
5. Configure alerts and dashboards

