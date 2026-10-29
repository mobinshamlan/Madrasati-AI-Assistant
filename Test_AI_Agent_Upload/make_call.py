"""
يتصل بولي الأمر (PARENT_PHONE) مكالمة ثنائية: ولي الأمر يتكلم والمساعد يرد.

الاستخدام:
    python make_call.py                          # لولوة + غياب محمد عن الرياضيات
    python make_call.py --persona turki
    python make_call.py --scenario exam_reminder --day الأحد --time "الحصة الثانية"

يحتاج في .env:  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, PARENT_PHONE, PUBLIC_URL
(PUBLIC_URL = رابط ngrok مثل https://xxxx.ngrok-free.app)
"""
import argparse
import os
from pathlib import Path
from urllib.parse import urlencode

from dotenv import load_dotenv
from twilio.rest import Client

load_dotenv(Path(__file__).resolve().parent / ".env")

ap = argparse.ArgumentParser()
ap.add_argument("--persona", choices=["lulwa", "turki"], default="lulwa")
ap.add_argument("--scenario", choices=["absence", "exam_grade", "exam_reminder"], default="absence")
ap.add_argument("--student", default="محمد")
ap.add_argument("--subject", default="الرياضيات")
ap.add_argument("--gender", choices=["m", "f"], default="m")
ap.add_argument("--assessment", default="الاختبار الأسبوعي")
ap.add_argument("--day", default="الأحد")
ap.add_argument("--time", default="الحصة الأولى")
args = ap.parse_args()

required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "PARENT_PHONE", "PUBLIC_URL"]
missing = [k for k in required if not os.getenv(k)]
if missing:
    raise SystemExit(f"Missing in .env: {', '.join(missing)}")

url = os.environ["PUBLIC_URL"].rstrip("/") + "/api/phone/voice?" + urlencode(vars(args))
client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
call = client.calls.create(
    url=url,
    method="POST",
    to=os.environ["PARENT_PHONE"],
    from_=os.environ["TWILIO_FROM"],
)
print("Call SID:", call.sid)
print("TwiML URL:", url)
