import asyncio
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
import backend.app as backend


class AgentTests(unittest.TestCase):
    def setUp(self):
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
        self.assertEqual(len(self.students), 4)
        self.assertEqual({s["id"] for s in self.client.get("/api/students").json()}, set(self.students))

    def test_every_student_has_profile_attendance_week_exams_grades_and_announcements(self):
        expected = {"reem": (3, 5, 3), "faisal": (4, 5, 3), "lujain": (3, 6, 3), "nawaf": (2, 5, 3)}
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


if __name__ == "__main__":
    unittest.main()
