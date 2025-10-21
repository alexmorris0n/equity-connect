# Barbara MCP - Tool Calling Guide

## Complete Guide for n8n & LangChain Agents

---

## MCP Endpoint

**Base URL:** `https://your-barbara-mcp.example.com/mcp`  
**Method:** POST  
**Content-Type:** application/json

---

## Standard MCP Request Format

All tool calls use this JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tool_name_here",
    "arguments": {
      // tool-specific parameters
    }
  }
}
```

**Response Format:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Result message here"
      }
    ]
  }
}
```

---

## Tool 1: `check_broker_availability`

### Description
Check broker calendar availability using Nylas Free/Busy API. Returns available time slots for the next 14 days with smart prioritization.

### Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `broker_id` | string | ✅ Yes | Broker UUID | `"6a3c5ed5-664a-4e13-b019-99fe8db74174"` |
| `preferred_day` | string | ❌ No | Day of week | `"tuesday"` (monday, tuesday, wednesday, thursday, friday, any) |
| `preferred_time` | string | ❌ No | Time of day | `"morning"` (morning, afternoon, any) |

### Example Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "check_broker_availability",
    "arguments": {
      "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
      "preferred_day": "tuesday",
      "preferred_time": "morning"
    }
  }
}
```

### Example Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Availability Check Complete\n\n📅 Broker: Walter Richards\n⏰ Available Slots: 3\n💬 I have 3 slots available tomorrow. The earliest is 10:00 AM.\n\n📋 Slots:\n  • Tuesday, Oct 22 at 10:00 AM (TOMORROW)\n  • Tuesday, Oct 22 at 11:00 AM (TOMORROW)\n  • Tuesday, Oct 22 at 2:00 PM (TOMORROW)"
      }
    ]
  }
}
```

### LangChain Agent Prompt

```
Tool: check_broker_availability

Use this tool to check when a broker is available for appointments.

Parameters:
- broker_id (required): The UUID of the broker
- preferred_day (optional): Specific day like "tuesday" or "any"
- preferred_time (optional): "morning", "afternoon", or "any"

Returns: List of available time slots with dates and times.

Example usage:
To check Tuesday morning availability for broker Walter:
{
  "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
  "preferred_day": "tuesday",
  "preferred_time": "morning"
}
```

---

## Tool 2: `book_appointment`

### Description
Book an appointment with a broker using Nylas Events API. Creates calendar event and sends invite to lead if email is available.

### Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `lead_id` | string | ✅ Yes | Lead UUID | `"lead-uuid-123"` |
| `broker_id` | string | ✅ Yes | Broker UUID | `"6a3c5ed5-664a-4e13-b019-99fe8db74174"` |
| `scheduled_for` | string | ✅ Yes | ISO 8601 datetime | `"2025-10-22T10:00:00Z"` |
| `notes` | string | ❌ No | Appointment notes | `"Interested in medical expenses"` |

### Example Request

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "book_appointment",
    "arguments": {
      "lead_id": "abc-123-def-456",
      "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
      "scheduled_for": "2025-10-22T10:00:00Z",
      "notes": "Lead is interested in accessing equity for medical expenses. Qualified with $680K equity."
    }
  }
}
```

### Example Response

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Appointment Booked Successfully!\n\n📅 Time: 10/22/2025, 10:00:00 AM\n👤 Lead ID: abc-123-def-456\n🏢 Broker ID: 6a3c5ed5-664a-4e13-b019-99fe8db74174\n📧 Calendar invite sent: Yes\n📝 Notes: Lead is interested in accessing equity for medical expenses."
      }
    ]
  }
}
```

### LangChain Agent Prompt

```
Tool: book_appointment

Use this tool to book an appointment after checking availability.

Parameters:
- lead_id (required): The UUID of the lead
- broker_id (required): The UUID of the broker
- scheduled_for (required): ISO 8601 date/time (e.g., "2025-10-22T10:00:00Z")
- notes (optional): Notes about the appointment

IMPORTANT: 
- Always check availability FIRST using check_broker_availability
- Use ISO 8601 format for scheduled_for (YYYY-MM-DDTHH:MM:SSZ)
- Only book times that were returned as available

Returns: Confirmation with calendar invite status.

Example usage:
To book Tuesday Oct 22 at 10 AM:
{
  "lead_id": "abc-123",
  "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
  "scheduled_for": "2025-10-22T10:00:00Z",
  "notes": "Qualified lead, $680K equity, medical expenses"
}
```

---

## Tool 3: `update_lead_info`

### Description
Update lead contact information in the database. Can update phone, email, name, address, and qualification details.

### Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `lead_id` | string | ✅ Yes | Lead UUID | `"abc-123-def-456"` |
| `primary_phone` | string | ❌ No | Phone number | `"+16505300051"` |
| `primary_email` | string | ❌ No | Email address | `"john.smith@gmail.com"` |
| `first_name` | string | ❌ No | First name | `"John"` |
| `last_name` | string | ❌ No | Last name | `"Smith"` |
| `city` | string | ❌ No | City | `"San Francisco"` |
| `state` | string | ❌ No | State | `"CA"` |
| `zipcode` | string | ❌ No | ZIP code | `"94102"` |
| `age` | number | ❌ No | Age | `68` |
| `property_value` | number | ❌ No | Property value | `1500000` |
| `mortgage_balance` | number | ❌ No | Mortgage balance | `200000` |

### Example Request

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "update_lead_info",
    "arguments": {
      "lead_id": "abc-123-def-456",
      "primary_email": "john.smith@gmail.com",
      "last_name": "Smith",
      "city": "San Francisco",
      "state": "CA"
    }
  }
}
```

### Example Response

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Lead Info Updated Successfully!\n\n👤 Lead ID: abc-123-def-456\n📝 Updated fields: primary_email, last_name, city, state"
      }
    ]
  }
}
```

