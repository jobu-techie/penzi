"""
app/models_otp.py
OTP model for two-factor login verification.
"""
from datetime import datetime, timezone
from app.extensions import db


class OTP(db.Model):
    __tablename__ = "otps"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code       = db.Column(db.String(6), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used       = db.Column(db.Boolean, default=False, nullable=False)
    attempts   = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("otps", lazy=True))
