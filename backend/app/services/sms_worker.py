import logging
from datetime import datetime, timezone
from time import sleep

from app import create_app, db
from app.models import SmsOutbox
from app.services.onfon_service import send_onfon_sms

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def process_outbox():
    app = create_app()
    with app.app_context():
        logger.info("SMS worker started.")
        while True:
            try:
                pending_messages = SmsOutbox.query.filter_by(status="pending").all()

                for msg in pending_messages:
                    try:
                        send_onfon_sms(msg.recipient, msg.message)
                        msg.status = "sent"
                        msg.sent_at = datetime.now(timezone.utc)
                        logger.info(f"SMS sent to {msg.recipient}")
                    except Exception as e:
                        msg.status = "failed"
                        logger.error(f"Failed to send SMS to {msg.recipient}: {e}")

                # Commit all updates in one go
                if pending_messages:
                    db.session.commit()

            except Exception as e:
                logger.error(f"Worker error: {e}")

            sleep(5)


if __name__ == "__main__":
    try:
        process_outbox()
    except KeyboardInterrupt:
        logger.info("SMS worker stopped.")
