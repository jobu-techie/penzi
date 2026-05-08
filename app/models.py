from enum import Enum
from datetime import datetime, timezone

from app import db


class GenderEnum(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gender = db.Column(db.Enum(GenderEnum), nullable=False)
    county = db.Column(db.String(100), nullable=False)
    town = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    details = db.relationship("UserDetails", backref="user", uselist=False, cascade="all, delete-orphan")
    description = db.relationship("UserDescription", backref="user", uselist=False, cascade="all, delete-orphan")
    match_requests = db.relationship("MatchRequest", backref="user", cascade="all, delete-orphan")

    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)
        password_hash = db.Column(db.String(255), nullable=True)

    def check_password(self, password):
        from werkzeug.security import check_password_hash
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "age": self.age,
            "gender": self.gender,
            "county": self.county,
            "town": self.town,
            "phone_number": self.phone_number,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserDetails(db.Model):
    __tablename__ = "user_details"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    education_level = db.Column(db.String(100))
    profession = db.Column(db.String(100))
    marital_status = db.Column(db.String(50))
    religion = db.Column(db.String(50))
    ethnicity = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "education_level": self.education_level,
            "profession": self.profession,
            "marital_status": self.marital_status,
            "religion": self.religion,
            "ethnicity": self.ethnicity,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserDescription(db.Model):
    __tablename__ = "user_descriptions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class MatchRequest(db.Model):
    __tablename__ = "match_requests"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    age_range_min = db.Column(db.Integer, nullable=False)
    age_range_max = db.Column(db.Integer, nullable=False)
    town = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    results = db.relationship("MatchResult", backref="match_request", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "age_range_min": self.age_range_min,
            "age_range_max": self.age_range_max,
            "town": self.town,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class MatchResult(db.Model):
    __tablename__ = "match_results"

    id = db.Column(db.Integer, primary_key=True)
    match_request_id = db.Column(db.Integer, db.ForeignKey("match_requests.id"), nullable=False)
    matched_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    result_order = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "match_request_id": self.match_request_id,
            "matched_user_id": self.matched_user_id,
            "result_order": self.result_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class InterestRequest(db.Model):
    __tablename__ = "interest_requests"

    id = db.Column(db.Integer, primary_key=True)
    requester_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(20), default="pending")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    consent = db.relationship("ConsentResponse", backref="interest_request", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "requester_user_id": self.requester_user_id,
            "target_user_id": self.target_user_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ConsentResponse(db.Model):
    __tablename__ = "consent_responses"

    id = db.Column(db.Integer, primary_key=True)
    interest_request_id = db.Column(db.Integer, db.ForeignKey("interest_requests.id"), unique=True, nullable=False)
    responder_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    response = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "interest_request_id": self.interest_request_id,
            "responder_user_id": self.responder_user_id,
            "response": self.response,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SmsLog(db.Model):
    __tablename__ = "sms_logs"

    id = db.Column(db.Integer, primary_key=True)
    direction = db.Column(db.String(10), nullable=False)
    sender = db.Column(db.String(20), nullable=False)
    recipient = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text, nullable=False)
    shortcode = db.Column(db.String(20))
    status = db.Column(db.String(20), default="received")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "direction": self.direction,
            "sender": self.sender,
            "recipient": self.recipient,
            "message": self.message,
            "shortcode": self.shortcode,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SmsOutbox(db.Model):
    __tablename__ = "sms_outbox"

    id = db.Column(db.Integer, primary_key=True)
    recipient = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text, nullable=False)
    sender_id = db.Column(db.String(20), default="22141")
    status = db.Column(db.String(20), default="pending")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    sent_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            "id": self.id,
            "recipient": self.recipient,
            "message": self.message,
            "sender_id": self.sender_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
        }