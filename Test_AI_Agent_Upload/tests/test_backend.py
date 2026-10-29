
import asyncio
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient

import backend.app as backend


class DataTests(unittest.TestCase):
    def setUp(self): self.service = backend.StudentDataService(backend.DATA_PATH)
    def test_loads_existing_utf8_dataset(self):
        students = self.service.all_students()
        self.assertGreaterEqual(len(students), 1)
        self.assertEqual(students[0]["student_name"], "محمد")
    def test_subject_lookup_returns_actual_json_grades(self):
        data = self.service.retrieve("كيف مستواه في الانجليزي؟")
        self.assertTrue(data["found"])
        self.assertEqual(data["records"]["subject"], "اللغة الإنجليزية")
        self.assertEqual(data["records"]["grades"][0]["score"], 95)
    def test_followup_uses_session_student_context(self):
        student = self.service.all_students()[0]
        data = self.service.retrieve("طيب والحضور؟", student["student_id"])
        self.assertTrue(data["found"])
        self.assertEqual(data["records"]["student_name"], student["student_name"])
    def test_missing_subject_is_not_invented(self):
        data = self.service.retrieve("كيف مستواه في التاريخ؟")
        self.assertFalse(data["found"])
    def test_malformed_dataset_reports_error(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "bad.json"
            path.write_text("{", encoding="utf-8")
            with self.assertRaises(Exception): backend.StudentDataService(path).all_students()


class ApiTests(unittest.TestCase):
    def setUp(self): self.client = TestClient(backend.app)
    def test_health_and_status_do_not_create_live_sessions(self):
        backend.LIVE_SESSIONS.clear()
        self.assertEqual(self.client.get("/api/health").json(), {"status": "ok"})
        status = self.client.get("/api/status").json()
        self.assertEqual(status["model"], "gpt-live-1")
        self.assertFalse(status["session_created"])
        self.assertEqual(backend.LIVE_SESSIONS, {})
    def test_local_lookup_endpoint_reads_dataset(self):
        result = self.client.post("/api/student/lookup", json={"question": "ما نتيجة اختبار العلوم؟"})
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()["found"])
        self.assertEqual(result.json()["records"]["subject"], "العلوم")
    def test_missing_api_key_never_calls_provider(self):
        with patch.object(backend, "OPENAI_API_KEY", ""), patch.object(backend.httpx, "AsyncClient") as client:
            response = self.client.post("/api/live/session", json={"sdp": "offer"})
        self.assertEqual(response.status_code, 503)
        client.assert_not_called()
    def test_session_payload_uses_exact_model_and_mocks_openai(self):
        class Response:
            status_code = 200
            is_error = False
            def json(self): return {"session": {"id": "live_mock"}, "transport": {"sdp": "answer_sdp"}}
        class FakeClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return False
            async def post(self, url, *, headers, json):
                self.url, self.headers, self.payload = url, headers, json
                return Response()
        fake = FakeClient()
        with patch.object(backend, "OPENAI_API_KEY", "test-secret"), patch.object(backend.httpx, "AsyncClient", return_value=fake):
            response = self.client.post("/api/live/session", json={"sdp": "offer_sdp"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"session_id": "live_mock", "sdp": "answer_sdp"})
        self.assertEqual(fake.url, "https://api.openai.com/v1/live/sessions")
        self.assertEqual(fake.payload["session"]["model"], "gpt-live-1")
        self.assertEqual(fake.payload["transport"]["sdp"], "offer_sdp")
        self.assertEqual(fake.payload["session"]["delegation"]["type"], "client")
        self.assertNotIn("test-secret", response.text)
    def test_upstream_auth_failure_is_sanitized(self):
        class Response:
            status_code = 401
            is_error = True
        class FakeClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return False
            async def post(self, *args, **kwargs): return Response()
        with patch.object(backend, "OPENAI_API_KEY", "secret"), patch.object(backend.httpx, "AsyncClient", return_value=FakeClient()):
            response = self.client.post("/api/live/session", json={"sdp": "offer"})
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("secret", response.text)


if __name__ == "__main__": unittest.main()


class DemoFlowTests(unittest.TestCase):
    """تفضيلات ولي الأمر في الـ backend -> حدث المدرسة -> قرار (اتصال/رسالة/ولا شي)."""

    def setUp(self):
        import os
        from backend import store
        self._tmp = TemporaryDirectory()
        os.environ["DEMO_DRY_RUN"] = "1"
        store.STATE_PATH = Path(self._tmp.name) / "state.json"
        store._state = None
        self.client = TestClient(backend.app)
        token = self.client.post("/api/school/login", json={"username": "school", "password": "school123"}).json()["token"]
        self.h = {"Authorization": f"Bearer {token}"}
        self.prefs = {k: {"timing": "immediate", "method": "call"} for k in ("attendance", "exams", "grades")}

    def tearDown(self): self._tmp.cleanup()

    def event(self, **kw):
        body = {"type": "attendance", "student_id": "mohammed", "subject_id": "MATH", **kw}
        return self.client.post("/api/school/events", headers=self.h, json=body).json()["result"]

    def test_school_requires_login_when_auth_enabled(self):
        from backend import demo_api
        demo_api.SCHOOL_AUTH = True
        self.addCleanup(setattr, demo_api, "SCHOOL_AUTH", False)
        self.assertEqual(self.client.get("/api/school/students").status_code, 401)
        self.assertEqual(self.client.post("/api/school/login", json={"username": "x", "password": "y"}).status_code, 401)

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
        saved = self.client.get("/api/parent/preferences/mohammed").json()["preferences"]
        self.assertEqual(saved["grades"]["timing"], "off")

    def test_event_updates_school_data_and_log(self):
        self.event()
        students = self.client.get("/api/school/students", headers=self.h).json()["students"]
        math = students[0]["subjects"][0]
        self.assertEqual(math["attendance"][-1]["status"], "absent")
        self.assertEqual(len(self.client.get("/api/school/events", headers=self.h).json()["events"]), 1)

    def test_sibling_preferences_used_when_child_has_none(self):
        self.client.put("/api/parent/preferences/mohammed", json=self.prefs)
        self.assertEqual(self.event(student_id="reem")["action"], "call")
