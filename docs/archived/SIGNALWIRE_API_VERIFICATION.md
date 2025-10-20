# SignalWire API Verification Guide

## 🔍 API Endpoint Verification

Since the SignalWire MCP documentation wasn't fully accessible, this guide helps verify the correct API endpoints and implementation patterns for our phone number management system.

---

## 📋 SignalWire REST API Endpoints

### **Base URL Pattern**
```
https://{your-space}.signalwire.com/api/relay/rest
```

### **Authentication**
```http
Authorization: Bearer {your_api_token}
Content-Type: application/json
```

---

## 📞 Phone Numbers Management

### **1. List Phone Numbers**
```http
GET /phone_numbers
```

**Query Parameters:**
- `limit`: Number of results per page (default: 50, max: 1000)
- `offset`: Number of results to skip
- `status`: Filter by status (active, inactive)

**Example Request:**
```bash
curl -X GET "https://your-space.signalwire.com/api/relay/rest/phone_numbers" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": "phone_number_id",
      "number": "+15551234567",
      "friendly_name": "Office Line",
      "status": "active",
      "voice_url": "https://your-app.com/voice",
      "sms_url": "https://your-app.com/sms",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}
```

### **2. Get Specific Phone Number**
```http
GET /phone_numbers/{id}
```

**Example Request:**
```bash
curl -X GET "https://your-space.signalwire.com/api/relay/rest/phone_numbers/phone_number_id" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### **3. Update Phone Number**
```http
PATCH /phone_numbers/{id}
```

**Request Body:**
```json
{
  "friendly_name": "Lead Pool - CA",
  "voice_url": "https://your-n8n-instance.com/webhook/voice",
  "sms_url": "https://your-n8n-instance.com/webhook/sms"
}
```

---

## 📞 Call Management

### **1. Create Outbound Call**
```http
POST /calls
```

**Request Body:**
```json
{
  "from": "+15551234567",
  "to": "+15559876543",
  "url": "https://your-app.com/call-handler",
  "status_callback": "https://your-n8n-instance.com/webhook/call-outcome",
  "status_callback_event": ["initiated", "ringing", "answered", "completed"],
  "record": true,
  "recording_channels": "dual"
}
```

**Example Request:**
```bash
curl -X POST "https://your-space.signalwire.com/api/relay/rest/calls" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+15551234567",
    "to": "+15559876543",
    "url": "https://your-app.com/call-handler",
    "status_callback": "https://your-n8n-instance.com/webhook/call-outcome"
  }'
```

### **2. Get Call Details**
```http
GET /calls/{id}
```

---

## 📱 Messaging

### **1. Send SMS**
```http
POST /messages
```

**Request Body:**
```json
{
  "from": "+15551234567",
  "to": "+15559876543",
  "body": "Hello from Equity Connect!",
  "status_callback": "https://your-n8n-instance.com/webhook/sms-status"
}
```

---

## 🔄 Webhook Configuration

### **Call Status Webhook**
SignalWire will send call status updates to your webhook URL:

**Webhook Payload:**
```json
{
  "call_sid": "call_id",
  "from": "+15551234567",
  "to": "+15559876543",
  "call_status": "completed",
  "direction": "outbound",
  "duration": 120,
  "recording_url": "https://your-space.signalwire.com/recordings/recording_id",
  "transcription_text": "Hello, this is a test call",
  "answered_by": "human"
}
```

**Call Status Values:**
- `queued`: Call is queued
- `ringing`: Call is ringing
- `in-progress`: Call is active
- `completed`: Call finished
- `busy`: Line was busy
- `no-answer`: No answer
- `failed`: Call failed

---

## 🧪 Testing Your Integration

### **1. Test API Connection**
```bash
# Test basic connectivity
curl -X GET "https://your-space.signalwire.com/api/relay/rest/phone_numbers" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -w "HTTP Status: %{http_code}\n"
```

### **2. Test Phone Number Assignment**
```bash
# Get available numbers
curl -X GET "https://your-space.signalwire.com/api/relay/rest/phone_numbers?status=active" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### **3. Test Call Creation**
```bash
# Create test call
curl -X POST "https://your-space.signalwire.com/api/relay/rest/calls" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+15551234567",
    "to": "+15559876543",
    "url": "https://httpbin.org/post"
  }'
```

