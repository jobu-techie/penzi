from app import db
from app.models import User, UserDetails, InterestRequest, ConsentResponse
from app.services.onfon_service import queue_sms


def create_interest_request(data: dict):
    required_fields = ["requester_user_id", "target_phone_number"]
    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return {"error": f"{field} is required"}, 400

    requester = db.session.get(User, data["requester_user_id"])
    if not requester:
        return {"error": "Requesting user not found"}, 404

    target_phone_number = str(data["target_phone_number"]).strip()
    target = User.query.filter_by(phone_number=target_phone_number).first()

    if not target:
        return {"error": "Target user not found"}, 404

    if requester.id == target.id:
        return {"error": "User cannot request their own details"}, 400

    existing_request = InterestRequest.query.filter_by(
        requester_user_id=requester.id,
        target_user_id=target.id
    ).first()

    if existing_request:
        return {"error": "Interest request already exists"}, 409

    interest_request = InterestRequest(
        requester_user_id=requester.id,
        target_user_id=target.id,
        status="pending",
    )

    db.session.add(interest_request)
    db.session.commit()

    # Notify target via SMS
    queue_sms(
        recipient=target.phone_number,
        message=(
            f"Hi {target.name},\n"
            f"{requester.name} is interested in you.\n"
            f"Reply YES to receive their details."
        ),
        sender_id="22141",
    )

    target_details = UserDetails.query.filter_by(user_id=target.id).first()

    return {
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
    }, 201


def record_consent_response(data: dict):
    required_fields = ["interest_request_id", "responder_user_id", "response"]
    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return {"error": f"{field} is required"}, 400

    interest_request = db.session.get(InterestRequest, data["interest_request_id"])
    if not interest_request:
        return {"error": "Interest request not found"}, 404

    responder = db.session.get(User, data["responder_user_id"])
    if not responder:
        return {"error": "Responder user not found"}, 404

    if responder.id != interest_request.target_user_id:
        return {"error": "Only the target user can respond to this request"}, 403

    response_value = str(data["response"]).strip().upper()
    if response_value not in ["YES", "NO"]:
        return {"error": "Response must be YES or NO"}, 400

    existing_response = ConsentResponse.query.filter_by(
        interest_request_id=interest_request.id
    ).first()

    if existing_response:
        return {"error": "Consent response already exists"}, 409

    consent_response = ConsentResponse(
        interest_request_id=interest_request.id,
        responder_user_id=responder.id,
        response=response_value,
    )

    interest_request.status = "accepted" if response_value == "YES" else "rejected"

    db.session.add(consent_response)
    db.session.commit()

    # Guard against deleted requester
    requester = db.session.get(User, interest_request.requester_user_id)
    if not requester:
        return {"error": "Requesting user no longer exists"}, 404

    requester_details = UserDetails.query.filter_by(user_id=requester.id).first()

    # Notify requester via SMS if accepted
    if response_value == "YES":
        queue_sms(
            recipient=requester.phone_number,
            message=(
                f"Hi {requester.name},\n"
                f"{responder.name} accepted your interest!\n"
                f"Their number is {responder.phone_number}.\n"
                "Feel free to connect!"
            ),
            sender_id="22141",
        )

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

    return response_payload, 200
