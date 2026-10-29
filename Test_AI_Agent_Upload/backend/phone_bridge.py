"""
طمّني — جسر المكالمات الهاتفية الثنائية (Twilio  <->  GPT-Live).

الفكرة: Twilio يتصل بجوال ولي الأمر ويفتح WebSocket معنا (Media Streams).
نمرر صوت ولي الأمر لـ GPT-Live، ونرجّع صوت GPT-Live لـ Twilio.

Endpoints:
  POST /api/phone/voice   <- Twilio يستدعيه أول ما ولي الأمر يرد؛ نرجّع TwiML فيه <Stream>
  WS   /api/phone/media   <- Twilio يرسل/يستقبل الصوت هنا (G.711 mu-law, 8kHz)
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
from pathlib import Path
from typing import Any
from xml.sax.saxutils import quoteattr

import websockets
from dotenv import load_dotenv
from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect

from backend import store

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

log = logging.getLogger("tammeni.phone")
router = APIRouter(prefix="/api/phone")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY", "")
OPENAI_WS_URL = os.getenv("OPENAI_LIVE_WS_URL", "wss://api.openai.com/v1/live/sessions")
LIVE_MODEL = "gpt-live-1"

# أقصى مدة للمكالمة بالثواني (حماية للفاتورة). الـ PDF يقول 20-40 ثانية.
MAX_CALL_SECONDS = int(os.getenv("MAX_CALL_SECONDS", "90"))
# بعد ما المساعد يودّع، نسكّر المكالمة بعد كم ثانية (عشان يكمل صوته).
HANGUP_AFTER_GOODBYE = float(os.getenv("HANGUP_AFTER_GOODBYE", "6"))
# ١ = المساعد يجاوب من بيانات الطالب الكاملة (درجات وواجبات)، ٠ = يلتزم بالـ PDF (يحيل للحساب المعتمد).
ALLOW_DATA_ANSWERS = os.getenv("ALLOW_DATA_ANSWERS", "0") == "1"

VOICES = {
    "lulwa": os.getenv("LULWA_VOICE", "marin"),
    "turki": os.getenv("TURKI_VOICE", "marin"),
}

GOODBYE_RE = re.compile(r"(مع السلامة|يومك سعيد|يعطيك العافية|شكرا لتعاونك|شكرا لك)[\s.!،؟]*$")


# ----------------------------------------------------------------------------
# البيانات والـ prompt
# ----------------------------------------------------------------------------
def _load_student(name: str) -> dict[str, Any] | None:
    """سجل الطالب الحي من مصدر البيانات الوحيد (نفس اللي تشوفه صفحة ولي الأمر والمدرسة)."""
    try:
        return store.find_student(name)
    except (OSError, ValueError):
        return None


def opening_line(p: dict[str, str]) -> str:
    """أول جملة يقولها المساعد، حسب الشخصية والسيناريو (من ملف سيناريوهات الحوار)."""
    who, student, subject = p["persona"], p["student"], p["subject"]
    pron = "حضورها" if p["gender"] == "f" else "حضوره"
    name = "لولوة" if who == "lulwa" else "تركي"
    hello = "مرحبا" if who == "lulwa" else "هلا"
    verb = "نعلمك" if who == "lulwa" else "ننبهك"
    scenario = p["scenario"]
    if scenario == "exam_grade":
        assess = p["assessment"]
        return (f"{hello}، معك {name} من طمني. حابين {'نعلمك' if who=='turki' else 'نبلغك'} إن درجة "
                f"{assess} في مادة {subject} لـ{student} صدرت، وتقدر تطلع عليها من حسابك المعتمد.")
    if scenario == "exam_reminder":
        return (f"{hello}، معك {name} من طمني. تذكير بسيط: {student} عنده اختبار {subject} "
                f"يوم {p['day']}، {p['time']}، في المدرسة.")
    # الافتراضي: الغياب
    where = f"في حصة {subject}" if subject else "في المدرسة"
    return (f"{hello}، معك {name} من طمني. حابين {verb} إن {student} ما تسجل {pron} "
            f"{where} اليوم. عندك علم بغيابه؟")


def build_instructions(p: dict[str, str]) -> str:
    name = "لولوة" if p["persona"] == "lulwa" else "تركي"
    close = "يومك سعيد" if p["persona"] == "lulwa" else "يعطيك العافية"
    pron = "(حضورها/عندها/لها)" if p["gender"] == "f" else "(حضوره/عنده/له)"
    first = opening_line(p)

    facts = ""
    student = _load_student(p["student"])
    if ALLOW_DATA_ANSWERS and student:
        facts = ("\n\nبيانات الطالب الموثقة (استخدمها وحدها للإجابة، ولا تخترع شيئا غيرها):\n"
                 + json.dumps(student, ensure_ascii=False))

    return f"""أنت {name} من خدمة «طمني»، مساعد صوتي يتصل بولي أمر طالب لتنبيهه بخصوص منصة مدرستي.
