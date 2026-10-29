from __future__ import annotations
import json, os, re, uuid
from pathlib import Path
from typing import Any
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from backend import store
from backend.demo_api import parent_router, school_router
from backend.phone_bridge import router as phone_router
from backend.student_insights import enrich, fmt

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY", "")
LIVE_MODEL = "gpt-live-1"
TEXT_MODEL = os.getenv("TEXT_MODEL", "gpt-4.1-mini")
DATA_PATH = store.SEED_PATH  # البذرة؛ البيانات الحيّة تُقرأ من backend.store
LIVE_SESSIONS: dict[str, str] = {}
CONVERSATIONS: dict[str, dict[str, Any]] = {}
app = FastAPI(title="Madrasati Student Assistant", version="2.3.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type", "Authorization"])
app.include_router(phone_router)
app.include_router(parent_router)
app.include_router(school_router)


def normalize(value: str) -> str:
    value = value.lower().translate(str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي"}))
    value = re.sub(r"[ًٌٍَُِّْـٰ]", "", value)
    return re.sub(r"\s+", " ", value).strip()


OVERVIEW_TERMS = ("عطني معلومات", "اعطني معلومات", "معلومات ثانية", "معلومات اخرى", "وش مستواها", "وش وضع", "مستواها في المدرسة", "نظرة عامة", "ملخص", "غير الاختبارات", "overview", "overall")
FOLLOWUP_TERMS = ("طيب", "كمان", "بعد", "وال", "وبعد", "طيب و", "also", "and ")
CATEGORY_TERMS = {
    "attendance": ("غياب", "غايب", "حضور", "تحضر", "تداوم", "دوام", "تأخر", "تأخرت", "حضرت", "دروسها", "حصصها", "attendance", "attend", "absent", "late"),
    "exams": ("اختبار", "امتحان", "exam", "test"),
    "grades": ("درجة", "درجات", "جابت", "نسبة", "معدل", "grade", "score", "mark"),
    "announcements": ("إعلان", "اعلان", "اجتماع", "المطلوب", "announcement"),
    "profile": ("صف", "مدرسة", "فصل", "تدرس", "school", "class"),
}


class StudentDataService:
    """Access the canonical dataset and return only the selected student's records.

    With no path it reads the live data from backend.store (the single source of truth, which the school
    page also writes to). A path reads a standalone JSON file instead (used by the tests).
    """

    def __init__(self, path: Path | None = None):
        self.path = Path(path) if path is not None else None

    def _dataset(self) -> dict[str, Any]:
        try:
            data = store.dataset() if self.path is None else json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(data, dict) or not isinstance(data.get("students"), list):
                raise ValueError("dataset must contain a students array")
            if any(not isinstance(s, dict) or not s.get("id") for s in data["students"]):
                raise ValueError("every student must have an id")
            return data
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            code = 'DATA_SOURCE_UNAVAILABLE' if isinstance(exc, OSError) else 'INVALID_DATA_JSON' if isinstance(exc, json.JSONDecodeError) else 'DATA_VALIDATION_FAILED'
            status = 'source_unavailable' if isinstance(exc, OSError) else 'load_error' if isinstance(exc, json.JSONDecodeError) else 'validation_error'
            raise HTTPException(500, detail={"status": status, "code": code, "message": "Student records could not be loaded."}) from exc

    def all_students(self) -> list[dict[str, Any]]:
        return self._dataset()["students"]

    def get_students(self) -> list[dict[str, Any]]:
        fields = ("id", "name", "firstName", "grade", "stage", "classroom", "school")
        return [{key: student[key] for key in fields if key in student} for student in self.all_students()]

    def get_student(self, student_id: str) -> dict[str, Any]:
        student = next((item for item in self.all_students() if item.get("id") == student_id), None)
        if student is None:
            raise HTTPException(404, detail={"status": "invalid_student", "code": "STUDENT_NOT_FOUND", "message": "Selected student was not found."})
        return student

    def get_student_profile(self, student_id: str) -> dict[str, Any]:

        student = self.get_student(student_id)
        keys = ("id", "name", "firstName", "grade", "stage", "classroom", "school")
        return {key: student[key] for key in keys if key in student}

    def get_student_attendance(self, student_id: str) -> Any:
        return self.get_student(student_id).get("attendance")

    def get_student_exams(self, student_id: str) -> Any:
        return self.get_student(student_id).get("exams")

    def get_student_grades(self, student_id: str) -> Any:
        return self.get_student(student_id).get("grades")

    def get_student_announcements(self, student_id: str) -> Any:
        return self.get_student(student_id).get("announcements")

    def get_student_parent(self, student_id: str) -> dict[str, Any] | None:
        dataset = self._dataset()
        student = next((item for item in dataset["students"] if item.get("id") == student_id), None)
        if student is None:
            raise HTTPException(404, "الطالب المحدد غير موجود.")
        inline = student.get("parent") or student.get("guardian")
        if isinstance(inline, dict):
            return inline

        parent_id = next((student[key] for key in ("parentId", "parent_id", "guardianId", "guardian_id") if student.get(key) is not None), None)
        if parent_id is None and isinstance(inline, str):
            parent_id = inline
        parents = dataset.get("parents")
        root_parent = dataset.get("parent")
        if isinstance(parents, dict):
            parent_records = list(parents.items())
        elif isinstance(parents, list):
            parent_records = [(None, parent) for parent in parents]
        else:
            parent_records = []

        if parent_id is not None:
            for parent_key, parent in parent_records:
                if isinstance(parent, dict) and str(parent.get("id", parent_key)) == str(parent_id):
                    return parent
            if isinstance(root_parent, dict) and str(root_parent.get("id")) == str(parent_id):
                return root_parent
            return None

        for _, parent in parent_records:
            if not isinstance(parent, dict):
                continue
            linked = parent.get("studentIds", parent.get("students", parent.get("children")))
            if isinstance(linked, list) and student_id in [item.get("id") if isinstance(item, dict) else item for item in linked]:
                return parent

        if isinstance(root_parent, dict):
            linked = root_parent.get("studentIds", root_parent.get("students", root_parent.get("children")))
            if isinstance(linked, list):
                return root_parent if student_id in [item.get("id") if isinstance(item, dict) else item for item in linked] else None
            # The current schema has one dataset-level parent and no student parent references.
            # If a multi-parent collection exists, require an explicit student-parent link.
            if not parents:
                return root_parent
        return None

    def get_student_greeting(self, student_id: str) -> str:
        student = self.get_student(student_id)
        parent = self.get_student_parent(student_id)
        student_name = student.get("name") or student.get("firstName") or "الطالب"
        parent_name = (parent or {}).get("shortName") or (parent or {}).get("name")
        if parent_name:
            return f"أهلًا وسهلًا يا {parent_name}! أنا لولوة، مساعدتك الشخصية. أقدر أساعدك في متابعة الملف المدرسي لـ{student_name}: الحضور والدرجات والاختبارات وإعلانات المدرسة. وش تحب تعرف اليوم؟"

        return f"أهلًا! أنا لولوة، مساعدتك الشخصية. أقدر أساعدك في متابعة الملف المدرسي لـ{student_name}: الحضور والدرجات والاختبارات وإعلانات المدرسة. وش تحب تعرف اليوم؟"

    def get_student_summary(self, student_id: str) -> dict[str, Any]:
        return {
            "profile": self.get_student_profile(student_id),
            "attendance": self.get_student_attendance(student_id),
            "grades": self.get_student_grades(student_id),
            "exams": self.get_student_exams(student_id),
            "announcements": self.get_student_announcements(student_id),
        }

    @staticmethod
    def _categories(question: str, previous: str | None = None) -> list[str]:
        query = normalize(question)
        if any(normalize(term) in query for term in OVERVIEW_TERMS) or "معلومات عن" in query:
            return ["profile", "attendance", "grades", "exams", "announcements"]
        matches = [category for category, terms in CATEGORY_TERMS.items() if any(normalize(term) in query for term in terms)]
        if len(matches) > 1:
            return matches
        if matches:
            return matches
        if previous and any(normalize(term) in query for term in FOLLOWUP_TERMS):
            return ["profile", "attendance", "grades", "exams", "announcements"] if previous == "overview" else [previous]
        return ["profile"]

    @staticmethod
    def _subject(question: str) -> str | None:
        query = normalize(question)
        alias_map = {
            "رياضيات": "الرياضيات", "رياض": "الرياضيات", "math": "الرياضيات",
            "علوم": "العلوم", "science": "العلوم",
            "انجليزي": "اللغة الإنجليزية", "الانجليزي": "اللغة الإنجليزية", "english": "اللغة الإنجليزية",
            "لغتي": "لغتي", "تاريخ": "التاريخ", "history": "التاريخ",
        }
        for full_name in ("الرياضيات", "العلوم", "اللغة الإنجليزية", "لغتي", "التاريخ"):
            if normalize(full_name) in query:
                return normalize(full_name)
        tokens = re.findall(r"[^\W_]+", query, flags=re.UNICODE)
        prefixes = ("وال", "بال", "كال", "فال", "لل", "ال", "و", "ب", "ف", "ك", "ل")
        for token in tokens:
            candidate = token
            changed = True
            while changed:
                changed = False
                for prefix in prefixes:
                    if candidate.startswith(prefix) and len(candidate) > len(prefix) + 1:
                        candidate = candidate[len(prefix):]
                        changed = True
                        break
            if candidate in alias_map:
                return normalize(alias_map[candidate])
        return None

    def retrieve_relevant_student_data(self, student_id: str, query: str, previous: str | None = None) -> dict[str, Any]:
        student = self.get_student(student_id)
        normalized_query = normalize(query)
        for other in self.all_students():
            names = (other.get("id"), other.get("name"), other.get("firstName"))

            if other["id"] != student_id and any(normalize(str(name)) in normalized_query for name in names if name):
                return {"found": False, "category": "other_student", "student": self.get_student_profile(student_id)}

        categories = self._categories(query, previous)
        category = "overview" if len(categories) == 5 else categories[0] if len(categories) == 1 else "multi"
        profile = self.get_student_profile(student_id)
        summary = self.get_student_summary(student_id) if category == "overview" else None
        getters = {
            "profile": lambda: profile,
            "attendance": lambda: self.get_student_attendance(student_id),
            "grades": lambda: self.get_student_grades(student_id),
            "exams": lambda: self.get_student_exams(student_id),
            "announcements": lambda: self.get_student_announcements(student_id),
        }
        records = summary if summary is not None else getters[categories[0]]() if len(categories) == 1 else {name: getters[name]() for name in categories}

        subject = self._subject(query)
        if subject and isinstance(records, list) and category in ("exams", "grades"):
            records = [row for row in records if normalize(str(row.get("subject", ""))) == subject]
        elif subject and category in ("overview", "multi"):
            for name in ("exams", "grades"):
                if name in records and isinstance(records[name], list):
                    records[name] = [row for row in records[name] if normalize(str(row.get("subject", ""))) == subject]

        participation = any(normalize(term) in normalized_query for term in ("تحضر دروس", "تحضر حصص", "مشاركة في الدروس", "lesson participation", "participate in class"))
        found = any(value is not None and value != [] and value != {} for value in records.values()) if isinstance(records, dict) and category in ("overview", "multi") else records is not None and records != [] and records != {}
        return {
            "found": found,
            "category": category,
            "categories": categories,
            "student": profile,
            "records": records,
            "lesson_participation_available": False if participation else None,
        }

    def retrieve_student_context(self, student_id: str, question: str, previous_category: str | None = None) -> dict[str, Any]:
        return self.retrieve_relevant_student_data(student_id, question, previous_category)

    def retrieve(self, student_id: str, question: str, previous: str | None = None) -> dict[str, Any]:
        return self.retrieve_relevant_student_data(student_id, question, previous)


service = StudentDataService()


class StartRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=100)
    previous_conversation_id: str | None = Field(default=None, max_length=100)


class ChatRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=100)
    conversation_id: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=2000)


class LiveRequest(BaseModel):
    sdp: str = Field(min_length=1, max_length=300_000)
    student_id: str = Field(min_length=1, max_length=100)
    greet: bool = True


class LookupRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    session_id: str = Field(min_length=1, max_length=200)


def _missing_text(records: Any, label: str) -> str:
    if records is None:
        return f"{label}: ما فيه حقل مسجل في بيانات الطالب."
    if records == []:
        return f"{label}: ما فيه سجلات مسجلة حالياً."
    return ""


def _attendance_text(records: Any, name: str, question: str = "") -> str:
    missing = _missing_text(records, "الحضور")
    if missing:
        return missing
    if not isinstance(records, dict):
        return "بيانات الحضور غير مكتملة."
    query = normalize(question)

    if any(normalize(term) in query for term in ("تحضر دروس", "تحضر حصص", "مشاركة في الدروس", "lesson participation", "participate in class")):
        return f"سجل {name} يوضح {records.get('present', 'غير متوفر')} يوم حضور، و{records.get('absent', 'غير متوفر')} غياب، و{records.get('late', 'غير متوفر')} تأخير. البيانات تسجل الحضور والتأخير، لكنها ما توضح المشاركة في كل حصة أو حضور كل درس بالتفصيل."
    result = f"{name}: {records.get('present', 'غير متوفر')} يوم حضور، {records.get('absent', 'غير متوفر')} غياب، {records.get('late', 'غير متوفر')} تأخير"
    if records.get("excused") is not None:
        result += f"، منها {records['excused']} غياب بعذر"
    if records.get("schoolDays") is not None:
        result += f"، من أصل {records['schoolDays']} يوم دراسي"
    result += f" خلال {records.get('termLabel', 'الفترة المسجلة')}."
    if any(normalize(term) in query for term in ("اسبوع", "هالاسبوع", "هذا الاسبوع", "week")):
        week = records.get("week")
        if isinstance(week, list) and week:
            details = "، ".join(f"{row.get('day', '')} {row.get('date', '')}: {row.get('note') or {'present': 'حضور', 'absent': 'غياب', 'late': 'تأخير'}.get(row.get('status'), 'غير محدد')}" for row in week)
            result += f" سجل الأسبوع: {details}."
    return result


