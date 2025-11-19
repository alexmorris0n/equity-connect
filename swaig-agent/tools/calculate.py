"""
Reverse mortgage calculation tool
Accurate math, no hallucination
"""

from typing import Dict, Any
from services.database import get_conversation_state, update_conversation_state
import logging

logger = logging.getLogger(__name__)


async def handle_calculate(caller_id: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate available reverse mortgage funds
    Uses standard HECM calculation (50-60% of equity based on age)
    """
    phone = caller_id.replace('+1', '').replace('+', '')
    
    property_value = args.get('property_value', 0)
    age = args.get('age', 0)
    equity = args.get('equity', property_value)  # Default to property value if equity not provided
    
    if not property_value or not age:
        return {
            "response": "I need both property value and age to calculate. Could you provide those?"
        }
    
    # Validate inputs
    if age < 62:
        return {
            "response": "To qualify for a reverse mortgage, you must be at least 62 years old."
        }
    
    if property_value <= 0:
        return {
            "response": "Please provide a valid property value."
        }
    
    # Calculate based on age (standard HECM formula approximation)
    # Age 62: ~50% of equity
    # Age 80+: ~60% of equity
    # Linear interpolation between
    
    if age >= 80:
        percentage = 0.60
    elif age >= 62:
        # Linear interpolation: 50% at 62, 60% at 80
        percentage = 0.50 + ((age - 62) / 18) * 0.10
    else:
        percentage = 0.50
    
    # Calculate available amount
    available_amount = int(equity * percentage)
    
    # Calculate monthly payment option (if they take as monthly payments)
    # Assuming 20-year payout
    monthly_payment = int(available_amount / 240)  # 20 years = 240 months
    
    # Format response
    response = (
        f"Based on a property value of ${property_value:,} and your age of {age}, "
        f"you could access approximately ${available_amount:,} as a lump sum, "
        f"or about ${monthly_payment:,} per month over 20 years. "
        f"This is an estimate only - actual amounts depend on interest rates and other factors."
    )
    
    # Update conversation state
    await update_conversation_state(phone, {
        "conversation_data": {
            "quote_presented": True,
            "estimated_lump_sum": available_amount,
            "estimated_monthly": monthly_payment,
            "quote_reaction": "positive"  # Default to positive
        }
    })
    
    logger.info(f"[CALCULATE] Calculated ${available_amount:,} for {phone}")
    
    return {
        "response": response,
        "action": [{
            "set_meta_data": {
                "quote_presented": True,
                "estimated_amount": available_amount
            }
        }]
    }

