from time import sleep
from app import create_app, db
from app.models import SmsOutbox
from app.services.onfon_service import send_onfon_sms


def process_outbox():
    app = create_app()

    with app.app_context():
        while True:
            pending_messages = SmsOutbox.query.filter_by(status="pending").all()

            for msg in pending_messages:
                try:
                    send_onfon_sms(msg.recipient, msg.message)

                    msg.status = "sent"
                except Exception as e:
                    msg.status = "failed"

                db.session.commit()

            sleep(5)  # check every 5 seconds


if __name__ == "__main__":
    process_outbox()
