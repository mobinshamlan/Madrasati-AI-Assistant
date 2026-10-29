"""
واجهتا النظامين: ولي الأمر (تفضيلات) والمدرسة (دخول، عرض الداتا، تسجيل أحداث).
"""
from __future__ import annotations

import hmac
import os
import secrets
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from backend import notifier, store

parent_router = APIRouter(prefix="/api/parent")
school_router = APIRouter(prefix="/api/school")

SCHOOL_USER = os.getenv("SCHOOL_USER", "school")
SCHOOL_PASSWORD = os.getenv("SCHOOL_PASSWORD", "school123")
# الديمو: المدرسة تدخل مباشرة. شغّل SCHOOL_AUTH=1 لو تبي تطلب اسم مستخدم وكلمة مرور.
SCHOOL_AUTH = os.getenv("SCHOOL_AUTH") == "1"
_tokens: set[str] = set()


# ---------- ولي الأمر ----------
TOPICS = ("attendance", "exams", "grades")


@parent_router.get("/preferences/{student_id}")
async def get_prefs(student_id: str) -> dict[str, Any]:
    if store.find_student(student_id) is None:
        raise HTTPException(404, "student not found")
    return {"preferences": store.get_preferences(student_id)}


@parent_router.put("/preferences/{student_id}")
async def put_prefs(student_id: str, body: dict[str, Any]) -> dict[str, Any]:
    if store.find_student(student_id) is None:
        raise HTTPException(404, "student not found")
    for t in TOPICS:
        cfg = body.get(t)
        if not isinstance(cfg, dict) or cfg.get("method") not in ("call", "message"):
            raise HTTPException(422, f"invalid preferences for {t}")
    return {"preferences": store.set_preferences(student_id, body)}


# ---------- المدرسة ----------
class LoginRequest(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


@school_router.post("/login")
async def login(body: LoginRequest) -> dict[str, str]:
    ok = hmac.compare_digest(body.username, SCHOOL_USER) & hmac.compare_digest(body.password, SCHOOL_PASSWORD)
    if not ok:
        raise HTTPException(401, "اسم المستخدم أو كلمة المرور غير صحيحة")
    token = secrets.token_urlsafe(24)
    _tokens.add(token)
    return {"token": token, "name": "إدارة المدرسة"}


def require_school(authorization: str | None = Header(default=None)) -> None:
    if not SCHOOL_AUTH:
        return
    token = (authorization or "").removeprefix("Bearer ").strip()
    if token not in _tokens:
        raise HTTPException(401, "يلزم تسجيل دخول المدرسة")


@school_router.get("/students", dependencies=[Depends(require_school)])
async def list_students() -> dict[str, Any]:
    return {"today": store.TODAY, "students": store.students()}


@school_router.get("/events", dependencies=[Depends(require_school)])
async def list_events() -> dict[str, Any]:
    return {"events": store.events()}


class SchoolEvent(BaseModel):
    type: Literal["attendance", "grade", "exam"]
    student_id: str
    subject_id: str
    status: Literal["present", "absent", "late", "excused"] = "absent"  # attendance
    assessment: str = Field(default="الاختبار الأسبوعي", max_length=100)  # grade
    score: float = Field(default=0, ge=0)
    max_score: float = Field(default=100, gt=0)
    day: str = Field(default="الأحد", max_length=30)  # exam
    time: str = Field(default="٨:٠٠ صباحا", max_length=30)
    persona: Literal["lulwa", "turki"] | None = None


@school_router.post("/events", dependencies=[Depends(require_school)])
async def post_event(body: SchoolEvent) -> dict[str, Any]:
    student = store.find_student(body.student_id)
    if student is None:
        raise HTTPException(404, "الطالب غير موجود")
    try:
        sub = store._subject_of(student, body.subject_id)
        if body.type == "attendance":
            store.set_attendance(student["student_id"], sub["subject_id"], body.status)
        elif body.type == "grade":
            store.publish_grade(student["student_id"], sub["subject_id"], body.assessment, body.score, body.max_score)
        else:
            store.schedule_exam(student["student_id"], sub["subject_id"], body.day, body.time)
    except KeyError:
        raise HTTPException(404, "المادة غير موجودة") from None

    event = body.model_dump() | {"student_id": student["student_id"], "subject_name": sub["subject_name"]}
    # الغياب فقط يطلق تنبيه؛ تغييره إلى حاضر تحديث داخلي.
    if body.type == "attendance" and body.status not in ("absent", "late"):
        return {"result": {"action": "skipped", "reason": "تحديث حضور بدون تنبيه"}}
    return {"result": await notifier.dispatch(event)}
