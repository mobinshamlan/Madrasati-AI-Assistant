
from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.phone_bridge import router as phone_router
from backend.parent_preview import router as parent_preview_router
from backend.notify import router as notify_router

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY", "")
LIVE_MODEL = "gpt-live-1"
DATA_PATH = ROOT / "Data" / "BasicData.json"
LIVE_SESSIONS: dict[str, str | None] = {}

app = FastAPI(title="Saudi Arabic GPT-Live Agent", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


app.include_router(phone_router)
app.include_router(parent_preview_router)
app.include_router(notify_router)


class StudentDataService:
    def __init__(self, path: Path = DATA_PATH): self.path = path
    def all_students(self) -> list[dict[str, Any]]:
        try:
            with self.path.open(encoding="utf-8") as f: data = json.load(f)
            students = data.get("students", [])
            if not isinstance(students, list): raise ValueError("students must be a list")
            return students
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(500, "Student dataset could not be loaded") from exc
    def retrieve(self, question: str, known_student: str | None = None) -> dict[str, Any]:
        students = self.all_students()
        q = normalize(question)
        student = next((s for s in students if normalize(str(s.get("student_name", ""))) in q), None)
        if student is None and known_student:
            student = next((s for s in students if s.get("student_id") == known_student), None)
        if student is None and len(students) == 1: student = students[0]
        if student is None: return {"found": False, "reason": "الطالب غير محدد في البيانات المتاحة."}
        subject = next((s for s in student.get("subjects", []) if subject_match(q, s)), None)
        record: dict[str, Any] = {"student_name": student.get("student_name"), "student_id": student.get("student_id"), "grade": student.get("grade")}
        if subject:
            record["subject"] = subject.get("subject_name")
            # Return the selected subject's actual JSON records; GPT-Live speaks the response.
            for key in ("attendance", "homework", "skills", "grades"):
                if key in subject: record[key] = subject[key]
        elif has_subject_question(q):
            return {"found": False, "student_name": student.get("student_name"), "reason": "المادة المطلوبة غير موجودة في بيانات الطالب."}
        else:
            record["subjects"] = [{"subject": s.get("subject_name"), **{k: s.get(k, []) for k in ("attendance", "homework", "skills", "grades")}} for s in student.get("subjects", [])]
        return {"found": True, "records": record}


def normalize(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[ًٌٍَُِّْـٰ]", "", s)
    return re.sub(r"\s+", " ", s).strip()

def subject_match(q: str, subject: dict[str, Any]) -> bool:
    name = normalize(str(subject.get("subject_name", "")))
    sid = str(subject.get("subject_id", "")).lower()
    if (name and name in q) or (sid and sid in q): return True
    aliases = {"MATH": ("math", "رياضيات", "رياض", "حساب"), "ENG": ("english", "الانجليزي", "الإنجليزي", "انجليزي", "إنجليزي"), "SCI": ("science", "علوم", "العلوم")}
    if any(normalize(w) in q for w in aliases.get(sid.upper(), ())): return True
    return any(normalize(str(skill.get("skill", ""))) in q for skill in subject.get("skills", []) if skill.get("skill"))

def has_subject_question(q: str) -> bool:
    return any(x in q for x in ("رياض", "انجليزي", "الإنجليزي", "علوم", "math", "english", "science", "history", "تاريخ"))

data_service = StudentDataService()

class LiveSessionRequest(BaseModel):
    sdp: str = Field(min_length=1, max_length=300_000)

class StudentLookupRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    session_id: str | None = Field(default=None, max_length=200)

@app.get("/api/health")
async def health() -> dict[str, str]: return {"status": "ok"}

@app.get("/api/status")
async def status() -> dict[str, Any]:
    return {"model": LIVE_MODEL, "provider": "OpenAI GPT-Live", "api_key_configured": bool(OPENAI_API_KEY), "session_created": False}

@app.post("/api/live/session")
async def create_live_session(body: LiveSessionRequest) -> dict[str, Any]:
    if not OPENAI_API_KEY: raise HTTPException(503, detail={"code": "OPENAI_KEY_MISSING", "message": "Configure OPENAI_API_KEY (or existing API_KEY) in the backend .env."})
    payload = {"session": {"model": LIVE_MODEL, "instructions": "You are a helpful Saudi Arabic student progress assistant. Speak naturally in Saudi Arabic. Use only verified facts returned by the local student_data_lookup tool. If facts are absent, say you do not have them. When you need student records, delegate to the client tool. Do not invent grades, dates, or attendance.", "audio": {"output": {"voice": "marin"}}, "delegation": {"type": "client", "acknowledgement_delay_ms": 800}}, "transport": {"type": "webrtc", "sdp": body.sdp}}
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post("https://api.openai.com/v1/live/sessions", headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}, json=payload)
    except httpx.HTTPError as exc: raise HTTPException(502, "Could not reach OpenAI Live") from exc
    if response.status_code in (401, 403): raise HTTPException(502, detail={"code": "OPENAI_AUTH_OR_ACCESS", "message": "OpenAI rejected the configured key or GPT-Live access."})
    if response.status_code == 429: raise HTTPException(503, detail={"code": "OPENAI_RATE_LIMITED", "message": "OpenAI Live rate limit reached."})
    if response.is_error: raise HTTPException(502, detail={"code": "OPENAI_LIVE_ERROR", "message": f"OpenAI Live returned HTTP {response.status_code}."})
    try: data = response.json(); session = data.get("session", {}); answer_sdp = data["transport"]["sdp"]
    except (ValueError, KeyError, TypeError) as exc: raise HTTPException(502, "OpenAI returned an invalid Live session response") from exc
    session_id = session.get("id")
    if not session_id: raise HTTPException(502, "OpenAI response did not include a session ID")
    LIVE_SESSIONS[session_id] = None
    return {"session_id": session_id, "sdp": answer_sdp}

@app.post("/api/student/lookup")
async def student_lookup(body: StudentLookupRequest) -> dict[str, Any]:
    sid = body.session_id
    known = LIVE_SESSIONS.get(sid) if sid else None
    result = data_service.retrieve(body.question, known)
    if sid in LIVE_SESSIONS and result.get("found"):
        students = data_service.all_students()
        name = result["records"].get("student_name")
        LIVE_SESSIONS[sid] = next((s.get("student_id") for s in students if s.get("student_name") == name), known)
    return result

@app.delete("/api/live/session/{session_id}")
async def close_session(session_id: str) -> dict[str, bool]:
    LIVE_SESSIONS.pop(session_id, None)
    return {"closed": True}
