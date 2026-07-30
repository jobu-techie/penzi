# app/models_support.py
from datetime import datetime, timezone
from app.extensions import db


class SupportMessage(db.Model):
    __tablename__ = "support_messages"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender = db.Column(db.String(10), nullable=False)  # "user" | "admin"
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "sender": self.sender,
            "content": self.content,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }
