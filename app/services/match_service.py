from app import db
from app.models import User, MatchRequest, MatchResult, UserDescription, UserDetails


def create_match_request(user_id: int, data: dict):
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}, 404

    required_fields = ["age_range_min", "age_range_max", "county"]
    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return {"error": f"{field} is required"}, 400

    try:
        age_range_min = int(data["age_range_min"])
        age_range_max = int(data["age_range_max"])
    except (TypeError, ValueError):
        return {"error": "age_range_min and age_range_max must be numbers"}, 400

    if age_range_min > age_range_max:
        return {"error": "age_range_min cannot be greater than age_range_max"}, 400

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

    first_batch = matches[:3]
    stored_results = []

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

    return {
        "message": "Matches found successfully",
        "match_request_id": match_request.id,
        "total_matches": len(matches),
        "returned_matches": len(first_batch),
        "matches": stored_results
    }, 200


def get_next_matches(match_request_id: int):
    match_request = db.session.get(MatchRequest, match_request_id)
    if not match_request:
        return {"error": "Match request not found"}, 404

    requester = db.session.get(User, match_request.user_id)
    if not requester:
        return {"error": "Requesting user not found"}, 404

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

    return {
        "message": "Next matches retrieved successfully",
        "match_request_id": match_request.id,
        "returned_matches": len(returned_matches),
        "matches": returned_matches
    }, 200


def get_user_description_by_phone(phone_number: str):
    user = User.query.filter_by(phone_number=phone_number).first()
    if not user:
        return {"error": "User not found"}, 404

    description = UserDescription.query.filter_by(user_id=user.id).first()
    if not description:
        return {"error": "User description not found"}, 404

    return {
        "message": "User description retrieved successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "phone_number": user.phone_number,
        },
        "description": description.description
    }, 200


def get_user_details_by_phone(phone_number: str):
    user = User.query.filter_by(phone_number=phone_number).first()
    if not user:
        return {"error": "User not found"}, 404

    details = UserDetails.query.filter_by(user_id=user.id).first()

    return {
        "id": user.id,
        "name": user.name,
        "age": user.age,
        "county": user.county,
        "town": user.town,
        "phone_number": user.phone_number,
        "details": details.to_dict() if details else None,
    }, 200
