import base64
import os
from dotenv import load_dotenv

load_dotenv()

REQUIRED_ENV_VARS = [
    "DB_USER", "DB_PASSWORD", "DB_HOST", "DB_NAME",
    "ONFON_API_KEY", "ONFON_WEBHOOK_TOKEN",
    "JWT_SECRET_KEY", "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH_B64",
]

for var in REQUIRED_ENV_VARS:
    if not os.getenv(var):
        raise ValueError(f"Missing required environment variable: {var}")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY") or os.urandom(24)
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
        f"@{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
    # Stored base64-encoded because the raw werkzeug hash contains "$",
    # which docker-compose's .env variable interpolation silently corrupts.
    _admin_hash_b64 = os.getenv("ADMIN_PASSWORD_HASH_B64", "")
    ADMIN_PASSWORD_HASH = (
        base64.b64decode(_admin_hash_b64).decode() if _admin_hash_b64 else None
    )

    ONFON_API_KEY = os.getenv("ONFON_API_KEY")
    ONFON_SENDER_ID = os.getenv("ONFON_SENDER_ID", "22141")
    ONFON_SMS_URL = os.getenv(
        "ONFON_SMS_URL",
        "https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS",
    )
    ONFON_WEBHOOK_TOKEN = os.getenv("ONFON_WEBHOOK_TOKEN")
    ONFON_REPLY_MODE = os.getenv("ONFON_REPLY_MODE", "direct").lower()
    APP_BASE_URL = os.getenv("APP_BASE_URL", "")
