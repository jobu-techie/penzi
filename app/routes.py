from flask import Blueprint, jsonify, request
from app.sms_handler import process_sms

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


@bp.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Penzi API is running"}), 200


@bp.route("/users", methods=["GET"])
def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users]), 200


@bp.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    result = user.to_dict()

    if user.details:
        result["details"] = user.details.to_dict()

    if user.description:
        result["description"] = user.description.to_dict()

    return jsonify(result), 200


@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    required_fields = ["name", "age", "gender", "county", "town", "phone_number"]
    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return jsonify({"error": f"{field} is required"}), 400

    try:
        age = int(data["age"])
    except (TypeError, ValueError):
        return jsonify({"error": "age must be a number"}), 400

    if age < 18:
        return jsonify({"error": "User must be at least 18 years old"}), 400

    gender_input = str(data["gender"]).strip().capitalize()

    try:
        gender = GenderEnum(gender_input)
    except ValueError:
        return jsonify({"error": "Invalid gender. Allowed values are: Male, Female"}), 400

    phone_number = str(data["phone_number"]).strip()

    existing_user = User.query.filter_by(phone_number=phone_number).first()
    if existing_user:
        return jsonify({"error": "Phone number already exists"}), 409

    user = User(
        name=str(data["name"]).strip(),
        age=age,
        gender=gender.value,
        county=str(data["county"]).strip(),
        town=str(data["town"]).strip(),
        phone_number=phone_number,
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "User registered successfully",
        "user": user.to_dict()
    }), 201

@bp.route("/details/<int:user_id>", methods=["POST"])
def add_user_details(user_id):
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    required_fields = [
        "education_level",
        "profession",
        "marital_status",
        "religion",
        "ethnicity",
    ]

    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return jsonify({"error": f"{field} is required"}), 400

    existing_details = UserDetails.query.filter_by(user_id=user_id).first()
    if existing_details:
        return jsonify({"error": "User details already exist"}), 409

    details = UserDetails(
        user_id=user_id,
        education_level=str(data["education_level"]).strip(),
        profession=str(data["profession"]).strip(),
        marital_status=str(data["marital_status"]).strip(),
        religion=str(data["religion"]).strip(),
        ethnicity=str(data["ethnicity"]).strip(),
    )

    db.session.add(details)
    db.session.commit()

    return jsonify({
        "message": "User details added successfully",
        "user_id": user_id,
        "details": details.to_dict()
    }), 201

@bp.route("/myself/<int:user_id>", methods=["POST"])
def add_self_description(user_id):
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    if "description" not in data or str(data["description"]).strip() == "":
        return jsonify({"error": "description is required"}), 400

    existing_description = UserDescription.query.filter_by(user_id=user_id).first()
    if existing_description:
        return jsonify({"error": "User description already exists"}), 409

    description = UserDescription(
        user_id=user_id,
        description=str(data["description"]).strip(),
    )

    db.session.add(description)
    db.session.commit()

    return jsonify({
        "message": "User description added successfully",
        "user_id": user_id,
        "description": description.to_dict()
    }), 201

@bp.route("/match/<int:user_id>", methods=["POST"])
def find_matches(user_id):
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    required_fields = ["age_range_min", "age_range_max", "county"]
    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return jsonify({"error": f"{field} is required"}), 400

    try:
        age_range_min = int(data["age_range_min"])
        age_range_max = int(data["age_range_max"])
    except (TypeError, ValueError):
        return jsonify({"error": "age_range_min and age_range_max must be numbers"}), 400

    if age_range_min > age_range_max:
        return jsonify({"error": "age_range_min cannot be greater than age_range_max"}), 400

    county = str(data["county"]).strip()

    match_request = MatchRequest(
        user_id=user_id,
        age_range_min=age_range_min,
        age_range_max=age_range_max,
        town=county,
    )

    db.session.add(match_request)
    db.session.commit()

    opposite_gender = "Female" if user.gender == "Male" else "Male"

    matches = User.query.filter(
        User.id != user.id,
        User.age >= age_range_min,
        User.age <= age_range_max,
        User.county == county,
        User.gender == opposite_gender
    ).all()

    stored_results = []
    first_batch = matches[:3]

    for index, matched_user in enumerate(first_batch, start=1):
        result = MatchResult(
            match_request_id=match_request.id,
            matched_user_id=matched_user.id,
            result_order=index,
        )
        db.session.add(result)
        stored_results.append({
            "id": matched_user.id,
            "name": matched_user.name,
            "age": matched_user.age,
            "phone_number": matched_user.phone_number,
            "county": matched_user.county,
            "town": matched_user.town,
        })

    db.session.commit()

    return jsonify({
        "message": "Matches found successfully",
        "match_request_id": match_request.id,
        "total_matches": len(matches),
        "returned_matches": len(first_batch),
        "matches": stored_results
    }), 200

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
    user = User.query.filter_by(phone_number=phone_number).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    description = UserDescription.query.filter_by(user_id=user.id).first()

    if not description:
        return jsonify({"error": "User description not found"}), 404

    return jsonify({
        "message": "User description retrieved successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "phone_number": user.phone_number,
        },
        "description": description.description
    }), 200

