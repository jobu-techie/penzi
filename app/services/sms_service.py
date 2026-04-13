from app import db
from app.models import (
    User,
    UserDetails,
    UserDescription,
    MatchRequest,
    MatchResult,
    InterestRequest,
    ConsentResponse,
)
from app.services.user_service import validate_gender
from app.services.match_service import get_user_description_by_phone


def parse_age_range(age_range_text: str):
    parts = age_range_text.split("-")
    if len(parts) != 2:
        return None, None, "Age range must be in format min-max"

    try:
        min_age = int(parts[0].strip())
        max_age = int(parts[1].strip())
    except ValueError:
        return None, None, "Age range values must be numbers"

    if min_age > max_age:
        return None, None, "Minimum age cannot be greater than maximum age"

    return min_age, max_age, None


def create_temp_phone(user_id: int) -> str:
    return f"TEMP_{user_id}"


def handle_start_command(message: str):
    parts = message.split("#")

    if len(parts) != 6:
        return {"error": "Invalid start format. Use start#name#age#gender#county#town"}, 400

    _, name, age_text, gender_text, county, town = parts

    if not all(part.strip() for part in [name, age_text, gender_text, county, town]):
        return {"error": "All start fields are required"}, 400

    try:
        age = int(age_text.strip())
    except ValueError:
        return {"error": "Age must be a number"}, 400

    if age < 18:
        return {"error": "User must be at least 18 years old"}, 400

    gender = validate_gender(gender_text)
    if not gender:
        return {"error": "Invalid gender. Allowed values are: Male, Female"}, 400

    user = User(
        name=name.strip(),
        age=age,
        gender=gender.value,
        county=county.strip(),
        town=town.strip(),
        phone_number="TEMP_PHONE",
    )

    db.session.add(user)
    db.session.commit()

    user.phone_number = create_temp_phone(user.id)
    db.session.commit()

    return {
        "message": f"Your profile has been created successfully {user.name}. "
                   f"SMS details#levelOfEducation#profession#maritalStatus#religion#ethnicity to continue.",
        "user_id": user.id,
        "user": user.to_dict(),
    }, 201


def handle_details_command(user_id: int, message: str):
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}, 404

    parts = message.split("#")
    if len(parts) != 6:
        return {"error": "Invalid details format. Use details#education#profession#maritalStatus#religion#ethnicity"}, 400

    _, education_level, profession, marital_status, religion, ethnicity = parts

    if not all(part.strip() for part in [education_level, profession, marital_status, religion, ethnicity]):
        return {"error": "All details fields are required"}, 400

    existing_details = UserDetails.query.filter_by(user_id=user_id).first()
    if existing_details:
        return {"error": "User details already exist"}, 409

    details = UserDetails(
        user_id=user_id,
        education_level=education_level.strip(),
        profession=profession.strip(),
        marital_status=marital_status.strip(),
        religion=religion.strip(),
        ethnicity=ethnicity.strip(),
    )

    db.session.add(details)
    db.session.commit()

    return {
        "message": "This is the last stage of registration. SMS your self description starting with the word MYSELF.",
        "user_id": user_id,
        "details": details.to_dict(),
    }, 201


def handle_myself_command(user_id: int, message: str):
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}, 404

    if not message.upper().startswith("MYSELF"):
        return {"error": "Invalid MYSELF format"}, 400

    description_text = message[6:].strip()
    if not description_text:
        return {"error": "Description is required after MYSELF"}, 400

    existing_description = UserDescription.query.filter_by(user_id=user_id).first()
    if existing_description:
        return {"error": "User description already exists"}, 409

    description = UserDescription(
        user_id=user_id,
        description=description_text,
    )

    db.session.add(description)
    db.session.commit()

    return {
        "message": "You are now registered for dating. To search for a match, SMS match#ageRange#county.",
        "user_id": user_id,
        "description": description.to_dict(),
    }, 201


def build_match_list(user, age_range_min: int, age_range_max: int, county: str):
    opposite_gender = "Female" if user.gender == "Male" else "Male"

    return User.query.filter(
        User.id != user.id,
        User.age >= age_range_min,
        User.age <= age_range_max,
        User.county == county,
        User.gender == opposite_gender
    ).all()


def serialize_match_user(matched_user):
    return {
        "name": matched_user.name,
        "age": matched_user.age,
        "phone_number": matched_user.phone_number,
    }


def handle_match_command(user_id: int, message: str):
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}, 404

    parts = message.split("#")
    if len(parts) != 3:
        return {"error": "Invalid match format. Use match#ageRange#county"}, 400

    _, age_range_text, county = parts
    county = county.strip()

    if not county:
        return {"error": "County is required"}, 400

    age_range_min, age_range_max, error = parse_age_range(age_range_text.strip())
    if error:
        return {"error": error}, 400

    match_request = MatchRequest(
        user_id=user_id,
        age_range_min=age_range_min,
        age_range_max=age_range_max,
        town=county,
    )

    db.session.add(match_request)
    db.session.commit()

    matches = build_match_list(user, age_range_min, age_range_max, county)
    first_batch = matches[:3]
    response_matches = []

    for index, matched_user in enumerate(first_batch, start=1):
        result = MatchResult(
            match_request_id=match_request.id,
            matched_user_id=matched_user.id,
            result_order=index,
        )
        db.session.add(result)
        response_matches.append(serialize_match_user(matched_user))

    db.session.commit()

    return {
        "message": f"We have {len(matches)} matches for your choice.",
        "match_request_id": match_request.id,
        "matches": response_matches,
        "next_instruction": "Send NEXT to receive more matches." if len(matches) > 3 else None,
    }, 200


