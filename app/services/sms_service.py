import re

from app import db
from app.models import (
    User,
    UserDetails,
    UserDescription,
    MatchRequest,
    MatchResult,
    InterestRequest,
    ConsentResponse,
    GenderEnum
)
from app.services.user_service import validate_gender
from app.services.match_service import get_user_description_by_phone
from app.services.onfon_service import normalize_phone_number, queue_sms


def get_user_by_phone(phone_number: str):
    return User.query.filter_by(phone_number=normalize_phone_number(phone_number)).first()


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


def serialize_match_user(matched_user):
    return {
        "name": matched_user.name,
        "age": matched_user.age,
        "phone_number": matched_user.phone_number,
    }


def is_phone_number(message: str) -> bool:
    return bool(re.match(r'^(07|01|254)\d{8,9}$', message.strip()))


def build_match_list(user, age_range_min: int, age_range_max: int, county: str, exclude_ids=None):
    opposite_gender = GenderEnum.FEMALE if user.gender == GenderEnum.MALE else GenderEnum.MALE

    query = User.query.filter(
        User.id != user.id,
        User.age >= age_range_min,
        User.age <= age_range_max,
        User.county == county,
        User.gender == opposite_gender,
    )

    if exclude_ids:
        query = query.filter(User.id.notin_(exclude_ids))

    return query.all()


def handle_start_command(sender: str, message: str):
    sender = normalize_phone_number(sender)
    existing_user = User.query.filter_by(phone_number=sender).first()

    if existing_user:
        return {
            "message": (
                f"You are already registered as {existing_user.name}.\n"
                "To search for a match, SMS match#ageRange#county."
            ),
            "user_id": existing_user.id,
            "user": existing_user.to_dict(),
        }, 200

    parts = message.split("#")

    if len(parts) != 6:
        return {
            "message": "Invalid format. Use start#name#age#gender#county#town"
        }, 400

    _, name, age_text, gender_text, county, town = parts

    if not all(part.strip() for part in [name, age_text, gender_text, county, town]):
        return {"message": "All start fields are required"}, 400

    try:
        age = int(age_text.strip())
    except ValueError:
        return {"message": "Age must be a number"}, 400

    if age < 18:
        return {"message": "User must be at least 18 years old"}, 400

    gender = validate_gender(gender_text)
    if not gender:
        return {"message": "Invalid gender. Allowed values are: Male, Female"}, 400

    user = User(
        name=name.strip(),
        age=age,
        gender=gender.value,
        county=county.strip(),
        town=town.strip(),
        phone_number=sender,
    )

    db.session.add(user)
    db.session.commit()

    return {
        "message": (
            f"Welcome to PENZI, {user.name}.\n"
            "Your profile has been created successfully.\n"
            "SMS details#levelOfEducation#profession#maritalStatus#religion#ethnicity to continue."
        ),
        "user_id": user.id,
    }, 201


def handle_details_command(user_id: int, message: str):
    user = db.session.get(User, user_id)
    if not user:
        return {"message": "User not found"}, 404

    parts = message.split("#")

    if len(parts) != 6:
        return {
            "message": "Invalid format. Use details#education#profession#maritalStatus#religion#ethnicity"
        }, 400

    _, education_level, profession, marital_status, religion, ethnicity = parts

    if not all(part.strip() for part in [education_level, profession, marital_status, religion, ethnicity]):
        return {"message": "All details fields are required"}, 400

    existing_details = UserDetails.query.filter_by(user_id=user_id).first()
    if existing_details:
        return {"message": "User details already exist"}, 409

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
        "message": (
            "This is the last stage of registration.\n"
            "SMS your self description starting with the word MYSELF."
        ),
        "user_id": user_id,
    }, 201


def handle_myself_command(user_id: int, message: str):
    user = db.session.get(User, user_id)
    if not user:
        return {"message": "User not found"}, 404

    # Check details step is complete
    existing_details = UserDetails.query.filter_by(user_id=user_id).first()
    if not existing_details:
        return {
            "message": "Please complete your details first by sending details#education#profession#maritalStatus#religion#ethnicity"
        }, 400

    if not message.upper().startswith("MYSELF"):
        return {"message": "Invalid MYSELF format"}, 400

    description_text = message[6:].strip()
    if not description_text:
        return {"message": "Description is required after MYSELF"}, 400

    existing_description = UserDescription.query.filter_by(user_id=user_id).first()
    if existing_description:
        return {"message": "User description already exists"}, 409

    description = UserDescription(
        user_id=user_id,
        description=description_text,
    )

    db.session.add(description)
    db.session.commit()

    return {
        "message": (
            "You are now registered for dating.\n"
            "To search for a match, SMS match#ageRange#county."
        ),
        "user_id": user_id,
    }, 201


def handle_match_command(user_id: int, message: str):
    user = db.session.get(User, user_id)
    if not user:
        return {"message": "User not found"}, 404

    # Check registration is complete
    existing_details = UserDetails.query.filter_by(user_id=user_id).first()
    existing_description = UserDescription.query.filter_by(user_id=user_id).first()
    if not existing_details or not existing_description:
        return {
            "message": "Please complete your registration first."
        }, 400

    parts = message.split("#")

    if len(parts) != 3:
        return {"message": "Invalid format. Use match#ageRange#county"}, 400

    _, age_range_text, county = parts
    county = county.strip()

    if not county:
        return {"message": "County is required"}, 400

    age_range_min, age_range_max, error = parse_age_range(age_range_text.strip())
    if error:
        return {"message": error}, 400

    # Check for duplicate match request
    existing_request = MatchRequest.query.filter_by(user_id=user_id, town=county).first()
    if existing_request:
        return {
            "message": f"You already have a match request for {county}."
        }, 409

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

    if not response_matches:
        return {"message": "Sorry, no match found for your choice yet."}, 200

    matches_text = "\n".join(
        [f"{m['name']} aged {m['age']}, {m['phone_number']}" for m in response_matches]
    )

    next_text = "\nSend NEXT to receive more matches." if len(matches) > 3 else ""

    return {
        "message": (
            f"We have {len(matches)} matches for your choice!\n"
            f"{matches_text}"
            f"{next_text}"
        ),
        "match_request_id": match_request.id,
    }, 200


