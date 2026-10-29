import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
os.environ["DEMO_DRY_RUN"] = "1"
os.environ.setdefault("DEMO_STATE_PATH", str(Path(tempfile.mkdtemp()) / "state.json"))

import backend.app as backend
from backend import store


class AgentTests(unittest.TestCase):
    def setUp(self):
        store.reset()
        self.client = TestClient(backend.app)
        backend.CONVERSATIONS.clear()
        backend.LIVE_SESSIONS.clear()
        self.students = {s["id"]: s for s in backend.service.all_students()}

    def conversation(self, student_id="reem", previous=None):
        body = {"student_id": student_id}
        if previous:
            body["previous_conversation_id"] = previous
        response = self.client.post("/api/conversations", json=body)
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_canonical_dataset_and_all_student_ids_load(self):
        self.assertEqual(backend.DATA_PATH.name, "madrasati-dataset.json")
        self.assertEqual(len(self.students), 5)
        self.assertEqual({s["id"] for s in self.client.get("/api/students").json()}, set(self.students))

    def test_every_student_has_profile_attendance_week_exams_grades_and_announcements(self):
        expected = {"reem": (3, 5, 3), "faisal": (4, 5, 3), "lujain": (3, 6, 3), "nawaf": (2, 5, 3), "mohammed": (1, 3, 0)}
        for student_id, student in self.students.items():
            self.assertEqual(backend.service.get_student_profile(student_id)["id"], student_id)
            attendance = backend.service.get_student_attendance(student_id)
            self.assertIsInstance(attendance, dict)
            self.assertTrue(attendance["week"])
            self.assertEqual(backend.service.get_student_exams(student_id), student.get("exams"))
            self.assertEqual(backend.service.get_student_grades(student_id), student.get("grades"))
            self.assertEqual(backend.service.get_student_announcements(student_id), student.get("announcements"))
            exams, grades, announcements = expected[student_id]
            self.assertEqual(len(backend.service.get_student_exams(student_id)), exams)
            self.assertEqual(len(backend.service.get_student_grades(student_id)), grades)
            self.assertEqual(len(backend.service.get_student_announcements(student_id)), announcements)

    def test_reem_attendance_actual_totals(self):
        attendance = backend.service.get_student_attendance("reem")
        self.assertEqual((attendance["schoolDays"], attendance["present"], attendance["absent"], attendance["late"]), (48, 46, 1, 1))
        context = backend.service.retrieve_relevant_student_data("reem", "كم غيابها؟")
        self.assertEqual(context["records"], attendance)
        self.assertIn("46 يوم حضور", backend.local_answer(context))
        self.assertIn("1 غياب", backend.local_answer(context))

    def test_category_queries_retrieve_complete_records(self):
        self.assertEqual(len(backend.service.retrieve_relevant_student_data("reem", "كيف درجاتها بشكل عام؟")["records"]), 5)
        self.assertEqual(len(backend.service.retrieve_relevant_student_data("reem", "وش عندها اختبارات؟")["records"]), 3)
        self.assertEqual(len(backend.service.retrieve_relevant_student_data("reem", "وش آخر إعلان؟")["records"]), 3)
        weekly = backend.service.retrieve_relevant_student_data("reem", "كيف كان حضورها هذا الأسبوع؟")
        self.assertEqual(len(weekly["records"]["week"]), 4)

    def test_general_queries_retrieve_relevant_categories(self):
        self.assertIsNone(backend.service._subject("عطني معلومات عن نواف"))
        self.assertEqual(backend.service._subject("متى اختبار العلوم؟"), "العلوم")
        for sid, question in (("nawaf", "عطني معلومات عن نواف"), ("lujain", "وش وضع لجين في المدرسة؟"), ("reem", "وش عندها غير الاختبارات؟"), ("faisal", "عطني ملخصًا عن الطالب")):
            data = backend.service.retrieve_relevant_student_data(sid, question, previous="exams")
            self.assertEqual(data["category"], "overview")
            self.assertEqual(data["records"]["profile"]["id"], sid)

            self.assertIsInstance(data["records"]["attendance"], dict)
            self.assertTrue(data["records"]["grades"])
            self.assertTrue(data["records"]["exams"])
            self.assertTrue(data["records"]["announcements"])
        multi = backend.service.retrieve_relevant_student_data("reem", "كيف حضورها ودرجاتها؟")
        self.assertEqual(multi["category"], "multi")
        self.assertEqual(set(multi["records"]), {"attendance", "grades"})

    def test_other_student_records_are_not_returned(self):
        result = backend.service.retrieve_relevant_student_data("reem", "وش درجات فيصل؟")
        self.assertEqual(result["category"], "other_student")
        self.assertNotIn("records", result)
        for other_id in ("faisal", "lujain", "nawaf"):
            self.assertNotIn(other_id, json.dumps(result, ensure_ascii=False))

    def test_missing_and_empty_fields_are_distinct(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "data.json"
            path.write_text(json.dumps({"students": [{"id": "s1", "name": "سارة", "attendance": None, "grades": []}]}), encoding="utf-8")
            service = backend.StudentDataService(path)
            missing = service.retrieve_relevant_student_data("s1", "كم غيابها؟")
            empty = service.retrieve_relevant_student_data("s1", "وش درجاتها؟")
            self.assertIn("ما فيه حقل مسجل", backend.local_answer(missing))
            self.assertIn("ما فيه سجلات مسجلة", backend.local_answer(empty))

    def test_greeting_uses_dataset_parent_and_each_selected_student(self):
        parent = backend.service._dataset()["parent"]
        for student_id, student in self.students.items():
            greeting = backend.service.get_student_greeting(student_id)
            self.assertIn(parent["shortName"], greeting)
            self.assertIn(student["name"], greeting)
            self.assertIn("لولوة", greeting)

    def test_greeting_parent_lookup_supports_student_parent_links_and_no_parent(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "linked.json"
            data = {
                "parents": {"p1": {"name": "والد أول"}, "p2": {"shortName": "والدة ثانية"}},
                "students": [
                    {"id": "a", "name": "طالب أ", "parentId": "p1"},
                    {"id": "b", "name": "طالبة ب", "parentId": "p2"},
                    {"id": "c", "name": "طالب ج"},
                ],
            }
            path.write_text(json.dumps(data), encoding="utf-8")
            service = backend.StudentDataService(path)
            self.assertIn("والد أول", service.get_student_greeting("a"))
            self.assertIn("والدة ثانية", service.get_student_greeting("b"))
            self.assertNotIn("يا ", service.get_student_greeting("c"))
            self.assertIn("طالب ج", service.get_student_greeting("c"))

    def test_conversation_greets_once_and_switch_starts_new_greeting(self):
        first = self.conversation("reem")
        cid = first["conversation_id"]
        self.assertIn("لولوة", first["greeting"])
        self.assertEqual(backend.CONVERSATIONS[cid]["history"], [])
        with patch.object(backend, "OPENAI_API_KEY", ""):
            response = self.client.post("/api/student/chat", json={"student_id": "reem", "conversation_id": cid, "message": "كم غيابها؟"})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("لولوة", response.json()["answer"])
        self.assertNotIn("greeting", response.json())
        second = self.conversation("faisal", cid)
        self.assertIn("فيصل", second["greeting"])
        self.assertNotIn(cid, backend.CONVERSATIONS)

        self.assertEqual(backend.CONVERSATIONS[second["conversation_id"]]["history"], [])

    def test_live_session_speaks_personalized_greeting_through_existing_voice_session(self):
        class Response:
            status_code = 200
            is_error = False
            def json(self):
                return {"session": {"id": "live-greeting"}, "transport": {"sdp": "answer"}}
        class FakeClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return False
            async def post(self, url, *, headers, json):
                self.url, self.payload = url, json
                return Response()
        fake = FakeClient()
        with patch.object(backend, "OPENAI_API_KEY", "test"), patch.object(backend.httpx, "AsyncClient", return_value=fake):
            result = self.client.post("/api/live/session", json={"student_id": "reem", "sdp": "offer", "greet": True})
        self.assertEqual(result.status_code, 200)
        self.assertIn("عبدالرحمن الشهري", fake.payload["session"]["input"][0]["content"][0]["text"])
        self.assertIn("ريم عبدالرحمن الشهري", fake.payload["session"]["instructions"])
        self.assertIn("greeting", result.json())

    def test_live_session_can_skip_duplicate_greeting(self):
        class Response:
            status_code = 200
            is_error = False
            def json(self): return {"session": {"id": "live-no-greeting"}, "transport": {"sdp": "answer"}}
        class FakeClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return False
            async def post(self, url, *, headers, json):
                self.payload = json
                return Response()
        fake = FakeClient()
        with patch.object(backend, "OPENAI_API_KEY", "test"), patch.object(backend.httpx, "AsyncClient", return_value=fake):
            result = self.client.post("/api/live/session", json={"student_id": "reem", "sdp": "offer", "greet": False})
        self.assertEqual(result.status_code, 200)
        self.assertNotIn("input", fake.payload["session"])

    def test_typed_and_voice_share_data_retrieval(self):
        backend.LIVE_SESSIONS["live-test"] = "nawaf"
        expected = backend.enrich(backend.service, backend.service.retrieve_relevant_student_data("nawaf", "كم غيابها؟"), "nawaf", "كم غيابها؟")
        response = self.client.post("/api/student/lookup", json={"question": "كم غيابها؟", "session_id": "live-test"})
        self.assertEqual(response.json(), expected)

    def test_switch_resets_history_and_invalid_ids_are_rejected(self):
        old = self.conversation("reem")["conversation_id"]
        backend.CONVERSATIONS[old]["history"].append({"role": "assistant", "content": "old context"})
        new = self.conversation("nawaf", old)
        self.assertNotIn(old, backend.CONVERSATIONS)
        self.assertEqual(backend.CONVERSATIONS[new["conversation_id"]]["history"], [])
        self.assertEqual(self.client.post("/api/conversations", json={"student_id": "bad"}).status_code, 404)
        self.assertEqual(self.client.get("/api/students/bad").status_code, 404)
        self.assertEqual(self.client.post("/api/student/lookup", json={"question": "حضورها", "session_id": "missing"}).status_code, 401)

    def test_provider_false_unavailable_claim_uses_retrieved_records(self):
        class Response:
            is_error = False
            def json(self): return {"choices": [{"message": {"content": "غير متوفرة لدي بيانات الحضور."}}]}
        class FakeClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return False
            async def post(self, *args, **kwargs): return Response()
        data = backend.service.retrieve_relevant_student_data("reem", "كم غيابها؟")
        with patch.object(backend, "OPENAI_API_KEY", "test"), patch.object(backend.httpx, "AsyncClient", return_value=FakeClient()):
            reply = asyncio.run(backend.answer("كم غيابها؟", data, []))

        self.assertIn("1 غياب", reply)

    def test_malformed_dataset_is_handled(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "bad.json"
            path.write_text("{", encoding="utf-8")
            with self.assertRaises(Exception):
                backend.StudentDataService(path).get_students()


class DemoFlowTests(unittest.TestCase):
    """تفضيلات ولي الأمر -> حدث المدرسة -> قرار (اتصال/رسالة/ولا شي)، وكلها على نفس مصدر البيانات."""

    def setUp(self):
        store.reset()
        self.client = TestClient(backend.app)
        self.prefs = {k: {"timing": "immediate", "method": "call"} for k in ("attendance", "exams", "grades")}

    def event(self, **kw):
        body = {"type": "attendance", "student_id": "mohammed", "subject": "الرياضيات", **kw}
        return self.client.post("/api/school/events", json=body).json()["result"]

    def test_school_requires_login_when_auth_enabled(self):
        from backend import demo_api
        demo_api.SCHOOL_AUTH = True
        self.addCleanup(setattr, demo_api, "SCHOOL_AUTH", False)
        self.assertEqual(self.client.get("/api/school/students").status_code, 401)
        self.assertEqual(self.client.post("/api/school/login", json={"username": "x", "password": "y"}).status_code, 401)
        token = self.client.post("/api/school/login", json={"username": "school", "password": "school123"}).json()["token"]
        self.assertEqual(self.client.get("/api/school/students", headers={"Authorization": f"Bearer {token}"}).status_code, 200)

    def test_no_saved_preferences_means_no_alert(self):
        self.assertEqual(self.event()["action"], "skipped")

    def test_absence_follows_saved_channel(self):
        self.client.put("/api/parent/preferences/mohammed", json=self.prefs)
        self.assertEqual(self.event()["action"], "call")
        self.prefs["attendance"]["method"] = "message"
        self.client.put("/api/parent/preferences/mohammed", json=self.prefs)
        self.assertEqual(self.event()["action"], "message")

    def test_off_topic_is_skipped_and_preferences_persist(self):
        self.prefs["grades"]["timing"] = "off"
        self.client.put("/api/parent/preferences/mohammed", json=self.prefs)
        self.assertEqual(self.event(type="grade", score=9)["action"], "skipped")
        self.assertEqual(self.client.get("/api/parent/preferences/mohammed").json()["preferences"]["grades"]["timing"], "off")

    def test_sibling_preferences_used_when_child_has_none(self):
        self.client.put("/api/parent/preferences/mohammed", json=self.prefs)
        self.assertEqual(self.event(student_id="reem")["action"], "call")

    def test_school_attendance_event_reaches_parent_dashboard_and_agent(self):
        before = backend.service.get_student_attendance("reem")
        self.event(student_id="reem", subject="العلوم", status="absent")
        dash = next(s for s in self.client.get("/api/parent/dashboard").json()["students"] if s["id"] == "reem")
        week_today = dash["attendance"]["week"][-1]
        self.assertEqual(week_today["status"], "absent")
        self.assertEqual(dash["attendance"]["absent"], before["absent"] + 1)
        self.assertEqual(dash["attendance"]["present"], before["present"] - 1)
        # الـ Agent يقرأ من نفس المصدر
        context = backend.service.retrieve_relevant_student_data("reem", "كم غيابها؟")
        self.assertEqual(context["records"]["absent"], before["absent"] + 1)
        lessons = backend.service.get_student("reem")["onlineLessons"]
        self.assertTrue(any(x["subject"] == "العلوم" and x["status"] == "absent" and x["source"] == "school" for x in lessons))

    def test_published_grade_and_exam_visible_everywhere(self):
        self.event(type="grade", student_id="faisal", subject="الرياضيات", assessment="اختبار الوحدة", score=19, max_score=20)
        self.event(type="exam", student_id="faisal", subject="العلوم", kind="اختبار قصير", day="الأحد", date="8 نوفمبر", period="الحصة الثالثة")
        faisal = backend.service.get_student("faisal")
        self.assertEqual(faisal["grades"][0]["assessment"], "اختبار الوحدة")
        self.assertEqual(faisal["exams"][-1]["period"], "الحصة الثالثة")
        dash = next(s for s in self.client.get("/api/school/students").json()["students"] if s["id"] == "faisal")
        self.assertEqual(dash["grades"][0]["score"], 19)
        self.assertIn("العلوم", dash["subjects"])

    def test_every_event_is_logged_with_the_decision(self):
        self.event()
        events = self.client.get("/api/school/events").json()["events"]
        self.assertEqual((len(events), events[0]["student_name"], events[0]["result"]["action"]), (1, "محمد", "skipped"))


if __name__ == "__main__":
    unittest.main()
