"""
طمّني — إرسال تحديث واحد (رسالة أو مكالمة) بطلب صريح من لوحة الديمو.

Endpoints (لخادم الموقع فقط؛ تتطلب ترويسة X-Tammeni-Dispatch-Secret):
  POST /api/notify/dispatch  {token, method, idempotency_key}
  POST /api/notify/status    {provider_sid, method}

المزود يُختار من إعدادات الخادم (TAMMENI_PROVIDER):
  mock   (الافتراضي) لا يتصل بأي مزود ولا يرسل شيئًا؛ يعيد «مقبول لدى المزود الوهمي».
  twilio يرسل فعليًا إلى أرقام الاختبار المضبوطة هنا فقط (المكالمات: PARENT_PHONE، والرسائل: PARENT_PHONE1، وإن لم يُضبط يرجع لـPARENT_PHONE)، وبشرط وجودها في
         TAMMENI_ALLOWED_DESTINATIONS. لا يُقبل أي رقم من المتصفح، ولا يُستخدم الهاتف المقنّع من البيانات.
  force_mock في الطلب يبقى وهميًا حتى لو كان TAMMENI_PROVIDER=twilio (دخول الديمو المشترك).

«مقبول» يعني أن المزود قبل الطلب، لا أنه سُلّم. «تم التسليم» فقط حين يقول المزود ذلك.
"""
from __future__ import annotations

import asyncio
import hmac
import logging
import os
import uuid
from typing import Any, Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.call_context import load_context

log = logging.getLogger("tammeni.notify")
router = APIRouter(prefix="/api/notify")


class DispatchRequest(BaseModel):
    token: str = Field(min_length=32, max_length=200)
    method: Literal["call", "message"]
    idempotency_key: str = Field(min_length=8, max_length=100)
    # The website sets this for a shared-demo session. It cannot be used to turn Twilio on.
    force_mock: bool = False