@bp.route("/interest", methods=["POST"])
def create_interest_request():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    required_fields = ["requester_user_id", "target_phone_number"]
    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return jsonify({"error": f"{field} is required"}), 400

    requester = User.query.get(data["requester_user_id"])
    if not requester:
        return jsonify({"error": "Requesting user not found"}), 404

    target_phone_number = str(data["target_phone_number"]).strip()
    target = User.query.filter_by(phone_number=target_phone_number).first()

    if not target:
        return jsonify({"error": "Target user not found"}), 404

    if requester.id == target.id:
        return jsonify({"error": "User cannot request their own details"}), 400

    existing_request = InterestRequest.query.filter_by(
        requester_user_id=requester.id,
        target_user_id=target.id
    ).first()

    if existing_request:
        return jsonify({"error": "Interest request already exists"}), 409

    interest_request = InterestRequest(
        requester_user_id=requester.id,
        target_user_id=target.id,
        status="pending",
    )

    db.session.add(interest_request)
    db.session.commit()

    target_details = UserDetails.query.filter_by(user_id=target.id).first()

    return jsonify({
        "message": "Interest request created successfully",
        "interest_request_id": interest_request.id,
        "status": interest_request.status,
        "requested_profile": {
            "id": target.id,
            "name": target.name,
            "age": target.age,
            "county": target.county,
            "town": target.town,
            "phone_number": target.phone_number,
            "details": target_details.to_dict() if target_details else None,
        }
    }), 201

@bp.route("/consent", methods=["POST"])
def respond_to_interest():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    required_fields = ["interest_request_id", "responder_user_id", "response"]
    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return jsonify({"error": f"{field} is required"}), 400

    interest_request = InterestRequest.query.get(data["interest_request_id"])
    if not interest_request:
        return jsonify({"error": "Interest request not found"}), 404

    responder = User.query.get(data["responder_user_id"])
    if not responder:
        return jsonify({"error": "Responder user not found"}), 404

    if responder.id != interest_request.target_user_id:
        return jsonify({"error": "Only the target user can respond to this request"}), 403

    response_value = str(data["response"]).strip().upper()
    if response_value not in ["YES", "NO"]:
        return jsonify({"error": "Response must be YES or NO"}), 400

    existing_response = ConsentResponse.query.filter_by(
        interest_request_id=interest_request.id
    ).first()

    if existing_response:
        return jsonify({"error": "Consent response already exists"}), 409

    consent_response = ConsentResponse(
        interest_request_id=interest_request.id,
        responder_user_id=responder.id,
        response=response_value,
    )

    interest_request.status = "accepted" if response_value == "YES" else "rejected"

    db.session.add(consent_response)
    db.session.commit()

    requester = User.query.get(interest_request.requester_user_id)
    requester_details = UserDetails.query.filter_by(user_id=requester.id).first()

    response_payload = {
        "message": "Consent response recorded successfully",
        "interest_request_id": interest_request.id,
        "response": response_value,
        "status": interest_request.status,
    }

    if response_value == "YES":
        response_payload["requester"] = {
            "id": requester.id,
            "name": requester.name,
            "age": requester.age,
            "county": requester.county,
            "town": requester.town,
            "phone_number": requester.phone_number,
            "details": requester_details.to_dict() if requester_details else None,
        }

    return jsonify(response_payload), 200

@bp.route("/sms", methods=["POST"])
def handle_sms():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    message = data.get("message")
    user_id = data.get("user_id")

    result, status_code = process_sms(user_id, message)
    return jsonify(result), status_code
