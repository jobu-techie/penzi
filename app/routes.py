from flask import Blueprint, current_app, jsonify, request

from app.sms_handler import process_sms
from app.services.interest_service import (
    create_interest_request,
    record_consent_response,
)
from app.services.match_service import (
    create_match_request,
    get_next_matches,
    get_user_description_by_phone,
)
from app.services.onfon_service import (
    extract_onfon_payload,
    normalize_phone_number,
    send_onfon_sms,
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
    result, status_code = get_all_users()
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

        # If provider only needs an ACK on webhook receipt
        return "OK", 200, {"Content-Type": "text/plain; charset=utf-8"}

    return "Invalid ONFON_REPLY_MODE", 500, {"Content-Type": "text/plain; charset=utf-8"}
