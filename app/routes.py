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
from app import db
from app.models import (
    GenderEnum,
    User,
    UserDetails,
    UserDescription,
    MatchRequest,
    MatchResult,
    InterestRequest,
    ConsentResponse,
)

bp = Blueprint("routes", __name__)

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
        sms_text = result.get("message", "Request processed.")
    else:
        sms_text = str(result)

    return sms_text, status_code, {"Content-Type": "text/plain; charset=utf-8"}

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
def get_next_matches(match_request_id):
    match_request = MatchRequest.query.get(match_request_id)

    if not match_request:
        return jsonify({"error": "Match request not found"}), 404

    requester = User.query.get(match_request.user_id)

    if not requester:
        return jsonify({"error": "Requesting user not found"}), 404

    opposite_gender = "Female" if requester.gender == "Male" else "Male"

    all_matches = User.query.filter(
        User.id != requester.id,
        User.age >= match_request.age_range_min,
        User.age <= match_request.age_range_max,
        User.county == match_request.town,
        User.gender == opposite_gender
    ).all()

    already_sent_ids = [
        result.matched_user_id
        for result in MatchResult.query.filter_by(match_request_id=match_request_id).all()
    ]

    remaining_matches = [user for user in all_matches if user.id not in already_sent_ids]
    next_batch = remaining_matches[:3]

    current_count = len(already_sent_ids)
    returned_matches = []

    for index, matched_user in enumerate(next_batch, start=1):
        result = MatchResult(
            match_request_id=match_request.id,
            matched_user_id=matched_user.id,
            result_order=current_count + index,
        )
        db.session.add(result)

        returned_matches.append({
            "id": matched_user.id,
            "name": matched_user.name,
            "age": matched_user.age,
            "phone_number": matched_user.phone_number,
            "county": matched_user.county,
            "town": matched_user.town,
        })

    db.session.commit()

    return jsonify({
        "message": "Next matches retrieved successfully",
        "match_request_id": match_request.id,
        "returned_matches": len(returned_matches),
        "matches": returned_matches
    }), 200

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

    return jsonify({
        "from": "User",
        "to": "Onfon",
        "incoming_message": message,
        "reply_from": "Onfon",
        "reply_to": "User",
        "response": result,
    }), status_code