def _grades_text(records: Any, name: str) -> str:
    missing = _missing_text(records, "الدرجات")
    if missing:
        return missing
    if not isinstance(records, list):
        return "بيانات الدرجات غير مكتملة."
    items = []
    for grade in records:
        score, maximum = grade.get("score"), grade.get("outOf")
        line = f"{grade.get('subject', 'مادة')} — {grade.get('assessment', 'تقييم')}: {score if score is not None else 'غير مسجل'} من {maximum if maximum is not None else 'غير مسجل'}"
        if isinstance(score, (int, float)) and isinstance(maximum, (int, float)) and maximum > 0:
            line += f" ({score / maximum * 100:.1f}٪)"
        items.append(line)
    return f"التقييمات المسجلة لـ{name}: " + "؛ ".join(items) + ". ما أقدر أستنتج معدلاً عاماً من هذه التقييمات وحدها."


def _exams_text(records: Any, name: str) -> str:
    missing = _missing_text(records, "الاختبارات")
    if missing:
        return missing
    if not isinstance(records, list):
        return "بيانات الاختبارات غير مكتملة."
    return f"الاختبارات المسجلة لـ{name}: " + "؛ ".join(f"{row.get('subject', 'مادة')}، {row.get('kind', 'اختبار')} يوم {row.get('day', '')} {row.get('date', '')}، {row.get('period', 'الوقت غير محدد')}" for row in records) + "."