---

## 🔧 n8n Integration Updates

### **Updated Phone Number Management Node**

```json
{
  "parameters": {
    "url": "https://your-space.signalwire.com/api/relay/rest/phone_numbers",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "signalwireApi",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "Bearer {{$credentials.signalwireApi.token}}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendQuery": true,
    "queryParameters": {
      "parameters": [
        {
          "name": "status",
          "value": "active"
        },
        {
          "name": "limit",
          "value": "100"
        }
      ]
    },
    "options": {}
  }
}
```

### **Updated Call Creation Node**

```json
{
  "parameters": {
    "url": "https://your-space.signalwire.com/api/relay/rest/calls",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "signalwireApi",
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "from",
          "value": "={{$json.phone_number}}"
        },
        {
          "name": "to",
          "value": "={{$json.lead_phone}}"
        },
        {
          "name": "url",
          "value": "https://your-app.com/call-handler"
        },
        {
          "name": "status_callback",
          "value": "https://your-n8n-instance.com/webhook/call-outcome"
        },
        {
          "name": "record",
          "value": true
        }
      ]
    },
    "options": {}
  }
}
```

---

## 📊 Error Handling

### **Common Error Responses**

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid API token"
}
```

**404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Phone number not found"
}
```

**429 Rate Limited:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

### **Error Handling in n8n**

```javascript
// Add error handling to your n8n functions
if ($input.first().json.error) {
  throw new Error(`SignalWire API Error: ${$input.first().json.message}`);
}

// Check HTTP status codes
if ($input.first().json.statusCode >= 400) {
  throw new Error(`HTTP Error: ${$input.first().json.statusCode}`);
}
```

---

## 🚀 Implementation Checklist

### **Pre-Implementation**
- [ ] Get SignalWire API credentials
- [ ] Test API connectivity
- [ ] Verify phone number endpoints
- [ ] Test call creation
- [ ] Set up webhook endpoints

### **Implementation**
- [ ] Update n8n workflow with correct endpoints
- [ ] Configure webhook handlers
- [ ] Test phone number assignment
- [ ] Test call outcome processing
- [ ] Verify health score updates

### **Post-Implementation**
- [ ] Monitor API usage
- [ ] Check webhook delivery
- [ ] Verify call recording
- [ ] Test number recycling
- [ ] Monitor performance metrics

---

## 🔍 Troubleshooting

### **Common Issues**

1. **Authentication Errors**
   - Verify API token is correct
   - Check token permissions
   - Ensure proper header format

2. **Phone Number Not Found**
   - Verify number exists in your account
   - Check number status (active/inactive)
   - Confirm proper number format

3. **Webhook Not Receiving Data**
   - Verify webhook URL is accessible
   - Check webhook configuration
   - Test webhook endpoint manually

4. **Call Creation Fails**
   - Verify from/to number format
   - Check number ownership
   - Confirm call URL is accessible

### **Debug Commands**

```bash
# Test webhook endpoint
curl -X POST "https://your-n8n-instance.com/webhook/call-outcome" \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

# Check phone number details
curl -X GET "https://your-space.signalwire.com/api/relay/rest/phone_numbers" \
  -H "Authorization: Bearer YOUR_API_TOKEN" | jq '.data[0]'

# Test call creation
curl -X POST "https://your-space.signalwire.com/api/relay/rest/calls" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from": "+15551234567", "to": "+15559876543", "url": "https://httpbin.org/post"}'
```

---

## 📚 Additional Resources

- **SignalWire Developer Portal**: https://developer.signalwire.com/
- **REST API Reference**: https://developer.signalwire.com/reference/relay-rest-api/
- **Webhook Documentation**: https://developer.signalwire.com/guides/webhooks/
- **SDK Documentation**: https://developer.signalwire.com/reference/relay-sdk-js/

---

**Ready to implement?** Use this guide to verify your SignalWire integration and ensure everything works correctly with your phone number management system! 🚀
