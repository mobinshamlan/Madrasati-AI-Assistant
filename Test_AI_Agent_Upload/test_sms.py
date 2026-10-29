import os
from pathlib import Path

from dotenv import load_dotenv
from twilio.rest import Client

load_dotenv(Path(__file__).resolve().parent / ".env")

required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "PARENT_PHONE"]
missing = [k for k in required if not os.getenv(k)]
if missing:
    raise SystemExit(f"Missing in .env: {', '.join(missing)}")

client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])

student = "محمد"
subject = "الرياضيات"
body = f"السلام عليكم، معك طمّني من مدرستي.\nنبلغك أن ابنك {student} لم يحضر حصة {subject} اليوم."

message = client.messages.create(
    from_="Tammeni",
    to=os.environ["PARENT_PHONE"],
    body=body,
)
print("Message SID:", message.sid)
print("Status:", message.status)