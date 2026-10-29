"""
القرار: لما المدرسة تسجل حدث، نقرأ تفضيل ولي الأمر ونقرر اتصال / رسالة / ولا شي.

في الديمو أي تنبيه مفعّل (غير "off") ينفذ فورا؛ جدولة الأوقات (نهاية اليوم، قبل الاختبار بيوم...)
خارج نطاق الديمو.
"""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from dotenv import load_dotenv

from backend import store

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
log = logging.getLogger("tammeni.notifier")

# attendance event -> prefs topic
TOPIC_OF = {"attendance": "attendance", "grade": "grades", "exam": "exams"}
SCENARIO_OF = {"attendance": "absence", "grade": "exam_grade", "exam": "exam_reminder"}
PUBLIC_URL_FILE = ROOT / "Data" / "public_url.txt"


def public_url() -> str:
    """PUBLIC_URL من البيئة، أو من ملف يكتبه run_demo.sh بعد ما يشغّل ngrok."""
    url = os.getenv("PUBLIC_URL", "")
    if not url:
        try:
            url = PUBLIC_URL_FILE.read_text(encoding="utf-8").strip()
        except OSError:
            url = ""
    return url.rstrip("/")


def decide(event: dict[str, Any]) -> dict[str, Any]:
    """يرجع {action: call|message|skipped, reason}. بدون أي اتصال خارجي."""
    topic = TOPIC_OF[event["type"]]
    prefs, inherited = store.get_preferences_or_sibling(event["student_id"])
    if not prefs:
        return {"action": "skipped", "reason": "ولي الأمر ما حفظ تفضيلات لهذا الابن"}
    cfg = prefs.get(topic) or {}
    timing = cfg.get("timing")
    if timing in (None, "off"):
        return {"action": "skipped", "reason": "ولي الأمر اختار «بدون تنبيه» لهذا النوع"}
    method = cfg.get("method")
    if method not in ("call", "message"):
        return {"action": "skipped", "reason": "طريقة التواصل غير محددة"}
    return {"action": method, "reason": "تفضيلات الأخ/الأخت (ما حُفظت تفضيلات لهذا الابن)" if inherited else ""}


def _call_url(event: dict[str, Any], student: dict[str, Any]) -> str:
    params = {
        "persona": event.get("persona") or os.getenv("DEMO_PERSONA", "lulwa"),
        "scenario": SCENARIO_OF[event["type"]],
        "student": student["student_name"],
        "gender": student.get("gender", "m"),
        "subject": event.get("subject_name", ""),
        "assessment": event.get("assessment", "الاختبار الأسبوعي"),
        "day": event.get("day", "الأحد"),
        "time": event.get("time", "٨:٠٠ صباحا"),
    }
    return public_url() + "/api/phone/voice?" + urlencode(params)


def _sms_body(event: dict[str, Any], student: dict[str, Any]) -> str:
    name, subject = student["student_name"], event.get("subject_name", "")
    head = "السلام عليكم، معك طمّني من مدرستي.\n"
    if event["type"] == "attendance":
        return head + f"نبلغك أن ابنك {name} لم يحضر حصة {subject} اليوم."
    if event["type"] == "grade":
        return head + f"صدرت درجة {event.get('assessment', '')} في مادة {subject} لـ{name}، تقدر تطلع عليها من حسابك المعتمد."
    return head + f"تذكير: {name} عنده اختبار {subject} يوم {event.get('day')}، الساعة {event.get('time')}."


def _twilio_send(action: str, event: dict[str, Any], student: dict[str, Any]) -> str:
    from twilio.rest import Client

    client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
    to = os.environ["PARENT_PHONE"]
    if action == "call":
        return client.calls.create(url=_call_url(event, student), method="POST", to=to, from_=os.environ["TWILIO_FROM"]).sid
    sender = os.getenv("TWILIO_SMS_FROM", "Tammeni")
    return client.messages.create(from_=sender, to=to, body=_sms_body(event, student)).sid


async def dispatch(event: dict[str, Any]) -> dict[str, Any]:
    """ينفذ القرار. ما يرمي استثناء: الفشل يرجع في النتيجة عشان الديمو يكمل."""
    result = decide(event)
    student = store.find_student(event["student_id"])
    if result["action"] != "skipped" and student:
        if os.getenv("DEMO_DRY_RUN") == "1":
            result["sid"] = "DRY-RUN"
        else:
            missing = [k for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "PARENT_PHONE") if not os.getenv(k)]
            if result["action"] == "call":
                missing += [k for k in ("TWILIO_FROM",) if not os.getenv(k)]
                if not public_url():
                    missing.append("PUBLIC_URL")
            if missing:
                result.update(action="failed", reason=f"إعدادات ناقصة: {', '.join(missing)}")
            else:
                try:
                    result["sid"] = await asyncio.to_thread(_twilio_send, result["action"], event, student)
                except Exception as exc:  # noqa: BLE001
                    log.exception("notify failed")
                    result.update(action="failed", reason=str(exc)[:200])
    store.log_event({**event, "student_name": student["student_name"] if student else "", "result": result})
    return result
