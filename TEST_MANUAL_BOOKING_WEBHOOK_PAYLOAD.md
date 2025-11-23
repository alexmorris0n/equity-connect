# Test Payload for Manual Booking Webhook

## Webhook URL
```
https://n8n.instaroute.com/webhook/sw_manual_booking
```

## Test Payload (JSON)

### Example 1: Booking Failure (Nylas API Error)
```json
{
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
  "phone": "+15551234567",
  "error": "Nylas API error: 500 - Internal Server Error",
  "error_type": "str",
  "requested_time": "Tuesday at 2 PM",
  "notes": "Lead prefers afternoon appointments",
  "timestamp": "2025-01-15T14:30:00.000000",
  "source": "signalwire_agent"
}
```

### Example 2: Booking Failure (Exception)
```json
{
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
  "phone": "+15551234567",
  "error": "Timeout connecting to Nylas API",
  "error_type": "str",
  "requested_time": "2025-01-20T10:00:00Z",
  "notes": "Lead asked about reverse mortgage options",
  "timestamp": "2025-01-15T14:30:00.000000",
  "source": "signalwire_agent"
}
```

### Example 3: Availability Check Failure
```json
{
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
  "phone": "+15551234567",
  "error": "Availability check error: Connection timeout",
  "error_type": "str",
  "requested_time": "next week",
  "notes": null,
  "timestamp": "2025-01-15T14:30:00.000000",
  "source": "signalwire_agent"
}
```

### Example 4: Missing Broker (No Broker ID)
```json
{
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "broker_id": null,
  "phone": "+15551234567",
  "error": "Broker calendar not connected. Please book manually.",
  "error_type": "str",
  "requested_time": "Thursday at 3 PM",
  "notes": null,
  "timestamp": "2025-01-15T14:30:00.000000",
  "source": "signalwire_agent"
}
```

---

## cURL Test Command

```bash
curl -X POST https://n8n.instaroute.com/webhook/sw_manual_booking \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "550e8400-e29b-41d4-a716-446655440000",
    "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
    "phone": "+15551234567",
    "error": "Nylas API error: 500 - Internal Server Error",
    "error_type": "str",
    "requested_time": "Tuesday at 2 PM",
    "notes": "Lead prefers afternoon appointments",
    "timestamp": "2025-01-15T14:30:00.000000",
    "source": "signalwire_agent"
  }'
```

---

## PowerShell Test Command

```powershell
$payload = @{
    lead_id = "550e8400-e29b-41d4-a716-446655440000"
    broker_id = "6a3c5ed5-664a-4e13-b019-99fe8db74174"
    phone = "+15551234567"
    error = "Nylas API error: 500 - Internal Server Error"
    error_type = "str"
    requested_time = "Tuesday at 2 PM"
    notes = "Lead prefers afternoon appointments"
    timestamp = "2025-01-15T14:30:00.000000"
    source = "signalwire_agent"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://n8n.instaroute.com/webhook/sw_manual_booking" `
    -Method Post `
    -Body $payload `
    -ContentType "application/json"
```

---

## Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `lead_id` | string (UUID) | Lead's unique identifier | `"550e8400-e29b-41d4-a716-446655440000"` |
| `broker_id` | string (UUID) or null | Broker's unique identifier | `"6a3c5ed5-664a-4e13-b019-99fe8db74174"` |
| `phone` | string | Lead's phone number | `"+15551234567"` |
| `error` | string | Error message | `"Nylas API error: 500"` |
| `error_type` | string | Type of error (always "str" currently) | `"str"` |
| `requested_time` | string or null | Preferred appointment time | `"Tuesday at 2 PM"` |
| `notes` | string or null | Additional notes from conversation | `"Lead prefers afternoon"` |
| `timestamp` | string (ISO 8601) | When the error occurred | `"2025-01-15T14:30:00.000000"` |
| `source` | string | Source system (always "signalwire_agent") | `"signalwire_agent"` |

---

## Notes

- All UUIDs should be valid UUID v4 format
- Phone numbers can be in any format (will be normalized)
- `broker_id` can be `null` if broker not assigned
- `notes` can be `null` if no notes provided
- `timestamp` is in ISO 8601 format (UTC)
- Webhook has 10-second timeout in code

