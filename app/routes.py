from flask import Blueprint, current_app, jsonify, request

from app.sms_handler import process_sms
from app.services.interest_service import (
    create_interest_request,
    record_consent_response,
)
from app.models import SmsLog, SmsOutbox
from app.services.onfon_service import (
    extract_onfon_payload,
    normalize_phone_number,
    send_onfon_sms,
    log_incoming_sms,
    log_outgoing_sms,
    queue_sms,
)
from app.services.match_service import (
    create_match_request,
    get_next_matches,
    get_user_description_by_phone,
)
from app.services.user_service import (
    create_user,
    add_user_details,
    add_user_description,
    get_all_users,
    get_user_profile,
)

bp = Blueprint("routes", __name__)


@bp.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Penzi API is running"}), 200


@bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@bp.route("/users", methods=["GET"])
def get_users():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    result, status_code = get_all_users(page=page, per_page=per_page)
    return jsonify(result), status_code


@bp.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    result, status_code = get_user_profile(user_id)
    return jsonify(result), status_code


@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    if "phone_number" in data:
        data["phone_number"] = normalize_phone_number(data["phone_number"])

    result, status_code = create_user(data)
    return jsonify(result), status_code


@bp.route("/details/<int:user_id>", methods=["POST"])
def add_details(user_id):
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    result, status_code = add_user_details(user_id, data)
    return jsonify(result), status_code


@bp.route("/users/phone/<phone_number>", methods=["GET"])
def get_user_by_phone(phone_number):
    from app.services.onfon_service import normalize_phone_number
    from app.models import User
    normalized = normalize_phone_number(phone_number)
    user = User.query.filter_by(phone_number=normalized).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict()), 200


@bp.route("/myself/<int:user_id>", methods=["POST"])
def add_self_description(user_id):
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    result, status_code = add_user_description(user_id, data)
    return jsonify(result), status_code


@bp.route("/match/<int:user_id>", methods=["POST"])
def find_matches(user_id):
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    result, status_code = create_match_request(user_id, data)
    return jsonify(result), status_code


@bp.route("/match/next/<int:match_request_id>", methods=["GET"])
def next_matches(match_request_id):
    result, status_code = get_next_matches(match_request_id)
    return jsonify(result), status_code


@bp.route("/describe/<phone_number>", methods=["GET"])
def describe_user(phone_number):
    result, status_code = get_user_description_by_phone(normalize_phone_number(phone_number))
    return jsonify(result), status_code


@bp.route("/interest", methods=["POST"])
def create_interest():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    if "target_phone_number" in data:
        data["target_phone_number"] = normalize_phone_number(data["target_phone_number"])

    result, status_code = create_interest_request(data)
    return jsonify(result), status_code


@bp.route("/consent", methods=["POST"])
def respond_to_interest():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    result, status_code = record_consent_response(data)
    return jsonify(result), status_code


@bp.route("/webhook/onfon", methods=["POST"])
def onfon_webhook():
    # Optional shared-secret protection
    expected_token = current_app.config.get("ONFON_WEBHOOK_TOKEN")
    incoming_token = (
        request.headers.get("X-Webhook-Token")
        or request.headers.get("Authorization", "").replace("Bearer ", "")
    )

    if expected_token and incoming_token != expected_token:
        return "Unauthorized", 401, {"Content-Type": "text/plain; charset=utf-8"}

    # Accept JSON or form-encoded payloads
    data = request.get_json(silent=True) or request.form.to_dict()

    if not data:
        return "Invalid request", 400, {"Content-Type": "text/plain; charset=utf-8"}

    sender, message, shortcode = extract_onfon_payload(data)

    if not sender or not message:
        return "sender and message are required", 400, {
            "Content-Type": "text/plain; charset=utf-8"
        }

    log_incoming_sms(sender, shortcode, message)

    result, status_code = process_sms(sender, message)

    if isinstance(result, dict):
        sms_text = result.get("message")
        if sms_text is None:
            sms_text = str(result)
    else:
        sms_text = str(result)

    reply_mode = current_app.config.get("ONFON_REPLY_MODE", "direct")

    # Mode 1: return text directly for gateway relay
    if reply_mode == "direct":
        log_outgoing_sms(
            sender,
            sms_text,
            sender_id=current_app.config.get("ONFON_SENDER_ID", "22141"),
            status="sent",
        )
        return sms_text, status_code, {"Content-Type": "text/plain; charset=utf-8"}

    # Mode 2: actively send SMS through Onfon MT API
    if reply_mode == "send_api":
        try:
            send_onfon_sms(sender, sms_text)
        except Exception:
            current_app.logger.exception("Failed to send outbound SMS via Onfon API")
            return "Failed to send outbound SMS", 502, {
                "Content-Type": "text/plain; charset=utf-8"
            }

        return "OK", 200, {"Content-Type": "text/plain; charset=utf-8"}

    return "Invalid ONFON_REPLY_MODE", 500, {"Content-Type": "text/plain; charset=utf-8"}


