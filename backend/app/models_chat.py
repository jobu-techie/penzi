# app/models_chat.py
from datetime import datetime, timezone
from app.extensions import db


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    interest_request_id = db.Column(
        db.Integer,
        db.ForeignKey("interest_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    receiver_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    sender = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])

    def to_dict(self):
        return {
            "id": self.id,
            "interest_request_id": self.interest_request_id,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "sender_name": self.sender.name if self.sender else None,
            "content": self.content,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }