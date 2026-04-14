from app.services.sms_service import process_sms_command


def process_sms(sender: str, message: str):
    return process_sms_command(sender, message)
