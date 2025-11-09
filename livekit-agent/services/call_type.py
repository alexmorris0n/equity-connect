"""Call type detection service"""
from typing import Optional, Dict, Any
from services.supabase import get_lead_by_phone
import logging

logger = logging.getLogger(__name__)

async def detect_call_type(
    direction: str,
    caller_phone: Optional[str] = None,
    called_phone: Optional[str] = None,
    lead_id: Optional[str] = None
) -> str:
    """
    Detect call type based on direction and lead qualification
    
    Args:
        direction: 'inbound' or 'outbound'
        caller_phone: Phone number of caller (for inbound: lead's phone)
        called_phone: Phone number called (for outbound: lead's phone)
        lead_id: Optional lead ID if already known
    
    Returns:
        Call type: 'inbound-qualified', 'inbound-unqualified', 'inbound-unknown',
                   'outbound-warm', 'outbound-cold'
    """
    if direction == 'inbound':
        # For inbound, caller_phone is the lead's phone
        lead_phone = caller_phone
    elif direction == 'outbound':
        # For outbound, called_phone is the lead's phone
        lead_phone = called_phone
    else:
        logger.warning(f"⚠️ Unknown direction: {direction}, defaulting to inbound-unknown")
        return 'inbound-unknown'
    
    # Look up lead if we have a phone number
    lead = None
    if lead_phone:
        lead = await get_lead_by_phone(lead_phone)
    elif lead_id:
        # If we have lead_id, we could fetch directly, but for now use phone lookup
        # This could be optimized later
        pass
    
    if direction == 'inbound':
        if lead:
            if lead.get('qualified') is True:
                logger.info(f"✅ Lead found and qualified - using inbound-qualified prompt")
                return 'inbound-qualified'
            else:
                logger.info(f"✅ Lead found but not qualified - using inbound-unqualified prompt")
                return 'inbound-unqualified'
        else:
            logger.info(f"⚠️ Lead not found in system - using inbound-unknown prompt")
            return 'inbound-unknown'
    
    elif direction == 'outbound':
        if lead:
            logger.info(f"✅ Lead found in system - using outbound-warm prompt")
            return 'outbound-warm'
        else:
            logger.info(f"⚠️ Lead not found in system - using outbound-cold prompt")
            return 'outbound-cold'
    
    # Fallback
    return 'inbound-unknown'

