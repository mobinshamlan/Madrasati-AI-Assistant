"""
طمّني — حالة الديمو المحفوظة في الـ backend (مو في المتصفح).

نخزن: تفضيلات أولياء الأمور، نسخة عمل من بيانات الطلاب (المدرسة تعدّل عليها بدون ما نلمس
BasicData.json)، وسجل الأحداث. الكل في ملف JSON واحد.
"""
from __future__ import annotations

import copy
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BASIC_DATA = ROOT / "Data" / "BasicData.json"
STATE_PATH = Path(os.getenv("DEMO_STATE_PATH", ROOT / "Data" / "runtime_state.json"))
TODAY = os.getenv("DEMO_TODAY", "2026-10-28")

_lock = threading.RLock()
_state: dict[str, Any] | None = None


def _subject(sid: str, name: str, grade: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "subject_id": sid,
        "subject_name": name,
        "attendance": [{"date": TODAY, "status": "present"}],
        "grades": [grade] if grade else [],
        "homework": [],
        "skills": [],
    }


def _seed() -> dict[str, Any]:
    """محمد من BasicData.json، وريم وفيصل بيانات وهمية تطابق صفحة ولي الأمر."""
    base = json.loads(BASIC_DATA.read_text(encoding="utf-8")).get("students", [])
    students: list[dict[str, Any]] = []
    for s in base:
        s = copy.deepcopy(s)
        s["web_id"] = "mohammed" if s.get("student_id") == "STU-001" else s["student_id"].lower()
        s["gender"] = "m"
        s["exams"] = [{"subject_id": "MATH", "subject_name": "الرياضيات", "day": "الأحد", "time": "٨:٠٠ صباحا"}]
        students.append(s)
    students += [
        {
            "student_id": "STU-002", "web_id": "reem", "student_name": "ريم", "gender": "f",
            "grade": 5, "guardian_id": "PAR-001",
            "subjects": [
                _subject("MATH", "الرياضيات", {"assessment": "الاختبار الأسبوعي", "score": 18, "max_score": 20, "date": "2026-10-27"}),
                _subject("SCI", "العلوم", {"assessment": "تقرير المختبر", "score": 13, "max_score": 15, "date": "2026-10-26"}),
                _subject("ARB", "لغتي", None),
            ],
            "exams": [{"subject_id": "SCI", "subject_name": "العلوم", "day": "الاثنين", "time": "٩:٠٠ صباحا"}],
        },
        {
            "student_id": "STU-003", "web_id": "faisal", "student_name": "فيصل", "gender": "m",
            "grade": 8, "guardian_id": "PAR-001",
            "subjects": [
                _subject("MATH", "الرياضيات", {"assessment": "واجب: المعادلات الخطية", "score": 8, "max_score": 10, "date": "2026-10-25"}),
                _subject("SCI", "العلوم", None),
                _subject("ENG", "اللغة الإنجليزية", None),
            ],
            "exams": [{"subject_id": "SCI", "subject_name": "العلوم", "day": "الاثنين", "time": "١٠:٠٠ صباحا"}],
        },
    ]
    return {"students": students, "preferences": {}, "events": []}


def _load() -> dict[str, Any]:
    global _state
    if _state is None:
        try:
            _state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            _state = _seed()
    return _state


def _save() -> None:
    try:
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STATE_PATH.write_text(json.dumps(_state, ensure_ascii=False, indent=1), encoding="utf-8")
    except OSError:
        pass  # الديمو يكمل حتى لو الكتابة فشلت


def reset() -> None:
    global _state
    with _lock:
        _state = _seed()
        _save()


# ---------- preferences ----------
def _web_id(student_id: str) -> str:
    """التفضيلات تتخزن بمعرّف الواجهة (mohammed) حتى لو جا الطلب بـ STU-001."""
    s = find_student(student_id)
    return s["web_id"] if s else student_id


def get_preferences(student_id: str) -> dict[str, Any] | None:
    with _lock:
        return copy.deepcopy(_load()["preferences"].get(_web_id(student_id)))


def get_preferences_or_sibling(student_id: str) -> tuple[dict[str, Any] | None, bool]:
    """تفضيلات الطالب، وإن ما حفظ ولي الأمر له تفضيلات: آخر تفضيلات حفظها لأحد إخوته (نفس ولي الأمر)."""
    own = get_preferences(student_id)
    if own:
        return own, False
    me = find_student(student_id)
    if me is None:
        return None, False
    with _lock:
        saved = [
            (p, _web_id_of(s))
            for s in _load()["students"]
            if s["guardian_id"] == me["guardian_id"] and (p := _load()["preferences"].get(s["web_id"]))
        ]
    if not saved:
        return None, False
    return copy.deepcopy(max(saved, key=lambda x: x[0].get("savedAt", ""))[0]), True


def _web_id_of(s: dict[str, Any]) -> str:
    return s["web_id"]


def set_preferences(student_id: str, prefs: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        prefs = {**prefs, "savedAt": datetime.now(timezone.utc).isoformat()}
        _load()["preferences"][_web_id(student_id)] = prefs
        _save()
        return copy.deepcopy(prefs)


# ---------- students ----------
def students() -> list[dict[str, Any]]:
    with _lock:
        return copy.deepcopy(_load()["students"])


def find_student(student_id: str) -> dict[str, Any] | None:
    return next((s for s in students() if student_id in (s["student_id"], s["web_id"])), None)


def _live(student_id: str) -> dict[str, Any]:
    s = next((s for s in _load()["students"] if student_id in (s["student_id"], s["web_id"])), None)
    if s is None:
        raise KeyError(student_id)
    return s


def _subject_of(student: dict[str, Any], subject_id: str) -> dict[str, Any]:
    sub = next((x for x in student["subjects"] if subject_id in (x["subject_id"], x["subject_name"])), None)
    if sub is None:
        raise KeyError(subject_id)
    return sub


def set_attendance(student_id: str, subject_id: str, status: str) -> None:
    with _lock:
        sub = _subject_of(_live(student_id), subject_id)
        rec = next((r for r in sub["attendance"] if r["date"] == TODAY), None)
        if rec:
            rec["status"] = status
        else:
            sub["attendance"].append({"date": TODAY, "status": status})
        _save()


def publish_grade(student_id: str, subject_id: str, assessment: str, score: float, max_score: float) -> None:
    with _lock:
        sub = _subject_of(_live(student_id), subject_id)
        sub["grades"].append({"assessment": assessment, "score": score, "max_score": max_score, "date": TODAY})
        _save()


def schedule_exam(student_id: str, subject_id: str, day: str, time: str) -> None:
    with _lock:
        s = _live(student_id)
        sub = _subject_of(s, subject_id)
        s.setdefault("exams", []).append(
            {"subject_id": sub["subject_id"], "subject_name": sub["subject_name"], "day": day, "time": time}
        )
        _save()


# ---------- events ----------
def log_event(event: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        event = {**event, "at": datetime.now(timezone.utc).isoformat()}
        ev = _load()["events"]
        ev.insert(0, event)
        del ev[200:]
        _save()
        return event


def events() -> list[dict[str, Any]]:
    with _lock:
        return copy.deepcopy(_load()["events"])
