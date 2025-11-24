"""
Granular qualification tools for SignalWire
Updates age_qualified, homeowner_qualified, primary_residence_qualified, equity_qualified in leads table

Matches LiveKit's qualification system for backwards compatibility
"""

from typing import Dict, Any
from services.database import get_lead_by_phone
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


async def mark_age_qualified(caller_id: str) -> Dict[str, Any]:
    """
    Mark that the caller is 62+ years old (FHA requirement for reverse mortgages).
    
    This updates leads.age_qualified = TRUE, which triggers the database
    trigger to recompute leads.qualified.
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    try:
        # Get lead by phone
        lead = await get_lead_by_phone(phone)
        if not lead:
            return {
                "response": "Could not find lead to mark age as qualified.",
                "action": []
            }
        
        lead_id = lead.get('id')
        
        # Update leads table
        supabase.table('leads').update({
            'age_qualified': True
        }).eq('id', lead_id).execute()
        
        logger.info(f"[QUALIFICATION] Age marked as qualified for lead {lead_id}")
        
        return {
            "response": "Age requirement confirmed (62+).",
            "action": []
        }
    
    except Exception as e:
        logger.error(f"[QUALIFICATION] Error marking age as qualified: {e}")
        return {
            "response": f"Error confirming age: {str(e)}",
            "action": []
        }


async def mark_homeowner_qualified(caller_id: str) -> Dict[str, Any]:
    """
    Mark that the caller owns the property.
    
    This updates leads.homeowner_qualified = TRUE, which triggers the database
    trigger to recompute leads.qualified.
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    try:
        # Get lead by phone
        lead = await get_lead_by_phone(phone)
        if not lead:
            return {
                "response": "Could not find lead to mark homeowner as qualified.",
                "action": []
            }
        
        lead_id = lead.get('id')
        
        # Update leads table
        supabase.table('leads').update({
            'homeowner_qualified': True
        }).eq('id', lead_id).execute()
        
        logger.info(f"[QUALIFICATION] Homeowner marked as qualified for lead {lead_id}")
        
        return {
            "response": "Homeownership confirmed.",
            "action": []
        }
    
    except Exception as e:
        logger.error(f"[QUALIFICATION] Error marking homeowner as qualified: {e}")
        return {
            "response": f"Error confirming homeownership: {str(e)}",
            "action": []
        }


async def mark_primary_residence_qualified(caller_id: str) -> Dict[str, Any]:
    """
    Mark that the property is the caller's primary residence (not rental/investment).
    
    This updates leads.primary_residence_qualified = TRUE, which triggers the database
    trigger to recompute leads.qualified.
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    try:
        # Get lead by phone
        lead = await get_lead_by_phone(phone)
        if not lead:
            return {
                "response": "Could not find lead to mark primary residence as qualified.",
                "action": []
            }
        
        lead_id = lead.get('id')
        
        # Update leads table
        supabase.table('leads').update({
            'primary_residence_qualified': True
        }).eq('id', lead_id).execute()
        
        logger.info(f"[QUALIFICATION] Primary residence marked as qualified for lead {lead_id}")
        
        return {
            "response": "Primary residence confirmed.",
            "action": []
        }
    
    except Exception as e:
        logger.error(f"[QUALIFICATION] Error marking primary residence as qualified: {e}")
        return {
            "response": f"Error confirming primary residence: {str(e)}",
            "action": []
        }


async def mark_equity_qualified(caller_id: str) -> Dict[str, Any]:
    """
    Mark that the caller has sufficient equity in the property.
    
    This updates leads.equity_qualified = TRUE, which triggers the database
    trigger to recompute leads.qualified.
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    try:
        # Get lead by phone
        lead = await get_lead_by_phone(phone)
        if not lead:
            return {
                "response": "Could not find lead to mark equity as qualified.",
                "action": []
            }
        
        lead_id = lead.get('id')
        
        # Update leads table
        supabase.table('leads').update({
            'equity_qualified': True
        }).eq('id', lead_id).execute()
        
        logger.info(f"[QUALIFICATION] Equity marked as qualified for lead {lead_id}")
        
        return {
            "response": "Sufficient equity confirmed.",
            "action": []
        }
    
    except Exception as e:
        logger.error(f"[QUALIFICATION] Error marking equity as qualified: {e}")
        return {
            "response": f"Error confirming equity: {str(e)}",
            "action": []
        }






