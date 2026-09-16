# app/routes_support.py
from flask import Blueprint, jsonify, request
from app.extensions import db
from app.models_support import SupportMessage
from app.models import User
from app.services.onfon_service import normalize_phone_number

support_bp = Blueprint("support", __name__, url_prefix="/support")


def _get_user(phone: str):
    normalized = normalize_phone_number(phone)
    return User.query.filter_by(phone_number=normalized).first()


# ── POST /support/send ───────────────────────────────────────────────────────
@support_bp.route("/send", methods=["POST"])
def send_message():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    phone = data.get("phone_number", "")
    content = (data.get("content") or "").strip()

    if not phone or not content:
        return jsonify({"error": "phone_number and content are required"}), 400

    if len(content) > 1000:
        return jsonify({"error": "Message too long (max 1000 characters)"}), 400

    user = _get_user(phone)
    if not user:
        return jsonify({"error": "User not found"}), 404

    msg = SupportMessage(user_id=user.id, sender="user", content=content, is_read=False)
    db.session.add(msg)
    db.session.commit()

    return jsonify(msg.to_dict()), 201


# ── GET /support/messages/<phone_number> ─────────────────────────────────────
@support_bp.route("/messages/<phone_number>", methods=["GET"])
def get_messages(phone_number):
    user = _get_user(phone_number)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Mark admin-sent messages as read now that the user is viewing the thread
    SupportMessage.query.filter_by(
        user_id=user.id, sender="admin", is_read=False
    ).update({"is_read": True})
    db.session.commit()

    messages = (
        SupportMessage.query
        .filter_by(user_id=user.id)
        .order_by(SupportMessage.created_at.asc())
        .all()
    )
    return jsonify([m.to_dict() for m in messages]), 200


# ── GET /support/unread-count/<phone_number> ─────────────────────────────────
@support_bp.route("/unread-count/<phone_number>", methods=["GET"])
def unread_count(phone_number):
    user = _get_user(phone_number)
    if not user:
        return jsonify({"error": "User not found"}), 404

    count = SupportMessage.query.filter_by(
        user_id=user.id, sender="admin", is_read=False
    ).count()
    return jsonify({"unread_count": count}), 200
