import os
from dotenv import load_dotenv

load_dotenv()  # ← loads .env before anything else

from app import create_app

app = create_app()

if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug)