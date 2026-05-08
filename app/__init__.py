from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config.Config")

    app.config["JWT_SECRET_KEY"] = "penzi-super-secret-jwt-key-change-in-production"

    db.init_app(app)
    Migrate(app, db)
    CORS(app)
    JWTManager(app)

    from app.routes import bp
    app.register_blueprint(bp)

    return app