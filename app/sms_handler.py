from app.services.sms_service import process_sms_command


def process_sms(user_id: int | None, message: str):
    return process_sms_command(user_id, message)