def handle_next_command(user_id: int):
    user = db.session.get(User, user_id)
    if not user:
        return {"message": "User not found"}, 404

    match_request = MatchRequest.query.filter_by(user_id=user_id).order_by(MatchRequest.id.desc()).first()
    if not match_request:
        return {"message": "No previous match request found"}, 404

    existing_results = MatchResult.query.filter_by(match_request_id=match_request.id).all()
    already_sent_ids = [result.matched_user_id for result in existing_results]

    # Query only unsent matches directly from DB
    remaining_matches = build_match_list(
        user,
        match_request.age_range_min,
        match_request.age_range_max,
        match_request.town,
        exclude_ids=already_sent_ids,
    )

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

    if not response_matches:
        return {"message": "No more matches available for now."}, 200

    matches_text = "\n".join(
        [f"{m['name']} aged {m['age']}, {m['phone_number']}" for m in response_matches]
    )

    return {"message": f"{matches_text}\nSend NEXT to receive more matches."}, 200


def handle_describe_command(message: str):
    parts = message.split(maxsplit=1)

    if len(parts) != 2:
        return {"message": "Invalid format. Use DESCRIBE <phone_number>"}, 400

    phone_number = normalize_phone_number(parts[1].strip())
    result, status_code = get_user_description_by_phone(phone_number)

    if status_code != 200:
        return {"message": result.get("error", "User description not found")}, status_code

    return {"message": result["description"]}, 200


def handle_phone_interest_command(user_id: int, message: str):
    requester = db.session.get(User, user_id)
    if not requester:
        return {"message": "User not found"}, 404

    phone_number = normalize_phone_number(message.strip())
    target = User.query.filter_by(phone_number=phone_number).first()

    if not target:
        return {"message": "Target user not found"}, 404

    if requester.id == target.id:
        return {"message": "You cannot request your own details"}, 400

    existing_request = InterestRequest.query.filter_by(
        requester_user_id=requester.id,
        target_user_id=target.id
    ).first()

    if existing_request:
        return {"message": "Interest request already exists"}, 409

    interest_request = InterestRequest(
        requester_user_id=requester.id,
        target_user_id=target.id,
        status="pending",
    )

    db.session.add(interest_request)
    db.session.commit()

    queue_sms(
        recipient=target.phone_number,
        message=(
            f"Hi {target.name},\n"
            f"{requester.name} is interested in you.\n"
            f"Reply YES to receive their details."
        ),
        sender_id="22141",
    )

    return {
        "message": (
            f"Interest sent.\n"
            f"We have notified {target.name}.\n"
            f"You will receive their details if they accept."
        ),
        "interest_request_id": interest_request.id,
        "notify_target": {
            "to": target.phone_number,
            "message": (
                f"Hi {target.name},\n"
                f"{requester.name} is interested in you.\n"
                f"Reply YES to receive their details."
            )
        }
    }, 201


def handle_yes_command(user_id: int):
    responder = db.session.get(User, user_id)
    if not responder:
        return {"message": "User not found"}, 404

    interest_request = InterestRequest.query.filter_by(
        target_user_id=user_id,
        status="pending"
    ).order_by(InterestRequest.id.desc()).first()

    if not interest_request:
        return {"message": "No pending interest request found"}, 404

    existing_response = ConsentResponse.query.filter_by(
        interest_request_id=interest_request.id
    ).first()

    if existing_response:
        return {"message": "Consent response already exists"}, 409

    consent_response = ConsentResponse(
        interest_request_id=interest_request.id,
        responder_user_id=user_id,
        response="YES",
    )

    interest_request.status = "accepted"

    db.session.add(consent_response)
    db.session.commit()

    requester = db.session.get(User, interest_request.requester_user_id)

    # Notify requester that their interest was accepted
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

    return {
        "message": (
            "Congratulations!\n"
            f"You have a new match:\n"
            f"{requester.name}, {requester.phone_number}\n"
            "Feel free to connect!"
        )
    }, 200


def process_sms_command(sender: str | None, message: str):
    if not message or not message.strip():
        return {"message": "Message cannot be empty"}, 400

    message = message.strip()

    if message.upper() == "PENZI":
        return {
            "message": (
                "Welcome to PENZI!\n"
                "We have over 6000 potential matches for you.\n"
                "To register, SMS:\n"
                "start#name#age#gender#county#town\n"
                "Example:\n"
                "start#John Doe#26#Male#Nakuru#Naivasha"
            )
        }, 200

    if message.lower().startswith("start#"):
        return handle_start_command(sender, message)

    if not sender:
        return {"message": "Sender is required"}, 400

    user = get_user_by_phone(sender)

    if not user:
        return {"message": "You are not registered. Send PENZI to start."}, 404

    user_id = user.id

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

    if is_phone_number(message):
        return handle_phone_interest_command(user_id, message)

    return {"message": "Unknown SMS command"}, 400
