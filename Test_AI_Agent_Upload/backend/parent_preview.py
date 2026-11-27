"""Preference-aware preview for fictional website records; never sends communications."""
from typing import Any, Literal
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field, model_validator

from backend.notify import _authorise, public_deployment

router = APIRouter(prefix="/api/parent")


class CustomAttendance(BaseModel):
    kind: Literal["daily", "weekly"]
    day: Literal["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class AttendancePreference(BaseModel):
    timing: Literal["immediate", "end-of-day", "custom", "off"]
    method: Literal["call", "message"]
    custom: CustomAttendance


class ExamPreference(BaseModel):
    timing: Literal["day-before", "week-before", "custom", "off"]
    method: Literal["call", "message"]
    customDays: int = Field(ge=1, le=30, strict=True)
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class GradesPreference(BaseModel):
    timing: Literal["immediate", "monthly", "off"]
    method: Literal["call", "message"]
    dayOfMonth: int = Field(ge=1, le=28, strict=True)
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class Preferences(BaseModel):
    attendance: AttendancePreference
    exams: ExamPreference
    grades: GradesPreference
    retryUnansweredCall: bool = Field(strict=True)

    @model_validator(mode="after")
    def enabled_topic(self):
        if all(getattr(self, topic).timing == "off" for topic in ("attendance", "exams", "grades")):
            raise ValueError("Enable at least one topic")
        return self


class DemoStudent(BaseModel):
    # The fictional students of supabase/data/madrasati-dataset.json; anything else is rejected.
    id: Literal["sama", "faisal", "lujain", "ahmad"]
    name: str = Field(min_length=1, max_length=150)
    attendance: dict[str, Any]
    exams: list[dict[str, Any]]
    grades: list[dict[str, Any]]


class PreviewRequest(BaseModel):
    student: DemoStudent
    preferences: Preferences


LABELS = {"attendance": "الحضور والغياب", "exams": "الاختبارات القادمة", "grades": "الدرجات"}


def topic_text(student: DemoStudent, topic: str) -> str:
    if topic == "attendance":
        a = student.attendance
        return f"الحضور: {a.get('present', 0)} من {a.get('schoolDays', 0)} يومًا؛ الغياب: {a.get('absent', 0)}؛ التأخر: {a.get('late', 0)}؛ الغياب بعذر: {a.get('excused', 0)}."
    rows = getattr(student, topic)
    if not rows:
        return "لا توجد سجلات متاحة لهذا النوع."
    if topic == "exams":
        return "\n".join(f"{x.get('subject', '')}: {x.get('kind', '')} — {x.get('day', '')} {x.get('date', '')}، {x.get('period', '')}." for x in rows)
    return "\n".join(f"{x.get('subject', '')}: {x.get('score', '')} من {x.get('outOf', '')} — {x.get('assessment', '')}." for x in rows)


def _secret_when_public(x_tammeni_dispatch_secret: str | None = Header(default=None)) -> None:
    if public_deployment():
        _authorise(x_tammeni_dispatch_secret)


@router.post("/preview", dependencies=[Depends(_secret_when_public)])
def preview(body: PreviewRequest):
    updates = []
    for topic, label in LABELS.items():
        preference = getattr(body.preferences, topic)
        if preference.timing == "off":
            continue
        updates.append({
            "topic": topic, "label": label, "method": preference.method,
            "schedule": preference.model_dump(),
            "text": f"طمّني | {body.student.name}\n{topic_text(body.student, topic)}",
        })
    return {
        "studentId": body.student.id, "studentName": body.student.name,
        "source": "website-demo", "timezone": "Asia/Riyadh", "previewOnly": True,
        "updates": updates,
    }
