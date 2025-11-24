"""
Granular verification tools for SignalWire
Updates phone_verified, email_verified, address_verified in leads table

Matches LiveKit's verification system for backwards compatibility
"""

from typing import Dict, Any
from services.database import get_lead_by_phone, update_conversation_state
from supabase import create_client
import os
import logging

logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

supabase = create_client(supabase_url, supabase_key)


async def _check_and_set_verified(phone: str) -> None:
    """
    If all three verifications (phone/email/address) are true in leads,
    set conversation_state.conversation_data.verified = True
    """
    lead = await get_lead_by_phone(phone)
    if not lead:
        return
    # Consider verified if all three granular flags are true
    phone_ok = bool(lead.get('phone_verified', False))
    email_ok = bool(lead.get('email_verified', False))
    address_ok = bool(lead.get('address_verified', False))
    if phone_ok and email_ok and address_ok:
        await update_conversation_state(phone, {
            "conversation_data": {
                "verified": True
            }
        })


async def mark_phone_verified(caller_id: str) -> Dict[str, Any]:
    """
    Mark the caller's phone number as verified in the leads table.
    
    This updates leads.phone_verified = TRUE, which triggers the database
    trigger to recompute leads.verified.
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    try:
        # Get lead by phone
        lead = await get_lead_by_phone(phone)
        if not lead:
            return {
                "response": "Could not find lead to mark phone as verified.",
                "action": []
            }
        
        lead_id = lead.get('id')
        
        # Update leads table
        supabase.table('leads').update({
            'phone_verified': True
        }).eq('id', lead_id).execute()
        
        logger.info(f"[VERIFICATION] Phone marked as verified for lead {lead_id}")
        
        # If all three are now verified, set conversation state flag
        await _check_and_set_verified(phone)
        
        return {
            "response": "Phone number marked as verified.",
            "action": []
        }
    
    except Exception as e:
        logger.error(f"[VERIFICATION] Error marking phone verified: {e}")
        return {
            "response": f"Error verifying phone: {str(e)}",
            "action": []
        }


async def mark_email_verified(caller_id: str) -> Dict[str, Any]:
    """
    Mark the caller's email address as verified in the leads table.
    
    This updates leads.email_verified = TRUE, which triggers the database
    trigger to recompute leads.verified.
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    try:
        # Get lead by phone
        lead = await get_lead_by_phone(phone)
        if not lead:
            return {
                "response": "Could not find lead to mark email as verified.",
                "action": []
            }
        
        lead_id = lead.get('id')
        
        # Update leads table
        supabase.table('leads').update({
            'email_verified': True
        }).eq('id', lead_id).execute()
        
        logger.info(f"[VERIFICATION] Email marked as verified for lead {lead_id}")
        
        # If all three are now verified, set conversation state flag
        await _check_and_set_verified(phone)
        
        return {
            "response": "Email address marked as verified.",
            "action": []
        }
    
    except Exception as e:
        logger.error(f"[VERIFICATION] Error marking email verified: {e}")
        return {
            "response": f"Error verifying email: {str(e)}",
            "action": []
        }


async def mark_address_verified(caller_id: str) -> Dict[str, Any]:
    """
    Mark the caller's property address as verified in the leads table.
    
    This updates leads.address_verified = TRUE, which triggers the database
    trigger to recompute leads.verified.
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    try:
        # Get lead by phone
        lead = await get_lead_by_phone(phone)
        if not lead:
            return {
                "response": "Could not find lead to mark address as verified.",
                "action": []
            }
        
        lead_id = lead.get('id')
        
        # Update leads table
        supabase.table('leads').update({
            'address_verified': True
        }).eq('id', lead_id).execute()
        
        logger.info(f"[VERIFICATION] Address marked as verified for lead {lead_id}")
        
        # If all three are now verified, set conversation state flag
        await _check_and_set_verified(phone)
        
        return {
            "response": "Property address marked as verified.",
            "action": []
        }
    
    except Exception as e:
        logger.error(f"[VERIFICATION] Error marking address verified: {e}")
        return {
            "response": f"Error verifying address: {str(e)}",
            "action": []
        }






