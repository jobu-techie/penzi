from flask import Blueprint, jsonify, request

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
    result, status_code = get_user_description_by_phone(phone_number)
    return jsonify(result), status_code


@bp.route("/interest", methods=["POST"])
def create_interest():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    result, status_code = create_interest_request(data)
    return jsonify(result), status_code


@bp.route("/consent", methods=["POST"])
def respond_to_interest():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    result, status_code = record_consent_response(data)
    return jsonify(result), status_code


@bp.route("/sms", methods=["POST"])
def handle_sms():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    message = data.get("message")
    user_id = data.get("user_id")

    result, status_code = process_sms(user_id, message)
    return jsonify(result), status_code


@bp.route("/webhook/onfon", methods=["POST"])
def onfon_webhook():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Invalid request"}), 400

    sender = data.get("sender")
    message = data.get("message")

    if not sender or not message:
        return jsonify({"error": "sender and message are required"}), 400

    result, status_code = process_sms(sender, message)

    if isinstance(result, dict):
        sms_text = result.get("message")
        if sms_text is None:
            sms_text = str(result)
    else:
        sms_text = str(result)

    return sms_text, status_code, {"Content-Type": "text/plain; charset=utf-8"}
