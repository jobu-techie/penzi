"""
app/models_subscription.py
Subscription & Payment Models for Penzi
"""

from datetime import datetime, timezone
from app.extensions import db  # ← changed from "from app import db"


class SubscriptionPlan(db.Model):
    """Defines available subscription tiers."""
    __tablename__ = "subscription_plans"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    price_kes = db.Column(db.Float, nullable=False, default=0)
    duration_days = db.Column(db.Integer, nullable=False)
    daily_search_limit = db.Column(db.Integer, default=10)   # -1 = unlimited
    can_see_who_liked = db.Column(db.Boolean, default=False)
    can_boost_profile = db.Column(db.Boolean, default=False)
    can_super_like = db.Column(db.Boolean, default=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price_kes": self.price_kes,
            "duration_days": self.duration_days,
            "daily_search_limit": self.daily_search_limit,
            "can_see_who_liked": self.can_see_who_liked,
            "can_boost_profile": self.can_boost_profile,
            "can_super_like": self.can_super_like,
            "description": self.description,
        }


class UserSubscription(db.Model):
    """Tracks active/past subscriptions for each user."""
    __tablename__ = "user_subscriptions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    plan_id = db.Column(db.Integer, db.ForeignKey("subscription_plans.id"), nullable=False)
    status = db.Column(db.String(20), default="active")   # active | expired | cancelled
    starts_at = db.Column(db.DateTime(timezone=True), nullable=False,
                          default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)  # ← timezone=True added
    created_at = db.Column(db.DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc))

    plan = db.relationship("SubscriptionPlan", backref="subscriptions")

    @property
    def is_active(self):
        return self.status == "active" and self.expires_at > datetime.now(timezone.utc)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "plan": self.plan.to_dict() if self.plan else None,
            "status": self.status,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
        }


class CoinWallet(db.Model):
    """Each user has one coin wallet."""
    __tablename__ = "coin_wallets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    balance = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "balance": self.balance,
        }


class CoinTransaction(db.Model):
    """Audit trail for every coin credit/debit."""
    __tablename__ = "coin_transactions"

    id = db.Column(db.Integer, primary_key=True)
    wallet_id = db.Column(db.Integer, db.ForeignKey("coin_wallets.id"), nullable=False)
    amount = db.Column(db.Integer, nullable=False)       # positive = credit, negative = debit
    reason = db.Column(db.String(100), nullable=False)   # "top_up", "super_like", "boost"
    reference = db.Column(db.String(100))
    created_at = db.Column(db.DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "amount": self.amount,
            "reason": self.reason,
            "reference": self.reference,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Payment(db.Model):
    """Records every M-Pesa payment attempt."""
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    amount_kes = db.Column(db.Float, nullable=False)
    purpose = db.Column(db.String(50), nullable=False)   # "subscription" | "coins"
    plan_id = db.Column(db.Integer, db.ForeignKey("subscription_plans.id"), nullable=True)
    coins_purchased = db.Column(db.Integer, default=0)
    provider = db.Column(db.String(30), default="mpesa")
    phone_number = db.Column(db.String(20))
    merchant_request_id = db.Column(db.String(100))
    checkout_request_id = db.Column(db.String(100))
    mpesa_receipt = db.Column(db.String(50))
    status = db.Column(db.String(20), default="pending")  # pending | completed | failed
    raw_callback = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime(timezone=True))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "amount_kes": self.amount_kes,
            "purpose": self.purpose,
            "coins_purchased": self.coins_purchased,
            "provider": self.provider,
            "phone_number": self.phone_number,
            "mpesa_receipt": self.mpesa_receipt,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class DailySearchCount(db.Model):
    """Tracks how many searches a free-tier user has done today."""
    __tablename__ = "daily_search_counts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    count = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.UniqueConstraint("user_id", "date", name="uq_user_date"),
    )

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "date": self.date.isoformat() if self.date else None,
            "count": self.count,
        }