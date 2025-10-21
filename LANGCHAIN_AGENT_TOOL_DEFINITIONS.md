# LangChain Agent - Barbara MCP Tool Definitions

## Quick Copy-Paste for LangChain Agent

### Tool Definitions (Python/JavaScript)

```python
# Python - LangChain Tool Definitions

from langchain.tools import Tool

tools = [
    Tool(
        name="check_broker_availability",
        description="""
        Check broker calendar availability using Nylas API.
        
        Required inputs:
        - broker_id: UUID of the broker (e.g., "6a3c5ed5-664a-4e13-b019-99fe8db74174")
        
        Optional inputs:
        - preferred_day: "monday", "tuesday", "wednesday", "thursday", "friday", or "any" (default: "any")
        - preferred_time: "morning", "afternoon", or "any" (default: "any")
        
        Returns: List of available time slots for next 14 days.
        Business hours: 10 AM - 5 PM, minimum 2 hours notice.
        Prioritizes: today > tomorrow > next week.
        
        Example input: {"broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174", "preferred_day": "tuesday", "preferred_time": "morning"}
        """,
        func=lambda args: call_mcp_tool("check_broker_availability", args)
    ),
    
    Tool(
        name="book_appointment",
        description="""
        Book an appointment with a broker via Nylas Calendar API.
        
        IMPORTANT: Always check availability FIRST before booking.
        
        Required inputs:
        - lead_id: UUID of the lead
        - broker_id: UUID of the broker
        - scheduled_for: ISO 8601 datetime (e.g., "2025-10-22T10:00:00Z")
        
        Optional inputs:
        - notes: Additional notes about the appointment
        
        Creates calendar event on broker's calendar.
        Sends calendar invite to lead if email exists.
        
        Example input: {"lead_id": "abc-123", "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174", "scheduled_for": "2025-10-22T10:00:00Z", "notes": "Qualified lead"}
        """,
        func=lambda args: call_mcp_tool("book_appointment", args)
    ),
    
    Tool(
        name="update_lead_info",
        description="""
        Update lead contact information in database.
        
        Required inputs:
        - lead_id: UUID of the lead
        
        Optional inputs (provide only fields to update):
        - primary_phone: Phone number (E.164 format)
        - primary_email: Email address
        - first_name: First name
        - last_name: Last name
        - city: City
        - state: State (2-letter code)
        - zipcode: ZIP code
        - age: Age (number)
        - property_value: Property value (number)
        - mortgage_balance: Mortgage balance (number)
        
        Only include fields you want to change.
        
        Example input: {"lead_id": "abc-123", "primary_email": "john@example.com", "last_name": "Smith"}
        """,
        func=lambda args: call_mcp_tool("update_lead_info", args)
    ),
    
    Tool(
        name="create_outbound_call",
        description="""
        Create an outbound call to a lead using Barbara AI voice assistant.
        
        Required inputs:
        - to_phone: Phone number to call (E.164 format)
        - lead_id: UUID of the lead
        
        Optional inputs:
        - broker_id: UUID of the broker (uses lead's assigned broker if not provided)
        - lead_first_name, lead_last_name: Lead name
        - property_city, property_value: Property info
        - estimated_equity: Equity amount
        - broker_full_name, broker_company: Broker info
        
        Barbara will personalize the call based on provided information.
        
        Example input: {"to_phone": "+16505300051", "lead_id": "abc-123", "lead_first_name": "John", "property_city": "San Francisco"}
        """,
        func=lambda args: call_mcp_tool("create_outbound_call", args)
    )
]

def call_mcp_tool(tool_name, arguments):
    """Call Barbara MCP tool via HTTP"""
    import requests
    
    response = requests.post(
        "https://your-barbara-mcp.example.com/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
    )
    
    result = response.json()
    if "result" in result and "content" in result["result"]:
        return result["result"]["content"][0]["text"]
    elif "error" in result:
        return f"Error: {result['error']['message']}"
    else:
        return str(result)
```

---

