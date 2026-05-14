from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from app.extensions import db


def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config.Config")
    app.config["JWT_SECRET_KEY"] = "penzi-super-secret-jwt-key-change-in-production"

    db.init_app(app)
    Migrate(app, db)
    CORS(app)
    JWTManager(app)

    # ✅ Import ALL models here so SQLAlchemy registers them
    with app.app_context():
        from app import models          # your main models (User, InterestRequest, etc.)
        from app import models_chat     # ChatMessage
        from app import models_subscription 

    from app.routes import bp
    app.register_blueprint(bp)

    from app.routes_chat import chat_bp
    app.register_blueprint(chat_bp)

    from app.routes_subscription import sub_bp
    app.register_blueprint(sub_bp)

    with app.app_context():
        from app.services.subscription_service import seed_plans
        seed_plans()

    @app.cli.command("seed-plans")
    def seed_plans_cmd():
        from app.services.subscription_service import seed_plans
        seed_plans()
        print("✅ Plans seeded successfully.")

    return app

