import re
from typing import Any
from datetime import datetime, timezone

import requests
from flask import current_app

from app import db
from app.models import SmsLog, SmsOutbox


def log_incoming_sms(sender: str, shortcode: str | None, message: str):
    log = SmsLog(
        direction="inbound",
        sender=sender,
        recipient=shortcode or "22141",
        message=message,
        shortcode=shortcode or "22141",
        status="received",
    )
    db.session.add(log)
    db.session.commit()
    return log


def log_outgoing_sms(recipient: str, message: str, sender_id: str = "22141", status: str = "pending"):
    log = SmsLog(
        direction="outbound",
        sender=sender_id,
        recipient=recipient,
        message=message,
        shortcode=sender_id,
        status=status,
    )
    db.session.add(log)
    db.session.commit()
    return log


def queue_sms(recipient: str, message: str, sender_id: str = "22141"):
    outbox = SmsOutbox(
        recipient=recipient,
        message=message,
        sender_id=sender_id,
        status="pending",
    )
    db.session.add(outbox)

    # Also log to SmsLog so queued messages are visible in logs
    log = SmsLog(
        direction="outbound",
        sender=sender_id,
        recipient=recipient,
        message=message,
        shortcode=sender_id,
        status="queued",
    )
    db.session.add(log)
    db.session.commit()
    return outbox


def mark_outbox_sent(outbox_id: int):
    outbox = db.session.get(SmsOutbox, outbox_id)
    if not outbox:
        return None

    outbox.status = "sent"
    outbox.sent_at = datetime.now(timezone.utc)
    db.session.commit()
    return outbox


def normalize_phone_number(phone: str | None) -> str | None:
    """
    Normalize Kenyan phone numbers to 07XXXXXXXX format (10 digits).
    Examples:
    - 254700000001  -> 0700000001
    - +254700000001 -> 0700000001
    - 700000001     -> 0700000001
    - 0700000001    -> 0700000001
    """
    if not phone:
        return None

    cleaned = re.sub(r"\s+", "", str(phone).strip())
    cleaned = cleaned.replace("+", "")

    # Already in 0700000001 format
    if cleaned.startswith("0") and len(cleaned) == 10:
        return cleaned

    # 254700000001 -> 0700000001
    if cleaned.startswith("254") and len(cleaned) == 12:
        return f"0{cleaned[3:]}"

    # 700000001 (9 digits, missing leading 0)
    if (cleaned.startswith("7") or cleaned.startswith("1")) and len(cleaned) == 9:
        return f"0{cleaned}"

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

    return (
        normalize_phone_number(sender),
        str(message).strip() if message is not None else None,
        shortcode,
    )


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

    # Log outgoing SMS after successful send
    log_outgoing_sms(
        recipient=msisdn,
        message=text,
        sender_id=sender_id or "22141",
        status="sent",
    )

    try:
        return response.json()
    except ValueError:
        return {"raw_response": response.text, "status_code": response.status_code}
