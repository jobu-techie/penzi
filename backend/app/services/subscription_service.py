"""
app/services/subscription_service.py
Business logic for subscriptions, coin wallets, and M-Pesa payments.
"""

import json
import logging
from datetime import datetime, timezone, timedelta, date

from app.extensions import db  # ← changed from "from app import db"
from app.models_subscription import (
    SubscriptionPlan,
    UserSubscription,
    CoinWallet,
    CoinTransaction,
    Payment,
    DailySearchCount,
)
from app.services.mpesa_service import stk_push, process_stk_callback

logger = logging.getLogger(__name__)


# ── Coin packages available for purchase ──────────────────────────────────────
COIN_PACKAGES = [
    {"id": 1, "coins": 50,  "price_kes": 50,  "label": "Starter"},
    {"id": 2, "coins": 120, "price_kes": 100, "label": "Popular"},
    {"id": 3, "coins": 300, "price_kes": 200, "label": "Value"},
    {"id": 4, "coins": 700, "price_kes": 400, "label": "Premium"},
]

COIN_COSTS = {
    "super_like": 10,
    "boost_profile": 50,
    "unlock_liker": 5,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_or_create_wallet(user_id: int) -> CoinWallet:
    wallet = CoinWallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        wallet = CoinWallet(user_id=user_id, balance=0)
        db.session.add(wallet)
        db.session.flush()
    return wallet


def get_active_subscription(user_id: int):
    """Return the user's current active subscription, or None."""
    return UserSubscription.query.filter_by(
        user_id=user_id, status="active"
    ).filter(
        UserSubscription.expires_at > datetime.now(timezone.utc)
    ).first()


def user_is_premium(user_id: int) -> bool:
    sub = get_active_subscription(user_id)
    if not sub:
        return False
    return sub.plan.name != "free"


def check_search_limit(user_id: int) -> tuple[bool, str]:
    """Returns (allowed: bool, reason: str)."""
    sub = get_active_subscription(user_id)
    if sub and sub.plan.daily_search_limit == -1:
        return True, "ok"

    limit = sub.plan.daily_search_limit if sub else 10

    today = date.today()
    record = DailySearchCount.query.filter_by(user_id=user_id, date=today).first()
    count = record.count if record else 0

    if count >= limit:
        return False, f"Daily search limit of {limit} reached. Upgrade to Premium for unlimited searches."
    return True, "ok"


def increment_search_count(user_id: int):
    today = date.today()
    record = DailySearchCount.query.filter_by(user_id=user_id, date=today).first()
    if record:
        record.count += 1
    else:
        record = DailySearchCount(user_id=user_id, date=today, count=1)
        db.session.add(record)
    db.session.commit()


# ── Plans ─────────────────────────────────────────────────────────────────────

def seed_plans():
    try:
        defaults = [
            {
                "name": "free",
                "price_kes": 0,
                "duration_days": 36500,
                "daily_search_limit": 10,
                "can_see_who_liked": False,
                "can_boost_profile": False,
                "can_super_like": False,
                "description": "10 searches per day. Basic matching.",
            },
            {
                "name": "premium_monthly",
                "price_kes": 50,
                "duration_days": 30,
                "daily_search_limit": -1,
                "can_see_who_liked": True,
                "can_boost_profile": True,
                "can_super_like": True,
                "description": "Unlimited searches, see who liked you, profile boosts.",
            },
            {
                "name": "premium_quarterly",
                "price_kes": 300,
                "duration_days": 90,
                "daily_search_limit": -1,
                "can_see_who_liked": True,
                "can_boost_profile": True,
                "can_super_like": True,
                "description": "3 months premium at a discounted rate.",
            },
        ]
        for d in defaults:
            if not SubscriptionPlan.query.filter_by(name=d["name"]).first():
                db.session.add(SubscriptionPlan(**d))
        db.session.commit()
    except Exception as e:
        print(f"Skipping seed_plans (tables may not exist yet): {e}")


def get_all_plans():
    plans = SubscriptionPlan.query.all()
    return [p.to_dict() for p in plans], 200


# ── Subscription purchase ─────────────────────────────────────────────────────

def initiate_subscription_payment(user_id: int, plan_id: int, phone_number: str):
    from app.models import User
    user = db.session.get(User, user_id)  # ← updated from User.query.get()
    if not user:
        return {"error": "User not found"}, 404

    plan = db.session.get(SubscriptionPlan, plan_id)  # ← updated
    if not plan:
        return {"error": "Plan not found"}, 404

    if plan.price_kes == 0:
        _activate_subscription(user_id, plan)
        return {"message": "Free plan activated successfully."}, 200

    try:
        stk_resp = stk_push(
            phone_number=phone_number,
            amount=int(plan.price_kes),
            account_reference=f"PENZI-SUB-{user_id}",
            description=f"Penzi {plan.name} subscription",
        )
    except Exception as e:
        logger.exception("STK push failed")
        return {"error": f"Payment initiation failed: {str(e)}"}, 502

    if stk_resp.get("ResponseCode") != "0":
        return {"error": stk_resp.get("errorMessage", "STK push rejected")}, 400

    payment = Payment(
        user_id=user_id,
        amount_kes=plan.price_kes,
        purpose="subscription",
        plan_id=plan.id,
        provider="mpesa",
        phone_number=phone_number,
        merchant_request_id=stk_resp.get("MerchantRequestID"),
        checkout_request_id=stk_resp.get("CheckoutRequestID"),
        status="pending",
    )
    db.session.add(payment)
    db.session.commit()

    return {
        "message": "STK push sent. Enter M-Pesa PIN on your phone.",
        "checkout_request_id": stk_resp.get("CheckoutRequestID"),
        "payment_id": payment.id,
    }, 200


def _activate_subscription(user_id: int, plan: SubscriptionPlan):
    """Mark any existing active sub as expired, then create a new one."""
    existing = get_active_subscription(user_id)
    if existing:
        existing.status = "expired"

    now = datetime.now(timezone.utc)
    new_sub = UserSubscription(
        user_id=user_id,
        plan_id=plan.id,
        status="active",
        starts_at=now,
        expires_at=now + timedelta(days=plan.duration_days),
    )
    db.session.add(new_sub)
    db.session.flush()


# ── M-Pesa callback handling ──────────────────────────────────────────────────

def handle_mpesa_callback(callback_data: dict):
    parsed = process_stk_callback(callback_data)
    checkout_id = parsed.get("checkout_request_id")

    payment = Payment.query.filter_by(checkout_request_id=checkout_id).first()
    if not payment:
        logger.warning(f"No payment found for CheckoutRequestID={checkout_id}")
        return {"error": "Payment not found"}, 404

    payment.raw_callback = json.dumps(callback_data)

    if parsed["result_code"] != 0:
        payment.status = "failed"
        db.session.commit()
        return {"message": "Payment failed or cancelled."}, 200

    payment.status = "completed"
    payment.mpesa_receipt = parsed.get("mpesa_receipt")
    payment.completed_at = datetime.now(timezone.utc)

    if payment.purpose == "subscription" and payment.plan_id:
        plan = db.session.get(SubscriptionPlan, payment.plan_id)  # ← updated
        if plan:
            _activate_subscription(payment.user_id, plan)

    elif payment.purpose == "coins" and payment.coins_purchased:
        wallet = get_or_create_wallet(payment.user_id)
        wallet.balance += payment.coins_purchased
        txn = CoinTransaction(
            wallet_id=wallet.id,
            amount=payment.coins_purchased,
            reason="top_up",
            reference=payment.mpesa_receipt,
        )
        db.session.add(txn)

    db.session.commit()
    return {"message": "Payment processed successfully."}, 200


# ── Coin top-up ───────────────────────────────────────────────────────────────

def initiate_coin_topup(user_id: int, package_id: int, phone_number: str):
    from app.models import User
    user = db.session.get(User, user_id)  # ← updated
    if not user:
        return {"error": "User not found"}, 404

    pkg = next((p for p in COIN_PACKAGES if p["id"] == package_id), None)
    if not pkg:
        return {"error": "Invalid coin package"}, 404

    try:
        stk_resp = stk_push(
            phone_number=phone_number,
            amount=int(pkg["price_kes"]),
            account_reference=f"PENZI-COINS-{user_id}",
            description=f"Penzi {pkg['coins']} coins top-up",
        )
    except Exception as e:
        logger.exception("Coin STK push failed")
        return {"error": f"Payment initiation failed: {str(e)}"}, 502

    if stk_resp.get("ResponseCode") != "0":
        return {"error": stk_resp.get("errorMessage", "STK push rejected")}, 400

    payment = Payment(
        user_id=user_id,
        amount_kes=pkg["price_kes"],
        purpose="coins",
        coins_purchased=pkg["coins"],
        provider="mpesa",
        phone_number=phone_number,
        merchant_request_id=stk_resp.get("MerchantRequestID"),
        checkout_request_id=stk_resp.get("CheckoutRequestID"),
        status="pending",
    )
    db.session.add(payment)
    db.session.commit()

    return {
        "message": "STK push sent. Enter M-Pesa PIN on your phone.",
        "checkout_request_id": stk_resp.get("CheckoutRequestID"),
        "coins": pkg["coins"],
        "payment_id": payment.id,
    }, 200


# ── Coin spending ─────────────────────────────────────────────────────────────

def spend_coins(user_id: int, action: str) -> tuple[bool, str]:
    cost = COIN_COSTS.get(action)
    if cost is None:
        return False, "Unknown action"

    wallet = get_or_create_wallet(user_id)
    if wallet.balance < cost:
        return False, f"Insufficient coins. You need {cost} coins for {action}."

    wallet.balance -= cost
    txn = CoinTransaction(
        wallet_id=wallet.id,
        amount=-cost,
        reason=action,
    )
    db.session.add(txn)
    db.session.commit()
    return True, f"Action {action} completed. {cost} coins deducted."


# ── Wallet info ───────────────────────────────────────────────────────────────

def get_wallet_info(user_id: int):
    wallet = get_or_create_wallet(user_id)
    db.session.commit()

    transactions = CoinTransaction.query.filter_by(wallet_id=wallet.id)\
        .order_by(CoinTransaction.created_at.desc()).limit(20).all()

    return {
        "balance": wallet.balance,
        "transactions": [t.to_dict() for t in transactions],
        "coin_packages": COIN_PACKAGES,
        "coin_costs": COIN_COSTS,
    }, 200


def get_subscription_status(user_id: int):
    sub = get_active_subscription(user_id)
    wallet = get_or_create_wallet(user_id)
    db.session.commit()

    today = date.today()
    search_record = DailySearchCount.query.filter_by(user_id=user_id, date=today).first()
    searches_today = search_record.count if search_record else 0

    daily_limit = sub.plan.daily_search_limit if sub else 10

    return {
        "subscription": sub.to_dict() if sub else None,
        "is_premium": user_is_premium(user_id),
        "coin_balance": wallet.balance,
        "searches_today": searches_today,
        "daily_search_limit": daily_limit,
    }, 200