"""Reverse mortgage calculation tool"""
from typing import Optional
import logging

logger = logging.getLogger(__name__)


async def calculate_reverse_mortgage(
    property_value: float,
    age: int,
    equity: Optional[float] = None,
    mortgage_balance: Optional[float] = None
) -> str:
    """
    Calculate reverse mortgage loan amounts (lump sum and monthly payment estimates).
    
    This tool uses HECM (Home Equity Conversion Mortgage) calculation principles:
    - Available funds typically range from 50-60% of equity
    - Age factor: older borrowers qualify for higher percentages
    - Interest rate assumptions: uses current market rates (simplified)
    
    CRITICAL: Always use this tool for calculations - never estimate or guess amounts.
    
    Args:
        property_value: Current estimated home value (required)
        age: Borrower age (must be 62+, required)
        equity: Estimated equity amount (if not provided, calculated from property_value - mortgage_balance)
        mortgage_balance: Current mortgage balance (used to calculate equity if equity not provided)
    
    Returns:
        JSON string with:
        - lump_sum: Estimated lump sum available (one-time disbursement)
        - monthly_payment_20yr: Estimated monthly payment over 20 years
        - monthly_payment_tenure: Estimated monthly payment for lifetime tenure
        - equity_used: Equity amount used in calculation
        - note: Disclaimer about estimates
    """
    import json
    
    try:
        logger.info(f"📊 Calculating reverse mortgage: property_value=${property_value:,.0f}, age={age}, equity={equity}, mortgage_balance={mortgage_balance}")
        
        # Validate age
        if age < 62:
            return json.dumps({
                "error": "Borrower must be 62 or older for reverse mortgage eligibility",
                "lump_sum": 0,
                "monthly_payment_20yr": 0,
                "monthly_payment_tenure": 0
            })
        
        # Calculate equity if not provided
        if equity is None:
            if mortgage_balance is not None:
                equity = max(0, property_value - mortgage_balance)
            else:
                # Assume paid off if no mortgage balance provided
                equity = property_value
        
        if equity <= 0:
            return json.dumps({
                "error": "Insufficient equity - property value must exceed mortgage balance",
                "lump_sum": 0,
                "monthly_payment_20yr": 0,
                "monthly_payment_tenure": 0
            })
        
        # Age-based percentage factor (older = higher percentage)
        # Base: 50% for age 62, increases to ~60% for age 80+
        age_factor = 0.50 + min(0.10, (age - 62) * 0.005)  # 0.5% per year over 62, max 60%
        
        # Cap property value at FHA maximum (~$1,149,000 for 2025)
        fha_max = 1149000
        capped_value = min(property_value, fha_max)
        
        # Adjust equity if property value was capped
        if property_value > fha_max:
            equity_ratio = equity / property_value
            equity = capped_value * equity_ratio
        
        # Calculate available loan amount (principal limit)
        # Use conservative estimate: age_factor * equity
        available_loan = equity * age_factor
        
        # Apply FHA insurance and closing cost estimates (typically 2-4% of property value)
        # These are rolled into the loan, reducing net proceeds
        estimated_costs = capped_value * 0.03  # ~3% for insurance + closing costs
        net_lump_sum = max(0, available_loan - estimated_costs)
        
        # Calculate monthly payment options
        # Assumes ~5% interest rate (simplified - actual rates vary)
        interest_rate = 0.05
        monthly_rate = interest_rate / 12
        
        # 20-year term payment
        if net_lump_sum > 0:
            months_20yr = 20 * 12
            if monthly_rate > 0:
                monthly_payment_20yr = net_lump_sum * (monthly_rate * (1 + monthly_rate) ** months_20yr) / ((1 + monthly_rate) ** months_20yr - 1)
            else:
                monthly_payment_20yr = net_lump_sum / months_20yr
            
            # Tenure payment (lifetime) - simplified: uses life expectancy estimate
            # Average life expectancy at age 65-75 is ~15-20 years
            life_expectancy_years = max(15, 85 - age)  # Conservative estimate
            months_tenure = life_expectancy_years * 12
            if monthly_rate > 0:
                monthly_payment_tenure = net_lump_sum * (monthly_rate * (1 + monthly_rate) ** months_tenure) / ((1 + monthly_rate) ** months_tenure - 1)
            else:
                monthly_payment_tenure = net_lump_sum / months_tenure
        else:
            monthly_payment_20yr = 0
            monthly_payment_tenure = 0
        
        result = {
            "lump_sum": round(net_lump_sum, 0),
            "monthly_payment_20yr": round(monthly_payment_20yr, 0),
            "monthly_payment_tenure": round(monthly_payment_tenure, 0),
            "equity_used": round(equity, 0),
            "property_value": round(property_value, 0),
            "age": age,
            "note": "These are ESTIMATES only. Actual amounts depend on current interest rates, FHA limits, property appraisal, and lender requirements. Your broker will provide exact figures after full qualification."
        }
        
        logger.info(f"✅ Calculation complete: lump_sum=${result['lump_sum']:,.0f}, monthly_20yr=${result['monthly_payment_20yr']:,.0f}")
        
        return json.dumps(result)
        
    except Exception as e:
        logger.error(f"❌ Error calculating reverse mortgage: {e}", exc_info=True)
        return json.dumps({
            "error": str(e),
            "lump_sum": 0,
            "monthly_payment_20yr": 0,
            "monthly_payment_tenure": 0,
            "note": "Unable to calculate at this time. Please consult with your broker for exact figures."
        })

