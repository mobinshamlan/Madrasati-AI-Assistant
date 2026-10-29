"""
طمّني — مصدر الحقيقة الوحيد للبيانات.

كل شي (صفحة ولي الأمر، صفحة المدرسة، الـ Agent النصي والصوتي، جسر المكالمات، القرار) يقرأ ويكتب
من هنا فقط. `Data/madrasati-dataset.json` هو البذرة (seed)؛ أول تشغيل ينسخه إلى
`Data/runtime_state.json` اللي فيه: dataset (ولي الأمر + اليوم + الطلاب) + التفضيلات + سجل الأحداث.
حذف runtime_state.json يرجّع كل شي للبذرة.
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
SEED_PATH = ROOT / "Data" / "madrasati-dataset.json"
STATE_PATH = Path(os.getenv("DEMO_STATE_PATH", ROOT / "Data" / "runtime_state.json"))
TODAY = os.getenv("DEMO_TODAY", "2026-10-28")
COUNTED = ("present", "absent", "late", "excused")
STATUS_LABEL = {"present": "حاضر", "absent": "غياب", "late": "تأخر", "excused": "غياب بعذر"}

_lock = threading.RLock()
_state: dict[str, Any] | None = None


# ---------- التحميل والحفظ ----------
def _seed() -> dict[str, Any]:
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("students"), list):
        raise ValueError("dataset must contain a students array")
    return {"dataset": data, "preferences": {}, "events": []}


def _load() -> dict[str, Any]:
    global _state
    if _state is None:
        try:
            state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
            if not isinstance(state.get("dataset"), dict):
                raise ValueError("no dataset in state")
            state.setdefault("preferences", {})
            state.setdefault("events", [])
            _state = state
        except (OSError, ValueError):
            _state = _seed()
    return _state


def _save() -> None:
    try:
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = STATE_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(_state, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, STATE_PATH)  # كتابة ذرّية: ما يتلف الملف لو انقطع
    except OSError:
        pass  # الديمو يكمل حتى لو الكتابة فشلت


def use_state_path(path: Path | str) -> None:
    """للاختبارات: يوجّه الحالة لملف ثاني ويرجّع بذرة جديدة."""
    global STATE_PATH, _state
    with _lock:
        STATE_PATH = Path(path)
        _state = None


def reset() -> None:
    global _state
    with _lock:
        _state = _seed()
        _save()


# ---------- القراءة ----------
def dataset() -> dict[str, Any]:
    with _lock:
        return copy.deepcopy(_load()["dataset"])


def students() -> list[dict[str, Any]]:
    return dataset()["students"]


def find_student(key: str) -> dict[str, Any] | None:
    """بالمعرّف (reem) أو الاسم الكامل أو الاسم الأول."""
    return next((s for s in students() if key in (s.get("id"), s.get("name"), s.get("firstName"))), None)


def subjects_of(student: dict[str, Any]) -> list[str]:
    seen: list[str] = []
    for key in ("grades", "exams", "onlineLessons", "assignments"):
        for row in student.get(key) or []:
            subject = row.get("subject")
            if subject and subject not in seen:
                seen.append(subject)
    return seen


# ---------- التفضيلات ----------
def get_preferences(student_id: str) -> dict[str, Any] | None:
    with _lock:
        return copy.deepcopy(_load()["preferences"].get(student_id))


def set_preferences(student_id: str, prefs: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        prefs = {**prefs, "savedAt": datetime.now(timezone.utc).isoformat()}
        _load()["preferences"][student_id] = prefs
        _save()
        return copy.deepcopy(prefs)


def get_preferences_or_sibling(student_id: str) -> tuple[dict[str, Any] | None, bool]:
    """تفضيلات الطالب، وإن ما حفظ ولي الأمر له: آخر تفضيلات حفظها لأحد إخوته (نفس ولي الأمر)."""
    own = get_preferences(student_id)
    if own:
        return own, False
    me = find_student(student_id)
    if me is None:
        return None, False
    with _lock:
        saved = _load()["preferences"]
        siblings = [s["id"] for s in _load()["dataset"]["students"] if s["id"] != me["id"] and s.get("parentId") == me.get("parentId")]
        found = [saved[i] for i in siblings if i in saved]
    if not found:
        return None, False
    return copy.deepcopy(max(found, key=lambda p: p.get("savedAt", ""))), True


# ---------- كتابة المدرسة (على نفس الـ dataset) ----------
def _live(student_id: str) -> dict[str, Any]:
    for s in _load()["dataset"]["students"]:
        if student_id in (s.get("id"), s.get("name"), s.get("firstName")):
            return s
    raise KeyError(student_id)


def _today_hijri(student: dict[str, Any]) -> str:
    return f'{student["attendance"]["week"][-1]["date"]}/1448'


def set_attendance(student_id: str, subject: str, status: str) -> None:
    """يحدّث حضور اليوم (آخر يوم في الأسبوع) والعدّادات، ويسجل حصة المادة."""
    if status not in COUNTED:
        raise ValueError(status)
    with _lock:
        s = _live(student_id)
        att = s["attendance"]
        today = att["week"][-1]
        old = today.get("status")
        if old != status:
            if old in COUNTED:
                att[old] = max(0, att.get(old, 0) - 1)
            att[status] = att.get(status, 0) + 1
        today["status"] = status
        today["note"] = "اليوم" if status == "present" else f"اليوم — {STATUS_LABEL[status]} ({subject})"
        lessons = s.setdefault("onlineLessons", [])
        row = next((r for r in lessons if r.get("subject") == subject and r.get("date") == TODAY), None)
        if row:
            row["status"] = status
        else:
            lessons.append({
                "id": f'{s["id"]}-lesson-{len(lessons) + 1}', "studentId": s["id"], "subject": subject,
                "date": TODAY, "lesson": len(lessons) + 1, "status": status, "source": "school",
            })
        _save()


def publish_grade(student_id: str, subject: str, assessment: str, score: float, out_of: float) -> None:
    with _lock:
        s = _live(student_id)
        s["grades"].insert(0, {
            "subject": subject, "assessment": assessment, "score": score, "outOf": out_of,
            "date": _today_hijri(s), "source": "school",
        })
        _save()


def schedule_exam(student_id: str, subject: str, kind: str, day: str, date: str, period: str) -> None:
    with _lock:
        s = _live(student_id)
        s["exams"].append({"subject": subject, "kind": kind, "day": day, "date": date, "hijri": "", "period": period, "source": "school"})
        _save()


# ---------- سجل الأحداث ----------
def log_event(event: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        event = {**event, "at": datetime.now(timezone.utc).isoformat()}
        log = _load()["events"]
        log.insert(0, event)
        del log[200:]
        _save()
        return event


def events() -> list[dict[str, Any]]:
    with _lock:
        return copy.deepcopy(_load()["events"])