@bp.route("/sms/logs", methods=["GET"])
def get_sms_logs():
    logs = SmsLog.query.order_by(SmsLog.id.desc()).all()
    return jsonify([log.to_dict() for log in logs]), 200


@bp.route("/sms/outbox", methods=["GET"])
def get_sms_outbox():
    items = SmsOutbox.query.order_by(SmsOutbox.id.desc()).all()
    return jsonify([item.to_dict() for item in items]), 200

@bp.route("/match/reset/<int:user_id>", methods=["DELETE"])
def delete_user_match_requests(user_id):
    from app import db
    from app.models import MatchRequest, MatchResult

    match_requests = MatchRequest.query.filter_by(user_id=user_id).all()

    for match_request in match_requests:
        MatchResult.query.filter_by(match_request_id=match_request.id).delete()
        db.session.delete(match_request)

    db.session.commit()
    return jsonify({"message": "Match requests deleted successfully"}), 200

    #pending requests in users

@bp.route("/interest/pending/<phone_number>", methods=["GET"])
def get_pending_interests(phone_number):
    from app.models import User, InterestRequest
    from app.services.onfon_service import normalize_phone_number
    
    normalized = normalize_phone_number(phone_number)
    user = User.query.filter_by(phone_number=normalized).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    pending = InterestRequest.query.filter_by(
        target_user_id=user.id,
        status="pending"
    ).all()

    result = []
    for req in pending:
        requester = User.query.get(req.requester_user_id)
        if requester:
            result.append({
                "interest_request_id": req.id,
                "requester_name": requester.name,
                "requester_phone": requester.phone_number,
                "requester_age": requester.age,
                "requester_county": requester.county,
                "requester_town": requester.town,
            })

    return jsonify(result), 200

 #profile to get a phone number

@bp.route("/users/profile/<phone_number>", methods=["GET"])
def get_user_profile_by_phone(phone_number):
    from app.models import User, UserDetails, UserDescription
    from app.services.onfon_service import normalize_phone_number

    normalized = normalize_phone_number(phone_number)
    user = User.query.filter_by(phone_number=normalized).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    details = UserDetails.query.filter_by(user_id=user.id).first()
    description = UserDescription.query.filter_by(user_id=user.id).first()

    return jsonify({
        "id": user.id,
        "name": user.name,
        "age": user.age,
        "gender": user.gender,
        "county": user.county,
        "town": user.town,
        "phone_number": user.phone_number,
        "details": details.to_dict() if details else None,
        "description": description.description if description else None,
    }), 200  

@bp.route("/interest/accepted-by-me/<phone_number>", methods=["GET"])
def get_accepted_interests_for_requester(phone_number):
    from app.models import User, InterestRequest
    from app.services.onfon_service import normalize_phone_number

    normalized = normalize_phone_number(phone_number)
    user = User.query.filter_by(phone_number=normalized).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    accepted = InterestRequest.query.filter_by(
        requester_user_id=user.id,
        status="accepted"
    ).all()

    result = []
    for req in accepted:
        target = User.query.get(req.target_user_id)
        if target:
            result.append({
                "interest_request_id": req.id,
                "acceptor_name": target.name,
                "acceptor_phone": target.phone_number,
                "acceptor_age": target.age,
                "acceptor_county": target.county,
                "acceptor_town": target.town,
            })

    return jsonify(result), 200