"""
app/routes_subscription.py
Register this blueprint in your app/__init__.py:

    from app.routes_subscription import sub_bp
    app.register_blueprint(sub_bp)
"""

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.subscription_service import (
    get_all_plans,
    initiate_subscription_payment,
    initiate_coin_topup,
    handle_mpesa_callback,
    get_wallet_info,
    get_subscription_status,
    spend_coins,
    COIN_PACKAGES,
)

sub_bp = Blueprint("subscription", __name__, url_prefix="/subscription")


# ── Plans ─────────────────────────────────────────────────────────────────────

@sub_bp.route("/plans", methods=["GET"])
def list_plans():
    """List all subscription plans."""
    result, code = get_all_plans()
    return jsonify(result), code


# ── Subscription purchase ─────────────────────────────────────────────────────

@sub_bp.route("/subscribe", methods=["POST"])
@jwt_required()
def subscribe():
    """
    Initiate a subscription payment via M-Pesa STK push.
    Body: { "plan_id": int, "phone_number": str }
    """
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    plan_id = data.get("plan_id")
    phone = data.get("phone_number", "").strip()

    if not plan_id:
        return jsonify({"error": "plan_id is required"}), 400
    if not phone:
        return jsonify({"error": "phone_number is required"}), 400

    result, code = initiate_subscription_payment(user_id, plan_id, phone)
    return jsonify(result), code


@sub_bp.route("/subscription/status", methods=["GET"])
@jwt_required()
def subscription_status():
    """Get current user's subscription + coin balance."""
    user_id = int(get_jwt_identity())
    result, code = get_subscription_status(user_id)
    return jsonify(result), code


# ── Coin wallet ───────────────────────────────────────────────────────────────

@sub_bp.route("/wallet", methods=["GET"])
@jwt_required()
def wallet():
    """Get coin balance, transaction history, and available packages."""
    user_id = int(get_jwt_identity())
    result, code = get_wallet_info(user_id)
    return jsonify(result), code


@sub_bp.route("/wallet/topup", methods=["POST"])
@jwt_required()
def topup_coins():
    """
    Buy a coin package via M-Pesa STK push.
    Body: { "package_id": int, "phone_number": str }
    """
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    package_id = data.get("package_id")
    phone = data.get("phone_number", "").strip()

    if not package_id:
        return jsonify({"error": "package_id is required"}), 400
    if not phone:
        return jsonify({"error": "phone_number is required"}), 400

    result, code = initiate_coin_topup(user_id, package_id, phone)
    return jsonify(result), code


@sub_bp.route("/wallet/spend", methods=["POST"])
@jwt_required()
def spend():
    """
    Spend coins on a premium action.
    Body: { "action": "super_like" | "boost_profile" | "unlock_liker" }
    """
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    action = data.get("action", "").strip()

    if not action:
        return jsonify({"error": "action is required"}), 400

    success, message = spend_coins(user_id, action)
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message}), 200


@sub_bp.route("/coins/packages", methods=["GET"])
def coin_packages():
    """Return all available coin packages."""
    return jsonify(COIN_PACKAGES), 200


# ── M-Pesa webhook ────────────────────────────────────────────────────────────

@sub_bp.route("/webhook/mpesa", methods=["POST"])
def mpesa_callback():
    """
    M-Pesa Daraja posts payment results here.
    Set MPESA_CALLBACK_URL to https://yourdomain.com/webhook/mpesa
    This endpoint must be publicly accessible (use ngrok in dev).
    """
    data = request.get_json(silent=True)
    if not data:
        return "Invalid request", 400

    result, code = handle_mpesa_callback(data)
    # M-Pesa expects a 200 response
    return jsonify(result), 200


# ── Payment status poll (frontend polling) ────────────────────────────────────

@sub_bp.route("/payment/<int:payment_id>/status", methods=["GET"])
@jwt_required()
def payment_status(payment_id):
    """
    Poll payment status.
    Frontend polls this after STK push until status != 'pending'.
    """
    from app.models_subscription import Payment
    user_id = int(get_jwt_identity())

    payment = Payment.query.filter_by(id=payment_id, user_id=user_id).first()
    if not payment:
        return jsonify({"error": "Payment not found"}), 404

    return jsonify(payment.to_dict()), 200
