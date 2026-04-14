import re
from typing import Any

import requests
from flask import current_app


def normalize_phone_number(phone: str | None) -> str | None:
    """
    Normalize Kenyan phone numbers to a consistent format.
    Examples:
    - 0700000001 -> 254700000001
    - 254700000001 -> 254700000001
    - +254700000001 -> 254700000001
    """
    if not phone:
        return None

    cleaned = re.sub(r"\s+", "", str(phone).strip())
    cleaned = cleaned.replace("+", "")

    if cleaned.startswith("254") and len(cleaned) == 12:
        return cleaned

    if cleaned.startswith("0") and len(cleaned) == 10:
        return f"254{cleaned[1:]}"

    return cleaned


def extract_onfon_payload(data: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    """
    Flexible extractor because the exact inbound Onfon callback schema
    may vary by account setup/provider mapping.
    """
    sender = (
        data.get("sender")
        or data.get("from")
        or data.get("msisdn")
        or data.get("mobile")
        or data.get("source_addr")
    )

    message = (
        data.get("message")
        or data.get("text")
        or data.get("content")
        or data.get("msg")
        or data.get("body")
    )

    shortcode = (
        data.get("shortcode")
        or data.get("to")
        or data.get("service_code")
        or data.get("destination")
    )

    return normalize_phone_number(sender), str(message).strip() if message is not None else None, shortcode


def send_onfon_sms(msisdn: str, text: str) -> dict[str, Any]:
    """
    Send outbound SMS using Onfon MT SMS API.
    Exact payload keys may need alignment with your Onfon account config.
    """
    api_key = current_app.config.get("ONFON_API_KEY")
    sender_id = current_app.config.get("ONFON_SENDER_ID")
    sms_url = current_app.config.get("ONFON_SMS_URL")

    if not api_key:
        raise RuntimeError("ONFON_API_KEY is not configured")

    payload = {
        "api_key": api_key,
        "sender_id": sender_id,
        "message": text,
        "mobile": msisdn,
    }

    response = requests.post(sms_url, json=payload, timeout=20)
    response.raise_for_status()

    try:
        return response.json()
    except ValueError:
        return {"raw_response": response.text, "status_code": response.status_code}
