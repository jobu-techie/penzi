from flask import Blueprint, jsonify, request
from app.extensions import db
from app.models_chat import ChatMessage
from app.models import User, InterestRequest
from app.services.onfon_service import normalize_phone_number

chat_bp = Blueprint("chat", __name__, url_prefix="/chat")


def _get_user(phone: str):
    normalized = normalize_phone_number(phone)
    return User.query.filter_by(phone_number=normalized).first()


def _get_interest(interest_id: int):
    return InterestRequest.query.get(interest_id)


def _can_chat(interest: InterestRequest, user_id: int) -> bool:
    """User can chat if they are either party in the interest request
    and the request is pending OR accepted (not declined/cancelled)."""
    if interest is None:
        return False
    parties = {interest.requester_user_id, interest.target_user_id}
    if user_id not in parties:
        return False
    return interest.status in ("pending", "accepted")


# ── GET /chat/threads/<phone> ────────────────────────────────────────────────
# Returns all chat threads (interests) available to this user.
@chat_bp.route("/threads/<phone_number>", methods=["GET"])
def get_threads(phone_number):
    user = _get_user(phone_number)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # All interests where this user is either requester or target
    interests = InterestRequest.query.filter(
        db.or_(
            InterestRequest.requester_user_id == user.id,
            InterestRequest.target_user_id == user.id,
        ),
        InterestRequest.status.in_(["pending", "accepted"]),
    ).all()

    result = []
    for interest in interests:
        other_id = (
            interest.target_user_id
            if interest.requester_user_id == user.id
            else interest.requester_user_id
        )
        other = User.query.get(other_id)
        if not other:
            continue

        # Latest message in thread
        last_msg = (
            ChatMessage.query
            .filter_by(interest_request_id=interest.id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )

        # Unread count for this user
        unread = ChatMessage.query.filter_by(
            interest_request_id=interest.id,
            receiver_id=user.id,
            is_read=False,
        ).count()

        result.append({
            "interest_request_id": interest.id,
            "interest_status": interest.status,
            "other_user": {
                "id": other.id,
                "name": other.name,
                "age": other.age,
                "county": other.county,
            },
            "last_message": last_msg.to_dict() if last_msg else None,
            "unread_count": unread,
            "i_am_requester": interest.requester_user_id == user.id,
        })

    # Sort: threads with messages first, then by last message time
    result.sort(
        key=lambda t: t["last_message"]["created_at"] if t["last_message"] else "",
        reverse=True,
    )
    return jsonify(result), 200


# ── GET /chat/messages/<interest_id>/<phone> ─────────────────────────────────
@chat_bp.route("/messages/<int:interest_id>/<phone_number>", methods=["GET"])
def get_messages(interest_id, phone_number):
    user = _get_user(phone_number)
    if not user:
        return jsonify({"error": "User not found"}), 404

    interest = _get_interest(interest_id)
    if not _can_chat(interest, user.id):
        return jsonify({"error": "You cannot access this chat."}), 403

    # Mark incoming messages as read
    ChatMessage.query.filter_by(
        interest_request_id=interest_id,
        receiver_id=user.id,
        is_read=False,
    ).update({"is_read": True})
    db.session.commit()

    messages = (
        ChatMessage.query
        .filter_by(interest_request_id=interest_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return jsonify([m.to_dict() for m in messages]), 200


# ── POST /chat/send ──────────────────────────────────────────────────────────
@chat_bp.route("/send", methods=["POST"])
def send_message():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request"}), 400

    sender_phone = data.get("sender_phone", "")
    interest_id = data.get("interest_request_id")
    content = (data.get("content") or "").strip()

    if not sender_phone or not interest_id or not content:
        return jsonify({"error": "sender_phone, interest_request_id, and content are required"}), 400

    if len(content) > 1000:
        return jsonify({"error": "Message too long (max 1000 characters)"}), 400

    sender = _get_user(sender_phone)
    if not sender:
        return jsonify({"error": "Sender not found"}), 404

    interest = _get_interest(interest_id)
    if not _can_chat(interest, sender.id):
        return jsonify({"error": "You cannot send messages in this chat."}), 403

    # Determine receiver
    receiver_id = (
        interest.target_user_id
        if interest.requester_user_id == sender.id
        else interest.requester_user_id
    )

    msg = ChatMessage(
        interest_request_id=interest_id,
        sender_id=sender.id,
        receiver_id=receiver_id,
        content=content,
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify(msg.to_dict()), 201


# ── GET /chat/unread-count/<phone> ───────────────────────────────────────────
@chat_bp.route("/unread-count/<phone_number>", methods=["GET"])
def unread_count(phone_number):
    user = _get_user(phone_number)
    if not user:
        return jsonify({"error": "User not found"}), 404

    count = ChatMessage.query.filter_by(
        receiver_id=user.id,
        is_read=False,
    ).count()
    return jsonify({"unread_count": count}), 200


# ── GET /chat/has-chatted/<interest_id>/<phone> ──────────────────────────────
# Used by frontend to gate the "Request Match" button.
@chat_bp.route("/has-chatted/<int:interest_id>/<phone_number>", methods=["GET"])
def has_chatted(interest_id, phone_number):
    user = _get_user(phone_number)
    if not user:
        return jsonify({"error": "User not found"}), 404

    count = ChatMessage.query.filter_by(
        interest_request_id=interest_id,
        sender_id=user.id,
    ).count()

    return jsonify({"has_chatted": count > 0, "message_count": count}), 200