class StatusRequest(BaseModel):
    provider_sid: str = Field(min_length=10, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    method: Literal["call", "message"]


def _authorise(secret: str | None) -> None:
    expected = os.getenv("TAMMENI_DISPATCH_SECRET", "")
    if not expected:
        raise HTTPException(503, "TAMMENI_DISPATCH_SECRET غير مضبوط على خادم Python.")
    if not secret or not hmac.compare_digest(secret, expected):
        raise HTTPException(403, "طلب غير مصرح به.")


def provider_mode() -> str:
    return "twilio" if os.getenv("TAMMENI_PROVIDER", "mock").strip().lower() == "twilio" else "mock"


def mask(number: str) -> str:
    digits = "".join(c for c in number if c.isdigit())
    if len(digits) < 6:
        return "••••"
    return f"+{digits[:3]}{'•' * (len(digits) - 5)}{digits[-2:]}"


def _destination(method: str) -> str:
    """The server-side test number for this kind of send, only if it is on the allow-list.

    Calls go to PARENT_PHONE and messages to PARENT_PHONE1; messages fall back to PARENT_PHONE when it is unset.
    """
    specific = "PARENT_PHONE" if method == "call" else "PARENT_PHONE1"
    to = (os.getenv(specific) or os.getenv("PARENT_PHONE", "")).strip()
    allowed = {x.strip() for x in os.getenv("TAMMENI_ALLOWED_DESTINATIONS", "").split(",") if x.strip()}
    if not to:
        raise HTTPException(503, f"لا يوجد رقم اختبار مضبوط على الخادم ({specific}).")
    if to not in allowed:
        raise HTTPException(403, "رقم الاختبار غير موجود في قائمة الأرقام المسموح بها (TAMMENI_ALLOWED_DESTINATIONS).")
    return to


def _twilio_client():
    sid, auth = os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN")
    if not sid or not auth:
        raise HTTPException(503, "إعدادات Twilio غير مكتملة على الخادم.")
    from twilio.rest import Client  # imported only when a real send is configured

    return Client(sid, auth)


@router.post("/dispatch")
async def dispatch(body: DispatchRequest, x_tammeni_dispatch_secret: str | None = Header(default=None)) -> dict[str, Any]:
    _authorise(x_tammeni_dispatch_secret)
    ctx = await load_context(body.token)
    if ctx is None:
        # No fallback to any other data: without a valid context nothing is sent.
        raise HTTPException(409, "تعذّر تحميل سياق التحديث من قاعدة البيانات، أو انتهت صلاحيته. لم يُرسل شيء.")
    if ctx["method"] != body.method:
        raise HTTPException(409, "طريقة التواصل لا تطابق السياق المحفوظ. لم يُرسل شيء.")

    if body.force_mock or provider_mode() == "mock":
        log.info("mock dispatch: %s %s", body.method, ctx["topic"])
        return {
            "provider": "mock",
            "status": "accepted",
            "provider_sid": f"MOCK-{uuid.uuid4().hex[:24]}",
            "provider_status": "mock-accepted",
            "to_masked": None,
            "error": None,
        }

    to = _destination(body.method)
    client = _twilio_client()
    try:
        if body.method == "message":
            # The sender proven to work in test_sms.py (alphanumeric "Tammeni"); override with TWILIO_SMS_FROM.
            sender = os.getenv("TWILIO_SMS_FROM", "Tammeni")
            msg = await asyncio.to_thread(lambda: client.messages.create(from_=sender, to=to, body=ctx["message"]))
            return {"provider": "twilio", "status": "accepted", "provider_sid": msg.sid, "provider_status": msg.status, "to_masked": mask(to), "error": None}
        public_url = os.getenv("PUBLIC_URL", "").rstrip("/")
        caller = os.getenv("TWILIO_FROM", "")
        if not public_url or not caller:
            raise HTTPException(503, "المكالمة تحتاج PUBLIC_URL و TWILIO_FROM على الخادم.")
        voice_url = f"{public_url}/api/phone/voice?{urlencode({'ctx': body.token})}"
        call = await asyncio.to_thread(lambda: client.calls.create(url=voice_url, method="POST", to=to, from_=caller))
        return {"provider": "twilio", "status": "accepted", "provider_sid": call.sid, "provider_status": call.status, "to_masked": mask(to), "error": None}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - provider errors become a plain failure, never a secret
        code = getattr(exc, "code", None)
        log.warning("twilio dispatch failed (code %s)", code)
        suffix = f" (رمز {code})" if code else ""
        return {"provider": "twilio", "status": "failed", "provider_sid": None, "provider_status": None, "to_masked": mask(to), "error": f"رفض المزود الطلب{suffix}."}


# Twilio statuses → our words. Only "delivered" (messages) / "completed" (calls) mean it arrived.
MESSAGE_STATUS = {"delivered": "delivered", "undelivered": "failed", "failed": "failed"}
CALL_STATUS = {"completed": "delivered", "busy": "failed", "no-answer": "failed", "failed": "failed", "canceled": "failed"}


@router.post("/status")
async def status(body: StatusRequest, x_tammeni_dispatch_secret: str | None = Header(default=None)) -> dict[str, Any]:
    _authorise(x_tammeni_dispatch_secret)
    if body.provider_sid.startswith("MOCK-"):
        return {"provider": "mock", "status": "accepted", "provider_status": "mock-accepted", "error": "مزود وهمي: لا يوجد تسليم فعلي."}
    if provider_mode() != "twilio":
        raise HTTPException(409, "المزود الحالي وهمي؛ لا يمكن سؤال Twilio عن هذه المحاولة.")
    client = _twilio_client()
    try:
        if body.method == "message":
            item = await asyncio.to_thread(lambda: client.messages(body.provider_sid).fetch())
            mapped = MESSAGE_STATUS.get(item.status, "accepted")
        else:
            item = await asyncio.to_thread(lambda: client.calls(body.provider_sid).fetch())
            mapped = CALL_STATUS.get(item.status, "accepted")
    except Exception as exc:  # noqa: BLE001
        code = getattr(exc, "code", None)
        suffix = f" (رمز {code})" if code else ""
        raise HTTPException(502, f"تعذّر سؤال المزود عن الحالة{suffix}.") from exc
    return {"provider": "twilio", "status": mapped, "provider_status": item.status, "error": None if mapped != "failed" else f"حالة المزود: {item.status}"}