## OpenAI Function Calling Format

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "check_broker_availability",
        "description": "Check broker calendar availability using Nylas API. Returns available time slots for next 14 days. Business hours: 10 AM - 5 PM, 2-hour minimum notice.",
        "parameters": {
          "type": "object",
          "properties": {
            "broker_id": {
              "type": "string",
              "description": "UUID of the broker"
            },
            "preferred_day": {
              "type": "string",
              "enum": ["any", "monday", "tuesday", "wednesday", "thursday", "friday"],
              "description": "Preferred day of week (optional)"
            },
            "preferred_time": {
              "type": "string",
              "enum": ["any", "morning", "afternoon"],
              "description": "Preferred time of day. Morning = 10 AM-12 PM, Afternoon = 12 PM-5 PM (optional)"
            }
          },
          "required": ["broker_id"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "book_appointment",
        "description": "Book an appointment with a broker. IMPORTANT: Always check availability FIRST. Creates calendar event and sends invite to lead if email exists.",
        "parameters": {
          "type": "object",
          "properties": {
            "lead_id": {
              "type": "string",
              "description": "UUID of the lead"
            },
            "broker_id": {
              "type": "string",
              "description": "UUID of the broker"
            },
            "scheduled_for": {
              "type": "string",
              "description": "ISO 8601 datetime (e.g., '2025-10-22T10:00:00Z')"
            },
            "notes": {
              "type": "string",
              "description": "Optional notes about the appointment"
            }
          },
          "required": ["lead_id", "broker_id", "scheduled_for"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "update_lead_info",
        "description": "Update lead contact information. Only include fields you want to update.",
        "parameters": {
          "type": "object",
          "properties": {
            "lead_id": {
              "type": "string",
              "description": "UUID of the lead"
            },
            "primary_phone": {
              "type": "string",
              "description": "Phone number (E.164 format)"
            },
            "primary_email": {
              "type": "string",
              "description": "Email address"
            },
            "first_name": {
              "type": "string",
              "description": "First name"
            },
            "last_name": {
              "type": "string",
              "description": "Last name"
            },
            "city": {
              "type": "string",
              "description": "City"
            },
            "state": {
              "type": "string",
              "description": "State (2-letter code)"
            },
            "zipcode": {
              "type": "string",
              "description": "ZIP code"
            },
            "age": {
              "type": "number",
              "description": "Age"
            },
            "property_value": {
              "type": "number",
              "description": "Property value"
            },
            "mortgage_balance": {
              "type": "number",
              "description": "Mortgage balance"
            }
          },
          "required": ["lead_id"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "create_outbound_call",
        "description": "Create an outbound call to a lead using Barbara AI voice assistant with personalization.",
        "parameters": {
          "type": "object",
          "properties": {
            "to_phone": {
              "type": "string",
              "description": "Phone number to call (E.164 format)"
            },
            "lead_id": {
              "type": "string",
              "description": "UUID of the lead"
            },
            "broker_id": {
              "type": "string",
              "description": "UUID of the broker (optional, uses lead's assigned broker if not provided)"
            },
            "lead_first_name": {
              "type": "string",
              "description": "Lead's first name for personalization"
            },
            "property_city": {
              "type": "string",
              "description": "Property city for personalization"
            },
            "estimated_equity": {
              "type": "string",
              "description": "Estimated equity amount"
            }
          },
          "required": ["to_phone", "lead_id"]
        }
      }
    }
  ]
}
```

---

## Agent System Prompt (Copy-Paste Ready)

```
You are a helpful AI assistant for a reverse mortgage lead management system. You can help book appointments, check broker availability, update lead information, and create outbound calls.

IMPORTANT RULES:
1. ALWAYS check broker availability BEFORE booking appointments
2. Use ISO 8601 format for dates: "2025-10-22T10:00:00Z" (year-month-dayTHH:MM:SSZ)
3. Only book times that were returned as available from check_broker_availability
4. Verify the lead has an email address before booking (for calendar invite)
5. If the lead is missing critical info (email, phone, name), update it first using update_lead_info

WORKFLOW FOR BOOKING APPOINTMENTS:
1. Call check_broker_availability with broker_id and preferences
2. Present available times to the user
3. Once user confirms a time, call book_appointment
4. Confirm the booking and let user know if calendar invite was sent

EXAMPLE CONVERSATION:
User: "Book John Smith for Tuesday morning with Walter"

You should:
1. Call check_broker_availability(broker_id="6a3c5ed5-664a-4e13-b019-99fe8db74174", preferred_day="tuesday", preferred_time="morning")
2. Review the available slots returned
3. Call book_appointment with the earliest available slot
4. Respond: "Appointment booked for Tuesday, October 22 at 10:00 AM. Calendar invite sent to john@example.com."

Remember: Always be helpful and confirm actions with the user before booking.
```

---

## Quick Test Prompts

### Test 1: Check Availability
```
User: "Check Walter's availability for Tuesday morning"

Expected Agent Action:
check_broker_availability({
  "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174",
  "preferred_day": "tuesday",
  "preferred_time": "morning"
})
```

### Test 2: Book Appointment
```
User: "Book John Smith (ID: abc-123) for Tuesday Oct 22 at 10 AM with Walter"

Expected Agent Actions:
1. check_broker_availability({"broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174", "preferred_day": "tuesday", "preferred_time": "morning"})
2. book_appointment({"lead_id": "abc-123", "broker_id": "6a3c5ed5-664a-4e13-b019-99fe8db74174", "scheduled_for": "2025-10-22T10:00:00Z"})
```

### Test 3: Update Lead Info
```
User: "Update John's email to john.smith@gmail.com (Lead ID: abc-123)"

Expected Agent Action:
update_lead_info({
  "lead_id": "abc-123",
  "primary_email": "john.smith@gmail.com"
})
```

### Test 4: Create Call
```
User: "Call John Smith at +16505300051 (Lead ID: abc-123)"

Expected Agent Action:
create_outbound_call({
  "to_phone": "+16505300051",
  "lead_id": "abc-123"
})
```

---

## Environment Setup

```bash
# MCP Endpoint
BARBARA_MCP_URL=https://your-barbara-mcp.example.com/mcp

# Example broker_id (Walter Richards)
WALTER_BROKER_ID=6a3c5ed5-664a-4e13-b019-99fe8db74174
```

---

## Common Patterns

### Pattern 1: Check & Book
```
1. check_broker_availability → Get slots
2. book_appointment → Book confirmed slot
```

### Pattern 2: Update & Book
```
1. update_lead_info → Ensure email exists
2. check_broker_availability → Get slots
3. book_appointment → Book with calendar invite
```

### Pattern 3: Update & Call
```
1. update_lead_info → Update contact info
2. create_outbound_call → Make AI call
```

**Ready to integrate with any LangChain agent!** 🎯
