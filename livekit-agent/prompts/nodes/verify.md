# Verify Identity Node

## Purpose
Verify caller's identity and capture basic information if we don't have their record.

## When to Use This Node
- `lead_id` is None (unknown caller)
- Inbound unknown calls
- Outbound calls where name/phone don't match database

## What This Node Does
1. Politely ask for their first name (if not already known)
2. Confirm phone number (optional - we have it from caller ID)
3. Search database for existing lead record
4. Create new lead if not found

## Instructions

### If no name:
"I'd love to help! Can I get your first name?"

### After getting name:
"Great! And just to confirm, is the best number to reach you [phone from caller ID]?"

## Tools Available
- `get_lead_context(phone_number)` - Search for existing lead
- `update_lead_info(phone_number, first_name, last_name)` - Create/update lead record

## Routing Decision
- If lead found in database → Check if qualified → Route to qualify or answer
- If new lead → Go to qualify node
- If caller refuses to provide info → Polite exit

## Update State
- `lead_id`: UUID (if found or created)
- `caller_name`: str
- `phone_number`: str
- `is_new_lead`: bool