def handle_next_command(user_id: int):
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}, 404

    match_request = MatchRequest.query.filter_by(user_id=user_id).order_by(MatchRequest.id.desc()).first()
    if not match_request:
        return {"error": "No previous match request found"}, 404

    all_matches = build_match_list(
        user,
        match_request.age_range_min,
        match_request.age_range_max,
        match_request.town,
    )

    existing_results = MatchResult.query.filter_by(match_request_id=match_request.id).all()
    already_sent_ids = [result.matched_user_id for result in existing_results]

    remaining_matches = [matched_user for matched_user in all_matches if matched_user.id not in already_sent_ids]
    next_batch = remaining_matches[:3]

    current_count = len(already_sent_ids)
    response_matches = []

    for index, matched_user in enumerate(next_batch, start=1):
        result = MatchResult(
            match_request_id=match_request.id,
            matched_user_id=matched_user.id,
            result_order=current_count + index,
        )
        db.session.add(result)
        response_matches.append(serialize_match_user(matched_user))

    db.session.commit()

    return {
        "message": "Next matches retrieved successfully",
        "match_request_id": match_request.id,
        "matches": response_matches,
    }, 200


def handle_describe_command(message: str):
    parts = message.split(maxsplit=1)

    if len(parts) != 2:
        return {"error": "Invalid DESCRIBE format. Use DESCRIBE <phone_number>"}, 400

    phone_number = parts[1].strip()
    return get_user_description_by_phone(phone_number)


def handle_phone_interest_command(user_id: int, message: str):
    requester = db.session.get(User, user_id)
    if not requester:
        return {"error": "User not found"}, 404

    phone_number = message.strip()
    target = User.query.filter_by(phone_number=phone_number).first()

    if not target:
        return {"error": "Target user not found"}, 404

    if requester.id == target.id:
        return {"error": "You cannot request your own details"}, 400

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

    target_details = UserDetails.query.filter_by(user_id=target.id).first()

    return {
        "message": "Interest request created successfully",
        "interest_request_id": interest_request.id,
        "requested_profile": {
            "name": target.name,
            "age": target.age,
            "county": target.county,
            "town": target.town,
            "phone_number": target.phone_number,
            "details": target_details.to_dict() if target_details else None,
        },
        "notify_target": {
            "message": f"Hi {target.name}, {requester.name} is interested in you. Reply YES to receive their details.",
            "target_user_id": target.id,
        }
    }, 201


def handle_yes_command(user_id: int):
    responder = db.session.get(User, user_id)
    if not responder:
        return {"error": "User not found"}, 404

    interest_request = InterestRequest.query.filter_by(
        target_user_id=user_id,
        status="pending"
    ).order_by(InterestRequest.id.desc()).first()

    if not interest_request:
        return {"error": "No pending interest request found"}, 404

    existing_response = ConsentResponse.query.filter_by(
        interest_request_id=interest_request.id
    ).first()

    if existing_response:
        return {"error": "Consent response already exists"}, 409

    consent_response = ConsentResponse(
        interest_request_id=interest_request.id,
        responder_user_id=user_id,
        response="YES",
    )

    interest_request.status = "accepted"

    db.session.add(consent_response)
    db.session.commit()

    requester = db.session.get(User, interest_request.requester_user_id)
    requester_details = UserDetails.query.filter_by(user_id=requester.id).first()

    return {
        "message": "Consent recorded successfully",
        "interest_request_id": interest_request.id,
        "requester_profile": {
            "name": requester.name,
            "age": requester.age,
            "county": requester.county,
            "town": requester.town,
            "phone_number": requester.phone_number,
            "details": requester_details.to_dict() if requester_details else None,
        }
    }, 200


def process_sms_command(user_id: int | None, message: str):
    if not message or not message.strip():
        return {"error": "Message cannot be empty"}, 400

    message = message.strip()

    if message.lower().startswith("start#"):
        return handle_start_command(message)

    if user_id is None:
        return {"error": "user_id is required for this command"}, 400

    if message.lower().startswith("details#"):
        return handle_details_command(user_id, message)

    if message.upper().startswith("MYSELF"):
        return handle_myself_command(user_id, message)

    if message.lower().startswith("match#"):
        return handle_match_command(user_id, message)

    if message.upper() == "NEXT":
        return handle_next_command(user_id)

    if message.upper().startswith("DESCRIBE "):
        return handle_describe_command(message)

    if message.upper() == "YES":
        return handle_yes_command(user_id)

    if message.strip().isdigit() or message.strip().startswith("07") or message.strip().startswith("01"):
        return handle_phone_interest_command(user_id, message)

    return {"error": "Unknown SMS command"}, 400
