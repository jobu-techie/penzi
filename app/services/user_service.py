from app import db
from app.models import GenderEnum, User, UserDetails, UserDescription


def validate_gender(gender_text: str):
    gender_input = str(gender_text).strip().capitalize()
    try:
        return GenderEnum(gender_input)
    except ValueError:
        return None


def create_user(data: dict):
    required_fields = ["name", "age", "gender", "county", "town", "phone_number"]
    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return {"error": f"{field} is required"}, 400

    try:
        age = int(data["age"])
    except (TypeError, ValueError):
        return {"error": "age must be a number"}, 400

    if age < 18:
        return {"error": "User must be at least 18 years old"}, 400

    gender = validate_gender(data["gender"])
    if not gender:
        return {"error": "Invalid gender. Allowed values are: Male, Female"}, 400

    phone_number = str(data["phone_number"]).strip()
    existing_user = User.query.filter_by(phone_number=phone_number).first()
    if existing_user:
        return {"error": "Phone number already exists"}, 409

    user = User(
        name=str(data["name"]).strip(),
        age=age,
        gender=gender,
        county=str(data["county"]).strip(),
        town=str(data["town"]).strip(),
        phone_number=phone_number,
    )

    db.session.add(user)
    db.session.commit()

    return {
        "message": "User registered successfully",
        "user": user.to_dict()
    }, 201


def add_user_details(user_id: int, data: dict):
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}, 404

    required_fields = [
        "education_level",
        "profession",
        "marital_status",
        "religion",
        "ethnicity",
    ]

    for field in required_fields:
        if field not in data or str(data[field]).strip() == "":
            return {"error": f"{field} is required"}, 400

    existing_details = UserDetails.query.filter_by(user_id=user_id).first()
    if existing_details:
        return {"error": "User details already exist"}, 409

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

    return {
        "message": "User details added successfully",
        "user_id": user_id,
        "details": details.to_dict()
    }, 201


def add_user_description(user_id: int, data: dict):
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found"}, 404

    # Check details step is complete first
    existing_details = UserDetails.query.filter_by(user_id=user_id).first()
    if not existing_details:
        return {
            "error": "Please complete user details first before adding a description."
        }, 400

    if "description" not in data or str(data["description"]).strip() == "":
        return {"error": "description is required"}, 400

    existing_description = UserDescription.query.filter_by(user_id=user_id).first()
    if existing_description:
        return {"error": "User description already exists"}, 409

    description = UserDescription(
        user_id=user_id,
        description=str(data["description"]).strip(),
    )

    db.session.add(description)
    db.session.commit()

    return {
        "message": "User description added successfully",
        "user_id": user_id,
        "description": description.to_dict()
    }, 201


def get_all_users(page: int = 1, per_page: int = 20):
    pagination = User.query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "users": [user.to_dict() for user in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages,
        "per_page": pagination.per_page,
    }, 200


def get_user_profile(user_id: int):
    user = db.session.get(User, user_id)

    if not user:
        return {"error": "User not found"}, 404

    result = user.to_dict()

    if user.details:
        result["details"] = user.details.to_dict()

    if user.description:
        result["description"] = user.description.to_dict()

    return result, 200
