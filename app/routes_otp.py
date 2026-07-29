import os
import random
import string
from datetime import datetime, timezone, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token

from app.extensions import db, limiter
from app.models import User
from app.models_otp import OTP
from app.services.onfon_service import normalize_phone_number

otp_bp = Blueprint("otp", __name__, url_prefix="/auth")


def _generate_otp(length=6):
    return "".join(random.choices(string.digits, k=length))


def _dev_otp_visible() -> bool:
    """Only expose _dev_otp when explicitly in sandbox AND not a production deploy."""
    return (
        os.getenv("AT_USERNAME", "sandbox") == "sandbox"
        and os.getenv("FLASK_ENV", "development") != "production"
    )


def _send_otp_sms(phone: str, code: str) -> bool:
    import os
    import africastalking

    username = os.getenv("AT_USERNAME", "sandbox")
    api_key  = os.getenv("AT_API_KEY", "")
    sender   = os.getenv("AT_SENDER_ID", "")

    africastalking.initialize(username, api_key)
    sms = africastalking.SMS
    message = f"Your Penzi verification code is: {code}\nValid for 5 minutes. Do not share this code."

    try:
        if phone.startswith("0"):
            recipients = [f"+254{phone[1:]}"]
        elif phone.startswith("254"):
            recipients = [f"+{phone}"]
        else:
            recipients = [phone]

        kwargs = {"message": message, "recipients": recipients}
        if sender:
            kwargs["senderId"] = sender

        response = sms.send(**kwargs)
        recipients_list = response.get("SMSMessageData", {}).get("Recipients", [])
        return any(r.get("status") == "Success" for r in recipients_list)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"AT SMS failed: {e}")
        return False


@otp_bp.route("/request-otp", methods=["POST"])
@limiter.limit("5/minute")
def request_otp():
    data     = request.get_json(silent=True) or {}
    phone    = normalize_phone_number(data.get("phone_number", ""))
    password = data.get("password", "").strip()

    if not phone or not password:
        return jsonify({"error": "phone_number and password are required"}), 400

    user = User.query.filter_by(phone_number=phone).first()
    if not user:
        return jsonify({"error": "Phone number not found. Please register first."}), 404
    if not user.password_hash:
        return jsonify({"error": "No password set. Please set a password first."}), 403
    if not user.check_password(password):
        return jsonify({"error": "Incorrect password. Please try again."}), 401
    if not user.is_active:
        return jsonify({"error": "Your account has been deactivated. Please contact support."}), 403

    # Invalidate old OTPs
    OTP.query.filter_by(user_id=user.id, used=False).delete()
    db.session.flush()

    code = _generate_otp()
    otp  = OTP(
        user_id=user.id,
        code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        used=False,
    )
    db.session.add(otp)
    db.session.commit()

    _send_otp_sms(phone, code)

    is_sandbox = _dev_otp_visible()

    response = {
        "message": "OTP sent. Valid for 5 minutes.",
        "otp_id": otp.id,
    }
    if is_sandbox:
        response["_dev_otp"]  = code
        response["_dev_note"] = "Sandbox mode — remove AT_USERNAME=sandbox in production."

    return jsonify(response), 200


@otp_bp.route("/verify-otp", methods=["POST"])
@limiter.limit("10/minute")
def verify_otp():
    data   = request.get_json(silent=True) or {}
    otp_id = data.get("otp_id")
    code   = (data.get("code") or "").strip()

    if not otp_id or not code:
        return jsonify({"error": "otp_id and code are required"}), 400

    otp = OTP.query.get(otp_id)
    if not otp:
        return jsonify({"error": "Invalid OTP session. Please request a new code."}), 400
    if otp.used:
        return jsonify({"error": "OTP already used. Please request a new code."}), 400

    now = datetime.now(timezone.utc)
    if otp.expires_at.replace(tzinfo=timezone.utc) < now:
        return jsonify({"error": "OTP has expired. Please request a new code."}), 400

    if otp.code != code:
        otp.attempts = (otp.attempts or 0) + 1
        db.session.commit()
        if otp.attempts >= 3:
            otp.used = True
            db.session.commit()
            return jsonify({"error": "Too many incorrect attempts. Please request a new code."}), 400
        remaining = 3 - otp.attempts
        return jsonify({"error": f"Incorrect code. {remaining} attempt(s) remaining."}), 400

    otp.used = True
    db.session.commit()

    user = User.query.get(otp.user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    if not user.is_active:
        return jsonify({"error": "Your account has been deactivated. Please contact support."}), 403

    user.last_login = datetime.now(timezone.utc)
    user.last_seen = datetime.now(timezone.utc)
    user.is_online = True
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({"message": "Login successful.", "token": token, "user": user.to_dict()}), 200


@otp_bp.route("/resend-otp", methods=["POST"])
@limiter.limit("5/minute")
def resend_otp():
    data   = request.get_json(silent=True) or {}
    otp_id = data.get("otp_id")

    if not otp_id:
        return jsonify({"error": "otp_id is required"}), 400

    old_otp = OTP.query.get(otp_id)
    if not old_otp:
        return jsonify({"error": "Invalid OTP session."}), 400

    user = User.query.get(old_otp.user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    if not user.is_active:
        return jsonify({"error": "Your account has been deactivated. Please contact support."}), 403

    old_otp.used = True
    db.session.flush()

    code    = _generate_otp()
    new_otp = OTP(
        user_id=user.id,
        code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        used=False,
    )
    db.session.add(new_otp)
    db.session.commit()

    _send_otp_sms(user.phone_number, code)

    is_sandbox = _dev_otp_visible()

    response = {"message": "New OTP sent.", "otp_id": new_otp.id}
    if is_sandbox:
        response["_dev_otp"] = code

    return jsonify(response), 200