def _announcements_text(records: Any, name: str) -> str:
    missing = _missing_text(records, "الإعلانات")
    if missing:
        return missing
    if not isinstance(records, list):

        return "بيانات الإعلانات غير مكتملة."
    return f"الإعلانات المسجلة لـ{name}: " + "؛ ".join(f"{row.get('title', 'إعلان')} ({row.get('date', 'تاريخ غير محدد')}): {row.get('body', '')}" for row in records) + "."


def local_answer(data: dict[str, Any], question: str = "") -> str:
    if data.get("answer_override"):
        return data["answer_override"]
    student = data["student"]
    name = student.get("firstName", student.get("name", "الطالب"))
    category, records = data["category"], data.get("records")
    if category == "other_student":
        return f"المحادثة محددة على {name}. اختاري الطالب الثاني من القائمة لبدء محادثة جديدة."
    if category == "profile":
        return f"{name} في {student.get('grade', 'صف غير مسجل')}، فصل {student.get('classroom', 'غير مسجل')} بمدرسة {student.get('school', 'غير مسجلة')}."
    if category == "attendance":
        return _attendance_text(records, name, question)
    if category == "grades":
        return _grades_text(records, name)
    if category == "exams":
        return _exams_text(records, name)
    if category == "announcements":
        return _announcements_text(records, name)
    if category in ("overview", "multi"):
        parts = []
        if "profile" in records:
            parts.append(local_answer({"student": student, "category": "profile", "records": records["profile"]}, question))
        renderers = {
            "attendance": lambda value: _attendance_text(value, name, question),
            "grades": lambda value: _grades_text(value, name),
            "exams": lambda value: _exams_text(value, name),
            "announcements": lambda value: _announcements_text(value, name),
        }
        for key in ("attendance", "grades", "exams", "announcements"):
            if key not in records:
                continue
            value = records[key]
            parts.append(renderers[key](value) if value is not None and value != [] else _missing_text(value, {"attendance": "الحضور", "grades": "الدرجات", "exams": "الاختبارات", "announcements": "الإعلانات"}[key]))
        if records.get("onlineLessons"): parts.append(fmt(records["onlineLessons"],"online_attendance"))
        if records.get("assignments"): parts.append(fmt(records["assignments"],"assignments"))
        ins=records.get("insights") or {}
        if ins.get("subject_averages"): parts.append(f"متوسط المواد (تقييمين فأكثر): {ins['subject_averages']}.")
        if ins.get("strengths"): parts.append(f"نقاط قوة مدعومة: {ins['strengths']}.")
        if ins.get("areas_for_support"): parts.append(f"مواد قد تحتاج متابعة: {ins['areas_for_support']}.")
        if ins.get("recommendations"): parts.append("اقتراح عملي: " + "؛ ".join(x["suggestion"] for x in ins["recommendations"]))
        if ins.get("repeated_low_scoring_skills"): parts.append("مهارات تكررت فيها درجات منخفضة: " + str(ins["repeated_low_scoring_skills"]))
        if ins.get("trends"): parts.append(f"اتجاهات مبنية على ثلاثة تقييمات: {ins['trends']}.")
        return " ".join(part for part in parts if part)
    if category in ("online_attendance","assignments"): return fmt(records,category)
    return "ما لقيت معلومة كافية في سجلات الطالب."


async def answer(message: str, data: dict[str, Any], history: list[dict[str, str]]) -> str:
    local = local_answer(data, message)
    if not OPENAI_API_KEY or data["category"] == "other_student" or data.get("status") == "not_found":
        return local
    context = json.dumps(data, ensure_ascii=False)
    messages = [{
        "role": "system",

        "content": "You are Lulwa. Reply in concise, natural Saudi Arabic. Treat selected-student records and status as the only source of truth. Answer verified information before naming missing fields. Missing records never mean absence, zero, or non-submission. Label demo=true or source=synthetic_demo records as synthetic examples. Never claim Noor access; suggest that the parent check Noor or contact the selected school when relevant. Daily attendance is not lesson-by-lesson attendance. Do not infer behavior or motivation, reveal another student, or invent facts.",
    }]
    messages += history[-8:] + [{"role": "user", "content": f"سؤال ولي الأمر: {message}\nبيانات الطالب المحدد فقط: {context}"}]
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post("https://api.openai.com/v1/chat/completions", headers={"Authorization": f"Bearer {OPENAI_API_KEY}"}, json={"model": TEXT_MODEL, "messages": messages, "temperature": 0.2})
        if response.is_error:
            return local
        content = response.json()["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            return local
        normalized = normalize(content)
        unavailable = ("ما عندي", "ماعندي", "ما فيه معلومات", "ما في معلومات", "لا توجد معلومات", "لا يوجد بيانات", "غير متوفر", "غير موجود", "ما لقيت بيانات", "لا املك بيانات", "لا أملك بيانات", "not available", "no data", "not found")
        if data.get("found") and any(term in normalized for term in unavailable):
            return local
        return content.strip()
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        return local


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/status")
async def status() -> dict[str, Any]:
    return {"model": LIVE_MODEL, "text_model": TEXT_MODEL, "api_key_configured": bool(OPENAI_API_KEY), "dataset_name": DATA_PATH.name, "dataset_loaded": DATA_PATH.is_file()}


@app.get("/api/students")
async def list_students() -> list[dict[str, Any]]:
    return service.get_students()


@app.get("/api/students/{student_id}")
async def get_profile(student_id: str) -> dict[str, Any]:
    return service.get_student_profile(student_id)


@app.post("/api/conversations")
async def start(body: StartRequest) -> dict[str, str]:
    service.get_student(body.student_id)
    if body.previous_conversation_id:
        CONVERSATIONS.pop(body.previous_conversation_id, None)
    conversation_id = str(uuid.uuid4())
    greeting = service.get_student_greeting(body.student_id)
    CONVERSATIONS[conversation_id] = {"student_id": body.student_id, "history": [], "category": None}
    return {"conversation_id": conversation_id, "student_id": body.student_id, "greeting": greeting}


@app.delete("/api/conversations/{conversation_id}")
async def clear(conversation_id: str) -> dict[str, bool]:
    CONVERSATIONS.pop(conversation_id, None)
    return {"reset": True}


@app.post("/api/student/chat")
async def chat(body: ChatRequest) -> dict[str, Any]:

    if not body.message.strip():
        raise HTTPException(422, "اكتبي سؤالاً أولاً.")
    conversation = CONVERSATIONS.get(body.conversation_id)
    if not conversation or conversation["student_id"] != body.student_id:
        raise HTTPException(409, "المحادثة غير صالحة لهذا الطالب. ابدئي محادثة جديدة.")
    data = enrich(service, service.retrieve_relevant_student_data(body.student_id, body.message, conversation.get("category")), body.student_id, body.message)
    reply = await answer(body.message, data, conversation["history"])
    if data["category"] != "other_student":
        conversation["category"] = data["category"]
    conversation["history"] = (conversation["history"] + [{"role": "user", "content": body.message}, {"role": "assistant", "content": reply}])[-12:]
    return {"answer": reply, "student_id": body.student_id, "category": data["category"], "status": data.get("status")}


@app.post("/api/live/session")
async def live(body: LiveRequest) -> dict[str, Any]:
    student = service.get_student_profile(body.student_id)
    greeting = service.get_student_greeting(body.student_id)
    if not OPENAI_API_KEY:
        raise HTTPException(503, detail={"code": "OPENAI_KEY_MISSING", "message": "Configure OPENAI_API_KEY in backend .env."})
    greet_instruction = f"Begin speaking immediately in natural Saudi Arabic. Greet the parent using exactly this personalized message, then pause and listen: {greeting}"
    instructions = f"""You are Lulwa, a friendly Saudi Arabic assistant scoped only to {body.student_id} ({student.get("firstName", "")}). Use local lookup for every school fact. Treat returned records and status as authoritative. For partial or not_found, state verified facts then what is missing; never treat missing as absence, zero, or non-submission. Use parent_context and school only as returned. Suggest school or Noor as parent follow-up; never claim Noor access. Label demo/synthetic_demo data clearly as examples. Daily attendance is not lesson attendance. Do not infer behavior, motivation, or causes. Never reveal another student or invent facts."""
    if body.greet:
        instructions += " " + greet_instruction
    session_config = {"model": LIVE_MODEL, "instructions": instructions, "audio": {"output": {"voice": "marin"}}, "delegation": {"type": "client", "acknowledgement_delay_ms": 800}}
    if body.greet:
        session_config["input"] = [{"type": "message", "role": "developer", "content": [{"type": "input_text", "text": greet_instruction}]}]
    payload = {"session": session_config, "transport": {"type": "webrtc", "sdp": body.sdp}}
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post("https://api.openai.com/v1/live/sessions", headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}, json=payload)
    except httpx.HTTPError as exc:
        raise HTTPException(502, "تعذر الاتصال بخدمة الصوت.") from exc
    if response.status_code in (401, 403):
        raise HTTPException(502, detail={"code": "OPENAI_AUTH_OR_ACCESS", "message": "مفتاح OpenAI أو صلاحية GPT-Live غير متاحة."})
    if response.status_code == 429:
        raise HTTPException(503, detail={"code": "OPENAI_RATE_LIMITED", "message": "وصلت الخدمة إلى حد الطلبات."})
    if response.is_error:
        raise HTTPException(502, detail={"code": "OPENAI_LIVE_ERROR", "message": f"OpenAI returned HTTP {response.status_code}."})
    try:
        result = response.json()
        session_id = result["session"]["id"]
        sdp = result["transport"]["sdp"]
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(502, "استجابة خدمة الصوت غير صالحة.") from exc
    LIVE_SESSIONS[session_id] = body.student_id
    return {"session_id": session_id, "sdp": sdp, "greeting": greeting}


@app.post("/api/student/lookup")
async def lookup(body: LookupRequest) -> dict[str, Any]:
    student_id = LIVE_SESSIONS.get(body.session_id)
    if not student_id:
        raise HTTPException(401, "جلسة الصوت غير معروفة أو انتهت.")
    return enrich(service, service.retrieve_relevant_student_data(student_id, body.question), student_id, body.question)


@app.delete("/api/live/session/{session_id}")
async def close(session_id: str) -> dict[str, bool]:
    LIVE_SESSIONS.pop(session_id, None)

    return {"closed": True}
