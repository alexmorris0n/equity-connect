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
) -> Dict[str, Any]:
    """
    Detect call type based on direction and lead qualification
    
    Args:
        direction: 'inbound' or 'outbound'
        caller_phone: Phone number of caller (for inbound: lead's phone)
        called_phone: Phone number called (for outbound: lead's phone)
        lead_id: Optional lead ID if already known
    
    Returns:
        Dict with: call_type, lead, broker
    """
    if direction == 'inbound':
        # For inbound, caller_phone is the lead's phone
        lead_phone = caller_phone
    elif direction == 'outbound':
        # For outbound, called_phone is the lead's phone
        lead_phone = called_phone
    else:
        logger.warning(f"⚠️ Unknown direction: {direction}, defaulting to inbound-unknown")
        return {"call_type": "inbound-unknown", "lead": None, "broker": None}
    
    # Look up lead if we have a phone number
    lead = None
    broker = None
    if lead_phone:
        lead = await get_lead_by_phone(lead_phone)
        # Extract broker if lead has assigned_broker_id
        if lead and lead.get('assigned_broker_id'):
            broker = lead.get('brokers')  # Broker data from join query
    elif lead_id:
        # If we have lead_id, we could fetch directly, but for now use phone lookup
        # This could be optimized later
        pass
    
    if direction == 'inbound':
        if lead:
            if lead.get('qualified') is True:
                logger.info(f"✅ Lead found and qualified - using inbound-qualified prompt")
                return {"call_type": "inbound-qualified", "lead": lead, "broker": broker}
            else:
                logger.info(f"✅ Lead found but not qualified - using inbound-unqualified prompt")
                return {"call_type": "inbound-unqualified", "lead": lead, "broker": broker}
        else:
            logger.info(f"⚠️ Lead not found in system - using inbound-unknown prompt")
            return {"call_type": "inbound-unknown", "lead": None, "broker": None}
    
    elif direction == 'outbound':
        if lead:
            logger.info(f"✅ Lead found in system - using outbound-warm prompt")
            return {"call_type": "outbound-warm", "lead": lead, "broker": broker}
        else:
            logger.info(f"⚠️ Lead not found in system - using outbound-cold prompt")
            return {"call_type": "outbound-cold", "lead": None, "broker": None}
    
    # Fallback
    return {"call_type": "inbound-unknown", "lead": None, "broker": None}

