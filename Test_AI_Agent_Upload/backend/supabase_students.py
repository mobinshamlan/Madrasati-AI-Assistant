"""Read-only live demo-parent records. Uses parent Auth and RLS, never a service-role key."""
from __future__ import annotations

from contextvars import ContextVar
from copy import deepcopy
from datetime import date
import os
from pathlib import Path

import httpx
from dotenv import dotenv_values
from fastapi import HTTPException
from backend.student_profile import profile_for

snapshot: ContextVar[dict | None] = ContextVar("student_snapshot", default=None)
WEEKDAYS = ("الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد")


def configuration():
    # Share only the existing server-side demo-parent settings on a local checkout.
    website = dotenv_values(Path(__file__).resolve().parents[2] / ".env.local")
    def value(*names):
        return next((os.environ.get(n) or website.get(n) for n in names if os.environ.get(n) or website.get(n)), "")
    url = value("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    key = value("SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    email = value("TAMMENI_DEMO_PARENT_EMAIL")
    password = value("TAMMENI_DEMO_PARENT_PASSWORD")
    if not all((url, key, email, password)) or key.startswith("sb_secret_"):
        raise HTTPException(503, "إعداد قراءة بيانات ولي الأمر غير مكتمل. لا يتم استخدام بيانات قديمة بديلة.")
    return url, key, email, password


def assemble(tables):
    parent = next(iter(tables["parent_profiles"]), {})
    result = {"source": "supabase", "parent": {"name": parent.get("full_name", ""), "shortName": parent.get("full_name", "")}, "students": []}
    for s in tables["students"]:
        sid = s["id"]
        rows = lambda name: [x for x in tables[name] if x.get("student_id") == sid]
        terms = rows("attendance_terms")
        if not terms:
            raise HTTPException(502, "ملخص حضور الطالب غير متاح في قاعدة البيانات.")
        term = terms[0]
        attendance = {"termLabel": term["term_label"], "schoolDays": term["school_days"], **{k: term[k] for k in ("present", "absent", "late", "excused")}}
        # Imported totals already include imported day records. Overlay demo changes once per day.
        by_day = {}
        for x in sorted(rows("attendance_records"), key=lambda x: (x["day"], x["origin"] == "demo", x.get("created_at", ""), x.get("id", ""))):
            if x.get("archived_at"):
                continue
            previous = by_day.get(x["day"])
            if x["origin"] == "demo":
                if previous:
                    attendance[previous["status"]] -= 1
                else:
                    attendance["schoolDays"] += 1
                attendance[x["status"]] += 1
            by_day[x["day"]] = x
        attendance["week"] = [{"day": WEEKDAYS[date.fromisoformat(x["day"]).weekday()], "date": x["day"], "status": x["status"], "note": x.get("note"), "origin": x["origin"]} for x in sorted(by_day.values(), key=lambda x: x["day"])[-5:]]
        latest = max(by_day.values(), key=lambda x: (x["day"], x.get("created_at", "")), default=None)
        attendance["latestRecord"] = {k: latest.get(k) for k in ("day", "status", "note")} if latest else None
        preferences = next(iter(rows("assistant_preferences")), None)
        enabled = {k: bool(preferences and preferences.get(k + "_timing") != "off") for k in ("attendance", "exams", "grades")}
        student = {"id": s["demo_key"], "name": s["full_name"], "firstName": s["first_name"], "grade": s["grade_label"], "stage": s.get("stage_label"), "classroom": s.get("classroom_label"), "school": s["school_name"], "enabledTopics": enabled}
        # Backend file supplies the stable profile; current attendance/exams/grades always come from DB.
        profile = profile_for(s["demo_key"], s["full_name"])
        for field in ("grade", "stage", "classroom", "school"):
            if profile.get(field):
                student[field] = profile[field]
        student["attendance"] = attendance if enabled["attendance"] else None
        student["exams"] = [{"subject": x["subject"], "kind": x["kind"] + (" — ملغى" if x["status"] == "cancelled" else ""), "day": WEEKDAYS[date.fromisoformat(x["exam_date"]).weekday()], "date": x["exam_date"], "period": x.get("start_time") or x.get("period_label", ""), "status": x["status"]} for x in sorted(rows("exams"), key=lambda x: (x["exam_date"], x.get("created_at", ""))) if not x.get("archived_at")] if enabled["exams"] else []
        student["grades"] = [{"subject": x["subject"], "assessment": x["assessment"], "score": float(x["score"]), "outOf": float(x["out_of"]), "date": x["published_on"]} for x in sorted(rows("grades"), key=lambda x: (x["published_on"], x.get("created_at", "")), reverse=True) if not x.get("archived_at")] if enabled["grades"] else []
        student["announcements"] = [{"title": x["title"], "body": x["body"], "date": x.get("published_on"), "tag": x.get("tag")} for x in rows("announcements")]
        # These are separate from school attendance and have no notification preferences yet.
        student["onlineLessons"] = [{"id": x["source_ref"], "studentId": s["demo_key"], "subject": x["subject"], "date": x["lesson_date"], "status": x["status"], "durationMinutes": x["duration_minutes"], "scheduledDurationMinutes": x["scheduled_duration_minutes"], "demo": True, "source": "synthetic_demo"} for x in rows("online_lessons")] if enabled["attendance"] else []
        student["assignments"] = [{"id": x["source_ref"], "studentId": s["demo_key"], "subject": x["subject"], "title": x["title"], "assignedDate": x["assigned_on"], "dueDate": x["due_on"], "status": x["status"], "demo": True, "source": "synthetic_demo"} for x in rows("assignments")]
        result["students"].append(student)
    return result


TABLES = ("students", "parent_profiles", "assistant_preferences", "attendance_terms", "attendance_records", "exams", "grades", "announcements", "online_lessons", "assignments")


def load_dataset():
    url, key, email, password = configuration()
    try:
        with httpx.Client(timeout=12) as client:
            auth = client.post(url + "/auth/v1/token", params={"grant_type": "password"}, headers={"apikey": key}, json={"email": email, "password": password})
            auth.raise_for_status()
            identity = auth.json()
            if identity.get("user", {}).get("app_metadata", {}).get("tammeni_role") == "demo_operator":
                raise HTTPException(503, "يجب استخدام حساب ولي الأمر لقراءة بيانات المحادثة.")
            headers = {"apikey": key, "Authorization": "Bearer " + identity["access_token"], "Cache-Control": "no-cache"}
            tables = {}
            for name in TABLES:
                page, collected = 0, []
                while True:
                    response = client.get(url + "/rest/v1/" + name, headers=headers, params={"select": "*", "limit": 500, "offset": page * 500})
                    response.raise_for_status()
                    chunk = response.json()
                    if not isinstance(chunk, list):
                        raise ValueError("Invalid table response")
                    collected.extend(chunk)
                    if len(chunk) < 500:
                        break
                    page += 1
                tables[name] = collected
            return assemble(tables)
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "تعذّر تحميل أحدث سجلات الطالب من Supabase. حاول مجددًا.") from None


def current_dataset():
    data = snapshot.get()
    return deepcopy(data if data is not None else load_dataset())
