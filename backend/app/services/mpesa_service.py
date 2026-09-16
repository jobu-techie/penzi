"""
app/services/mpesa_service.py
M-Pesa Daraja API integration — STK Push + callback processing
All config is read inside functions so .env is always loaded first.
"""

import base64
import logging
import os
import re
import requests
from datetime import datetime

logger = logging.getLogger(__name__)


def _get_base_url() -> str:
    mpesa_env = os.getenv("MPESA_ENV", "sandbox")
    if mpesa_env == "production":
        return "https://api.safaricom.co.ke"
    return "https://sandbox.safaricom.co.ke"


def get_access_token() -> str:
    """Fetch a fresh OAuth token from Daraja."""
    consumer_key = os.getenv("MPESA_CONSUMER_KEY", "")
    consumer_secret = os.getenv("MPESA_CONSUMER_SECRET", "")
    base_url = _get_base_url()

    url = f"{base_url}/oauth/v1/generate?grant_type=client_credentials"
    resp = requests.get(url, auth=(consumer_key, consumer_secret), timeout=15)
    resp.raise_for_status()
    return resp.json()["access_token"]


def generate_password(shortcode: str, passkey: str, timestamp: str) -> str:
    """Base64-encode the STK push password."""
    raw = f"{shortcode}{passkey}{timestamp}"
    return base64.b64encode(raw.encode()).decode()


def normalize_mpesa_phone(phone: str) -> str:
    """Convert any Kenyan phone format to 2547XXXXXXXX."""
    phone = re.sub(r"\D", "", phone)
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    if phone.startswith("+"):
        phone = phone[1:]
    return phone


def stk_push(phone_number: str, amount: int, account_reference: str, description: str) -> dict:
    """
    Initiate an M-Pesa STK Push (Lipa Na M-Pesa Online).

    Returns the full Daraja response dict, including:
      - MerchantRequestID
      - CheckoutRequestID
      - ResponseCode  ("0" = success)
      - CustomerMessage
    """
    shortcode = os.getenv("MPESA_SHORTCODE", "174379")
    passkey = os.getenv("MPESA_PASSKEY", "")
    callback_url = os.getenv("MPESA_CALLBACK_URL", "")
    base_url = _get_base_url()

    token = get_access_token()
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = generate_password(shortcode, passkey, timestamp)
    phone = normalize_mpesa_phone(phone_number)

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        "AccountReference": account_reference,
        "TransactionDesc": description,
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    resp = requests.post(
        f"{base_url}/mpesa/stkpush/v1/processrequest",
        json=payload,
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def process_stk_callback(callback_data: dict) -> dict:
    """
    Parse M-Pesa STK callback payload.

    Returns a normalised dict:
      {
        "checkout_request_id": str,
        "result_code": int,          # 0 = success
        "result_desc": str,
        "mpesa_receipt": str | None,
        "amount": float | None,
        "phone": str | None,
        "transaction_date": str | None,
      }
    """
    body = callback_data.get("Body", {})
    stk_callback = body.get("stkCallback", {})

    checkout_request_id = stk_callback.get("CheckoutRequestID")
    result_code = stk_callback.get("ResultCode")
    result_desc = stk_callback.get("ResultDesc")

    mpesa_receipt = None
    amount = None
    phone = None
    transaction_date = None

    if result_code == 0:
        items = stk_callback.get("CallbackMetadata", {}).get("Item", [])
        item_map = {i["Name"]: i.get("Value") for i in items}
        mpesa_receipt = item_map.get("MpesaReceiptNumber")
        amount = item_map.get("Amount")
        phone = str(item_map.get("PhoneNumber", ""))
        transaction_date = str(item_map.get("TransactionDate", ""))

    return {
        "checkout_request_id": checkout_request_id,
        "result_code": result_code,
        "result_desc": result_desc,
        "mpesa_receipt": mpesa_receipt,
        "amount": amount,
        "phone": phone,
        "transaction_date": transaction_date,
    }