### LangChain Agent Prompt

```
Tool: update_lead_info

Use this tool to update lead contact information.

Parameters:
- lead_id (required): The UUID of the lead
- Any of these fields (all optional):
  - primary_phone: Phone number (E.164 format recommended)
  - primary_email: Email address
  - first_name, last_name: Name
  - city, state, zipcode: Address
  - age: Age (number)
  - property_value: Property value (number)
  - mortgage_balance: Mortgage balance (number)

IMPORTANT:
- Only include fields you want to UPDATE
- Don't send fields that aren't changing
- At least one field besides lead_id must be provided

Returns: Confirmation of updated fields.

Example usage:
To update email and last name:
{
  "lead_id": "abc-123",
  "primary_email": "john@example.com",
  "last_name": "Smith"
}
```

---

## Tool 4: `create_outbound_call` (Existing)

### Description
Create an outbound call to a lead using Barbara AI voice assistant.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to_phone` | string | ✅ Yes | Phone number to call |
| `lead_id` | string | ✅ Yes | Lead UUID |
| `broker_id` | string | ❌ No | Broker UUID (uses lead's assigned broker if not provided) |
| Plus 20+ optional personalization fields | | | |

### Example Request

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "create_outbound_call",
    "arguments": {
      "to_phone": "+16505300051",
      "lead_id": "abc-123-def-456",
      "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
      "lead_first_name": "John",
      "lead_last_name": "Smith",
      "property_city": "San Francisco",
      "estimated_equity": "680000"
    }
  }
}
```

---

## Complete Workflow Example

### Scenario: Book an appointment for a lead

**Step 1: Check Availability**
```json
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "check_broker_availability",
    "arguments": {
      "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
      "preferred_day": "tuesday"
    }
  }
}
```

**Step 2: Book Appointment**
```json
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "book_appointment",
    "arguments": {
      "lead_id": "abc-123",
      "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
      "scheduled_for": "2025-10-22T10:00:00Z",
      "notes": "Qualified lead"
    }
  }
}
```

**Step 3: Update Lead Email (for calendar invite)**
```json
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "update_lead_info",
    "arguments": {
      "lead_id": "abc-123",
      "primary_email": "john@example.com"
    }
  }
}
```

---

## LangChain Agent System Prompt

```markdown
You are an AI assistant for a reverse mortgage lead management system. You have access to these tools:

## Available Tools

### 1. check_broker_availability
Check when a broker is available for appointments.
Required: broker_id
Optional: preferred_day (monday-friday, any), preferred_time (morning, afternoon, any)
Returns: List of available time slots

### 2. book_appointment
Book an appointment after checking availability.
Required: lead_id, broker_id, scheduled_for (ISO 8601 format)
Optional: notes
Returns: Confirmation and calendar invite status

### 3. update_lead_info
Update lead contact information.
Required: lead_id
Optional: Any contact fields (email, phone, name, address, etc.)
Returns: Confirmation of updated fields

### 4. create_outbound_call
Create an outbound call to a lead using Barbara AI.
Required: to_phone, lead_id
Optional: broker_id, personalization fields
Returns: Call creation confirmation

## Important Rules

1. ALWAYS check availability BEFORE booking appointments
2. Use ISO 8601 format for dates: "2025-10-22T10:00:00Z"
3. Only book times that were returned as available
4. Verify lead has email before booking (for calendar invite)
5. Update lead info if missing critical data (email, phone, name)

## Example Workflow

User: "Book John Smith for Tuesday morning with Walter"
1. Call check_broker_availability(broker_id="walter-uuid", preferred_day="tuesday", preferred_time="morning")
2. Get available slots: 10 AM, 11 AM
3. Call book_appointment(lead_id="john-uuid", broker_id="walter-uuid", scheduled_for="2025-10-22T10:00:00Z")
4. Confirm: "Appointment booked for Tuesday October 22 at 10 AM. Calendar invite sent."
```

---

## n8n HTTP Request Node Configuration

### URL
```
https://your-barbara-mcp.example.com/mcp
```

### Method
```
POST
```

### Authentication
```
None (or add Authorization header if secured)
```

### Body (JSON)
```json
{
  "jsonrpc": "2.0",
  "id": {{ $json.requestId || 1 }},
  "method": "tools/call",
  "params": {
    "name": "{{ $json.toolName }}",
    "arguments": {{ $json.arguments }}
  }
}
```

### Headers
```
Content-Type: application/json
```

---

## Error Handling

### Error Response Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "❌ Error message here"
      }
    ],
    "isError": true
  }
}
```

### Common Errors

1. **Missing broker_id**: "Broker not found"
2. **Invalid date format**: Use ISO 8601: "2025-10-22T10:00:00Z"
3. **No availability**: "No availability in next 2 weeks"
4. **Missing lead email**: Calendar invite won't be sent (still books)

---

## Testing

### Quick Test with curl

```bash
# Check availability
curl -X POST https://your-barbara-mcp.example.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "check_broker_availability",
      "arguments": {
        "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174"
      }
    }
  }'
```

---

## Summary

**4 Tools Available:**
1. ✅ `check_broker_availability` - Check calendar
2. ✅ `book_appointment` - Book appointment
3. ✅ `update_lead_info` - Update contact info
4. ✅ `create_outbound_call` - Make AI call

**All use standard MCP JSON-RPC 2.0 format**
**All return structured text responses**
**Ready for n8n, LangChain, or any MCP client** 🎯
