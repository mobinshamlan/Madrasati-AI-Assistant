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
message = f"السلام عليكم. معك طمّني من مدرستي. نبلغك أن ابنك {student} لم يحضر حصة {subject} اليوم."

twiml = f"""
<Response>
  <Say voice="Polly.Hala-Neural" language="ar-AE">{message}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Hala-Neural" language="ar-AE">شكراً لك. مع السلامة.</Say>
</Response>
"""

call = client.calls.create(
    twiml=twiml,
    to=os.environ["PARENT_PHONE"],
    from_=os.environ["TWILIO_FROM"],
)
print("Call SID:", call.sid)