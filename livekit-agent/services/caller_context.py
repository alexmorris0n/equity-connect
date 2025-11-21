"""Caller context formatter for LiveKit prompts."""

from typing import Any, Dict, Optional


def _format_money(value: Any) -> Optional[str]:
    """Format numeric currency values safely."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return f"${number:,.0f}"


def build_caller_context_block(
    lead_context: Optional[Dict[str, Any]],
    phone_number: Optional[str] = None,
    call_type: str = "inbound",
) -> str:
    """Build a caller-context block similar to the SW agent prompt."""
    if not lead_context:
        return ""

    lines: list[str] = ["## Caller Information"]

    phone = lead_context.get("phone") or phone_number
    if phone:
        lines.append(f"- Phone: {phone}")

    if lead_context.get("lead_id"):
        lines.append(f"- Lead ID: {lead_context['lead_id']}")

    if call_type:
        lines.append(f"- Call type: {call_type}")

    full_name = (
        lead_context.get("name")
        or " ".join(
            filter(
                None,
                [
                    lead_context.get("first_name"),
                    lead_context.get("last_name"),
                ],
            )
        ).strip()
    )
    if full_name:
        lines.append(f"- Name: {full_name}")

    status = lead_context.get("status")
    if status:
        lines.append(f"- CRM status: {status}")

    qualified = lead_context.get("qualified")
    if qualified is not None:
        flag = "Yes" if qualified else "No"
        lines.append(f"- Qualified: {flag}")

    email = lead_context.get("email") or lead_context.get("primary_email")
    if email:
        lines.append(f"- Email: {email}")

    if lead_context.get("age"):
        lines.append(f"- Age: {lead_context['age']}")

    # Property info
    address = lead_context.get("property_address")
    city = lead_context.get("property_city")
    state = lead_context.get("property_state")
    zip_code = lead_context.get("property_zip")
    if address or city or state or zip_code:
        location_parts = [part for part in [address, city, state, zip_code] if part]
        lines.append(f"- Property: {', '.join(location_parts)}")

    property_value = _format_money(lead_context.get("property_value"))
    equity = _format_money(lead_context.get("estimated_equity"))
    if property_value:
        lines.append(f"- Property value: {property_value}")
    if equity:
        lines.append(f"- Estimated equity: {equity}")

    if lead_context.get("broker_name"):
        broker_line = f"- Assigned broker: {lead_context['broker_name']}"
        if lead_context.get("broker_company"):
            broker_line += f" ({lead_context['broker_company']})"
        lines.append(broker_line)

    if lead_context.get("lookup_error"):
        lines.append(f"- Lookup error: {lead_context['lookup_error']}")

    if lead_context.get("new_caller"):
        lines.append("- Note: No matching CRM record (new caller)")

    if len(lines) == 1:
        return ""

    return "\n".join(lines)

