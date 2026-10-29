import copy
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app import app


class ParentPreviewTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.body = {
            "student": {"id": "reem", "name": "ريم", "attendance": {"present": 46, "schoolDays": 48},
                        "exams": [{"subject": "الرياضيات", "day": "الأحد"}],
                        "grades": [{"subject": "العلوم", "score": 18, "outOf": 20}]},
            "preferences": {
                "attendance": {"timing": "end-of-day", "method": "message", "custom": {"kind": "daily", "day": "thu", "time": "18:00"}},
                "exams": {"timing": "day-before", "method": "call", "customDays": 2, "time": "18:00"},
                "grades": {"timing": "off", "method": "call", "dayOfMonth": 1, "time": "18:00"},
                "retryUnansweredCall": False,
            },
        }

    def test_filters_off_topics_and_preserves_methods_without_provider_requests(self):
        with patch("backend.app.httpx.AsyncClient") as provider:
            response = self.client.post("/api/parent/preview", json=self.body)
        provider.assert_not_called()
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["previewOnly"])
        self.assertEqual([(x["topic"], x["method"]) for x in data["updates"]], [("attendance", "message"), ("exams", "call")])
        self.assertNotIn("18 من 20", response.text)
        self.assertNotIn("محمد", response.text)
        self.assertIn("46 من 48", response.text)

    def test_switching_students_does_not_reuse_previous_records(self):
        self.client.post("/api/parent/preview", json=self.body)
        body = copy.deepcopy(self.body)
        body["student"].update(id="faisal", name="فيصل", attendance={"present": 43, "schoolDays": 48})
        response = self.client.post("/api/parent/preview", json=body)
        self.assertEqual(response.json()["studentId"], "faisal")
        self.assertIn("43 من 48", response.text)
        self.assertNotIn("ريم", response.text)
        self.assertNotIn("46 من 48", response.text)

    def test_invalid_preferences_are_rejected(self):
        for path, value in [(('exams', 'time'), '29:00'), (('grades', 'dayOfMonth'), 31), (('attendance', 'method'), 'email')]:
            body = copy.deepcopy(self.body)
            body["preferences"][path[0]][path[1]] = value
            self.assertEqual(self.client.post("/api/parent/preview", json=body).status_code, 422)

    def test_all_topics_off_and_unknown_students_are_rejected(self):
        body = copy.deepcopy(self.body)
        for topic in ("attendance", "exams", "grades"):
            body["preferences"][topic]["timing"] = "off"
        self.assertEqual(self.client.post("/api/parent/preview", json=body).status_code, 422)
        self.body["student"]["id"] = "unknown"
        self.assertEqual(self.client.post("/api/parent/preview", json=self.body).status_code, 422)