تتكلم باللهجة السعودية الطبيعية، بجمل قصيرة ونبرة ودودة. هذي مكالمة هاتفية.

افتح المكالمة بهذي الجملة حرفيا (بعد ما يرد ولي الأمر):
«{first}»

ضوابط المكالمة:
- مدة المكالمة من ٢٠ إلى ٤٠ ثانية، موضوع واحد وسؤال توضيحي واحد كحد أقصى.
- افهم معنى رد ولي الأمر ولا تعتمد على تطابق الكلمات.
- «عارف / أدري / بعلمي» تعني أنه عارف بالغياب. أما «طيب / تمام / شكرا» فتعني استلام التنبيه فقط؛ لا تسجلها معرفة بالسبب ولا تقديما لعذر.
- إذا قاطعك ولي الأمر، وقّف كلامك واسمعه.
- لا تؤكد أنك رفعت عذر أو أبلغت المدرسة أو جدولت تذكيرا. أنت ما تنفذ هالإجراءات. قل: رفع العذر يكون من طرف ولي الأمر عبر القناة المعتمدة لدى المدرسة، أو: نأمل تتواصل مع إدارة المدرسة.
- إذا قال إن الطالب مريض أو عنده عذر أو موعد: ادعُ له بالسلامة، وقل نأمل يرفع العذر لإدارة المدرسة.
- إذا سأل عن شي ما عندك فيه معلومة: قل «ما عندي تفاصيل أكثر حاليا، المدرسة تقدر تفيدك».
- إذا كلامه غير واضح: قل «عفوا، ما وضح لي ردك، ممكن تعيده باختصار؟». وإذا استمر عدم الوضوح بعد المحاولة الثانية: «نأمل تتواصل مع المدرسة بخصوص التنبيه. شكرا لك.» وأنهِ المكالمة.
- إذا كان مشغول: لخّص التنبيه في جملة واحدة ثم ودّع.
- إذا قال إن الرقم غلط أو إنه مو ولي أمر الطالب: اعتذر عن الإزعاج، ولا تذكر أي بيانات عن الطالب، وأنهِ المكالمة.
- بعد ما تعطيه الرد المناسب، ودّع بجملة واحدة تنتهي بـ«{close}» وما تفتح موضوع جديد.
- عدّل الضمائر حسب الطالب {pron}.
- لا تخترع درجات أو تواريخ أو حضور.{facts}"""


# ----------------------------------------------------------------------------
# 1) TwiML: Twilio يستدعيه أول ما يرد ولي الأمر
# ----------------------------------------------------------------------------
def _public_ws_url(request: Request) -> str:
    base = os.getenv("PUBLIC_URL", "").rstrip("/")
    if not base:
        proto = request.headers.get("x-forwarded-proto", "https")
        base = f"{proto}://{request.headers.get('host', request.url.netloc)}"
    return base.replace("https://", "wss://").replace("http://", "ws://") + "/api/phone/media"


@router.api_route("/voice", methods=["GET", "POST"])
async def voice(request: Request) -> Response:
    q = request.query_params
    params = {
        "persona": q.get("persona", "lulwa"),
        "student": q.get("student", "محمد"),
        "subject": q.get("subject", "الرياضيات"),
        "gender": q.get("gender", "m"),
        "scenario": q.get("scenario", "absence"),
        "assessment": q.get("assessment", "الاختبار الأسبوعي"),
        "day": q.get("day", "الأحد"),
        "time": q.get("time", "الحصة الأولى"),
    }
    stream_params = "".join(
        f"<Parameter name={quoteattr(k)} value={quoteattr(v)}/>" for k, v in params.items()
    )
    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<Response><Connect><Stream url={quoteattr(_public_ws_url(request))}>{stream_params}</Stream></Connect></Response>'
    )
    return Response(content=twiml, media_type="application/xml")


# ----------------------------------------------------------------------------
# 2) الجسر: Twilio WS  <->  GPT-Live WS
# ----------------------------------------------------------------------------
async def _connect_openai():
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    try:  # websockets >= 14
        return await websockets.connect(OPENAI_WS_URL, additional_headers=headers, max_size=None)
    except TypeError:  # websockets < 14
        return await websockets.connect(OPENAI_WS_URL, extra_headers=headers, max_size=None)


@router.websocket("/media")
async def media(twilio: WebSocket) -> None:
    await twilio.accept()
    call = {"stream_sid": None, "call_sid": None, "params": {}}
    started = asyncio.Event()          # session.started وصل من OpenAI
    early_audio: list[str] = []        # صوت وصل قبل ما تبدأ الجلسة (ما نضيعه)
    tasks: list[asyncio.Task] = []
    oa = None
    hangup_task: asyncio.Task | None = None

    async def send_oa(event: dict[str, Any]) -> None:
        if oa is not None:
            await oa.send(json.dumps(event))

    async def hang_up() -> None:
        """نسكّر مكالمة Twilio (ونقفل الـ WS)."""
        sid = call["call_sid"]
        if sid and os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN"):
            try:
                from twilio.rest import Client
                client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
                await asyncio.to_thread(lambda: client.calls(sid).update(status="completed"))
            except Exception as exc:  # noqa: BLE001
                log.warning("Twilio hangup failed: %s", exc)
        try:
            await twilio.close()
        except Exception:  # noqa: BLE001
            pass

    async def schedule_hangup(delay: float) -> None:
        await asyncio.sleep(delay)
        await hang_up()

    async def openai_to_twilio() -> None:
        nonlocal hangup_task
        assistant_text = ""
        async for raw in oa:
            ev = json.loads(raw)
            t = ev.get("type")
            if t == "session.started":
                started.set()
                for chunk in early_audio:
                    await send_oa({"type": "session.input_audio.append", "audio": chunk})
                early_audio.clear()
            elif t == "session.output_audio.delta" and call["stream_sid"]:
                await twilio.send_text(json.dumps({
                    "event": "media", "streamSid": call["stream_sid"],
                    "media": {"payload": ev.get("delta", "")}}))
            elif t == "session.input_transcript.delta":
                # ولي الأمر بدأ يتكلم -> نفضّي الصوت المتراكم عند Twilio (barge-in)
                if call["stream_sid"]:
                    await twilio.send_text(json.dumps({"event": "clear", "streamSid": call["stream_sid"]}))
                log.info("PARENT: %s", ev.get("delta", ""))
            elif t == "session.output_transcript.delta":
                assistant_text += ev.get("delta", "")
                log.info("AGENT: %s", ev.get("delta", ""))
                # كل ما جا كلام جديد نلغي أي إنهاء مجدول؛ ننهي بس لو آخر شي قاله وداع.
                if hangup_task:
                    hangup_task.cancel()
                    hangup_task = None
                if GOODBYE_RE.search(assistant_text):
                    hangup_task = asyncio.create_task(schedule_hangup(HANGUP_AFTER_GOODBYE))
                    assistant_text = ""
            elif t == "error":
                log.error("OpenAI error: %s", ev)
            elif t == "session.closed":
                await hang_up()
                return

    async def twilio_to_openai() -> None:
        nonlocal oa
        try:
            while True:
                msg = json.loads(await twilio.receive_text())
                ev = msg.get("event")
                if ev == "start":
                    call["stream_sid"] = msg["start"]["streamSid"]
                    call["call_sid"] = msg["start"].get("callSid")
                    call["params"] = msg["start"].get("customParameters", {})
                    p = call["params"]
                    p.setdefault("persona", "lulwa")
                    oa = await _connect_openai()
                    await send_oa({"type": "session.start", "session": {
                        "model": LIVE_MODEL,
                        "instructions": build_instructions(p),
                        "audio": {"format": {"type": "audio/pcmu", "rate": 8000},
                                  "output": {"voice": VOICES.get(p["persona"], "marin")}},
                    }})
                    tasks.append(asyncio.create_task(openai_to_twilio()))
                    tasks.append(asyncio.create_task(_watchdog()))
                elif ev == "media":
                    payload = msg["media"]["payload"]
                    if started.is_set():
                        await send_oa({"type": "session.input_audio.append", "audio": payload})
                    else:
                        early_audio.append(payload)
                elif ev == "stop":
                    return
        except WebSocketDisconnect:
            return

    async def _watchdog() -> None:
        await asyncio.sleep(MAX_CALL_SECONDS)
        log.warning("max call duration reached; hanging up")
        await hang_up()

    try:
        await twilio_to_openai()
    finally:
        if hangup_task:
            hangup_task.cancel()
        if oa is not None:
            try:
                await send_oa({"type": "session.close"})
                await asyncio.wait_for(asyncio.shield(tasks[0]), timeout=3) if tasks else None
            except Exception:  # noqa: BLE001
                pass
            await oa.close()
        for t in tasks:
            t.cancel()
