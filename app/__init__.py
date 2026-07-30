from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from app.extensions import db, limiter


def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config.Config")

    db.init_app(app)
    Migrate(app, db)
    CORS(app)
    JWTManager(app)
    limiter.init_app(app)

    #  Import ALL models here so SQLAlchemy registers them
    with app.app_context():
        from app import models          # your main models (User, InterestRequest, etc.)
        from app import models_chat     # ChatMessage
        from app import models_subscription
        from app.models_otp import OTP
        from app import models_support  # SupportMessage

    from app.routes import bp
    app.register_blueprint(bp)

    from app.routes_chat import chat_bp
    app.register_blueprint(chat_bp)

    from app.routes_subscription import sub_bp
    app.register_blueprint(sub_bp)

    from app.routes_otp import otp_bp
    app.register_blueprint(otp_bp)

    from app.routes_support import support_bp
    app.register_blueprint(support_bp)

    @app.cli.command("seed-plans")
    def seed_plans_cmd():
        from app.services.subscription_service import seed_plans
        seed_plans()
        print("✅ Plans seeded successfully.")

    return app

