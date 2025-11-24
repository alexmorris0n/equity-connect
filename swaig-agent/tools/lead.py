"""
Lead management tools
Verify caller identity and update lead information
Compatible with LiveKit agent functions
"""

from typing import Dict, Any
from services.database import get_lead_by_phone, get_conversation_state, update_conversation_state, normalize_phone
import logging

logger = logging.getLogger(__name__)


async def handle_verify_caller_identity(caller_id: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Verify caller identity by name and phone. Creates lead if new.
    Compatible with LiveKit agent verify_caller_identity function.
    """
    phone = normalize_phone(caller_id)
    first_name = args.get('first_name', '').strip()
    
    if not first_name:
        return {
            "response": "I need your first name to verify your identity. What's your first name?",
            "success": False
        }
    
    logger.info(f"[VERIFY] Verifying caller identity: {first_name}, {phone}")
    
    # Get current conversation state
    state = await get_conversation_state(phone)
    if not state:
        return {
            "response": "I couldn't find your call information. Let me connect you with our team.",
            "success": False
        }
    
    # Check if lead exists
    lead = await get_lead_by_phone(phone)
    
    if lead:
        # Lead found - verify identity
        lead_first_name = lead.get('first_name', '').strip()
        
        # Simple name matching (case-insensitive, first name only)
        if lead_first_name.lower() == first_name.lower():
            # Mark as verified
            await update_conversation_state(phone, {
                "conversation_data": {
                    "verified": True,
                    "greeted": True,
                }
            })
            
            logger.info(f"[VERIFY] Identity verified: {first_name} (lead_id: {lead.get('id')})")
            
            return {
                "response": f"Perfect! I have your information here, {first_name}.",
                "success": True,
                "lead_id": str(lead.get('id')),
                "message": f"Verified: {first_name}"
            }
        else:
            # Name doesn't match - might be wrong person
            logger.warning(f"[VERIFY] Name mismatch: DB has '{lead_first_name}', caller said '{first_name}'")
            return {
                "response": f"I have a different name on file. Let me verify - is this {lead_first_name}?",
                "success": False,
                "lead_id": str(lead.get('id'))
            }
    else:
        # Lead not found - create new lead
        from services.database import supabase
        
        try:
            new_lead_response = supabase.table('leads').insert({
                "first_name": first_name,
                "primary_phone": phone,
                "status": "new"
            }).execute()
            
            if new_lead_response.data:
                new_lead_id = str(new_lead_response.data[0]["id"])
                
                # Update conversation state
                await update_conversation_state(phone, {
                    "lead_id": new_lead_id,
                    "conversation_data": {
                        "verified": True,
                        "greeted": True,
                    }
                })
                
                logger.info(f"[VERIFY] New lead created: {first_name} (lead_id: {new_lead_id})")
                
                return {
                    "response": f"Great! I've got you in our system, {first_name}.",
                    "success": True,
                    "lead_id": new_lead_id,
                    "message": f"New lead created: {first_name}"
                }
            else:
                raise Exception("No data returned from insert")
                
        except Exception as e:
            logger.error(f"[VERIFY] Error creating lead: {e}")
            return {
                "response": "I'm having trouble accessing our system. Let me connect you with our team.",
                "success": False
            }


async def handle_update_lead_info(caller_id: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update lead information (name, address, property details, etc.)
    Compatible with LiveKit agent update_lead_info function.
    """
    phone = normalize_phone(caller_id)
    
    # Get lead
    lead = await get_lead_by_phone(phone)
    if not lead:
        return {
            "response": "I couldn't find your information. Let me verify your identity first.",
            "success": False
        }
    
    lead_id = lead.get('id')
    
    # Build update payload (only include provided fields)
    update_data = {}
    
    if 'first_name' in args and args['first_name']:
        update_data['first_name'] = args['first_name']
    if 'last_name' in args and args['last_name']:
        update_data['last_name'] = args['last_name']
    if 'property_address' in args and args['property_address']:
        update_data['property_address'] = args['property_address']
    if 'property_city' in args and args['property_city']:
        update_data['property_city'] = args['property_city']
    if 'property_state' in args and args['property_state']:
        update_data['property_state'] = args['property_state']
    if 'property_zip' in args and args['property_zip']:
        update_data['property_zip'] = args['property_zip']
    if 'age' in args and args['age']:
        update_data['age'] = int(args['age'])
    if 'property_value' in args and args['property_value']:
        update_data['property_value'] = float(args['property_value'])
    if 'estimated_equity' in args and args['estimated_equity']:
        update_data['estimated_equity'] = float(args['estimated_equity'])
    
    if not update_data:
        return {
            "response": "I didn't receive any information to update. What would you like to update?",
            "success": False
        }
    
    # Update lead in database
    from services.database import supabase
    
    try:
        update_response = supabase.table('leads')\
            .update(update_data)\
            .eq('id', lead_id)\
            .execute()
        
        if update_response.data:
            logger.info(f"[UPDATE] Lead {lead_id} updated: {list(update_data.keys())}")
            
            # Also update conversation state if age/equity changed (affects qualification)
            conversation_update = {}
            if 'age' in update_data:
                conversation_update['age'] = update_data['age']
            if 'estimated_equity' in update_data:
                conversation_update['estimated_equity'] = update_data['estimated_equity']
            
            if conversation_update:
                await update_conversation_state(phone, {
                    "conversation_data": conversation_update
                })
            
            return {
                "response": "I've updated your information. Is there anything else you'd like to change?",
                "success": True,
                "lead_id": str(lead_id),
                "updated_fields": list(update_data.keys())
            }
        else:
            raise Exception("No data returned from update")
            
    except Exception as e:
        logger.error(f"[UPDATE] Error updating lead: {e}")
        return {
            "response": "I'm having trouble updating your information. Let me connect you with our team.",
            "success": False
        }

