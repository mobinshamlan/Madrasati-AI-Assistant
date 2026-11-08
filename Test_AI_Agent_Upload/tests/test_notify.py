"""Dispatch and call-context tests. Everything external is mocked: no Supabase, Twilio or OpenAI requests."""
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from backend.app import app
from backend.call_context import context_instructions, valid_context

SECRET = "test-dispatch-secret-0123456789"
TOKEN = "t" * 43
CTX = {
    "version": 1,
    "persona": "lulwa",
    "student": {"first_name": "ريم", "full_name": "ريم عبدالرحمن الشهري"},
    "topic": "attendance",
    "allowed_topics": ["attendance"],
    "method": "message",
    "facts": ["الحضور يوم الخميس 29 أكتوبر: غياب."],
    "message": "طمّني | ريم عبدالرحمن الشهري\nتحديث حضور ريم:\nالحضور يوم الخميس 29 أكتوبر: غياب.",
    "opening": "مرحبا، معك لولوة من طمّني. حابين نبلغك بخصوص ريم: الحضور يوم الخميس 29 أكتوبر: غياب.",
    "retry_unanswered_call": False,
    "attempt_id": "00000000-0000-4000-8000-000000000001",
}
BODY = {"token": TOKEN, "method": "message", "idempotency_key": "key-12345678"}


class DispatchTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.env = patch.dict(os.environ, {"TAMMENI_DISPATCH_SECRET": SECRET, "TAMMENI_PROVIDER": "mock",
                                               "PARENT_PHONE1": "", "TWILIO_SMS_FROM": "Tammeni"}, clear=False)
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def post(self, body=BODY, secret=SECRET):
        headers = {"X-Tammeni-Dispatch-Secret": secret} if secret else {}
        return self.client.post("/api/notify/dispatch", json=body, headers=headers)

    def test_requires_the_shared_secret(self):
        self.assertEqual(self.post(secret=None).status_code, 403)
        self.assertEqual(self.post(secret="wrong-secret-0000000000").status_code, 403)

    def test_mock_provider_accepts_without_contacting_anyone(self):
        with patch("backend.notify.load_context", AsyncMock(return_value=CTX)), patch("twilio.rest.Client") as twilio:
            r = self.post()
        twilio.assert_not_called()
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual((data["provider"], data["status"], data["provider_status"]), ("mock", "accepted", "mock-accepted"))
        self.assertTrue(data["provider_sid"].startswith("MOCK-"))

    def test_no_context_means_nothing_is_sent_and_no_fallback(self):
        with patch("backend.notify.load_context", AsyncMock(return_value=None)):
            r = self.post()
        self.assertEqual(r.status_code, 409)
        self.assertNotIn("محمد", r.text)

    def test_method_must_match_the_saved_context(self):
        with patch("backend.notify.load_context", AsyncMock(return_value=CTX)):
            r = self.post({**BODY, "method": "call"})
        self.assertEqual(r.status_code, 409)

    def test_twilio_refuses_a_destination_off_the_allow_list(self):
        env = {"TAMMENI_PROVIDER": "twilio", "PARENT_PHONE": "+447700900123", "TAMMENI_ALLOWED_DESTINATIONS": "+447700900999",
               "TWILIO_ACCOUNT_SID": "AC" + "0" * 32, "TWILIO_AUTH_TOKEN": "x" * 32}
        with patch.dict(os.environ, env), patch("backend.notify.load_context", AsyncMock(return_value=CTX)), patch("twilio.rest.Client") as twilio:
            r = self.post()
        self.assertEqual(r.status_code, 403)
        twilio.assert_not_called()

    def test_twilio_message_uses_the_server_number_and_reports_acceptance_not_delivery(self):
        env = {"TAMMENI_PROVIDER": "twilio", "PARENT_PHONE": "+447700900123", "TAMMENI_ALLOWED_DESTINATIONS": "+447700900123",
               "TWILIO_ACCOUNT_SID": "AC" + "0" * 32, "TWILIO_AUTH_TOKEN": "x" * 32}
        fake = MagicMock()
        fake.messages.create.return_value = MagicMock(sid="SM" + "1" * 32, status="queued")
        with patch.dict(os.environ, env), patch("backend.notify.load_context", AsyncMock(return_value=CTX)), patch("twilio.rest.Client", return_value=fake):
            r = self.post()
        kwargs = fake.messages.create.call_args.kwargs
        self.assertEqual(kwargs["to"], "+447700900123")
        self.assertEqual(kwargs["from_"], "Tammeni")  # the sender proven by test_sms.py
        self.assertEqual(kwargs["body"], CTX["message"])  # same facts as the preview and the call
        data = r.json()
        self.assertEqual((data["status"], data["provider_status"]), ("accepted", "queued"))
        self.assertNotIn("900123", data["to_masked"])

    def test_calls_and_messages_go_to_their_own_numbers(self):
        env = {"TAMMENI_PROVIDER": "twilio", "PARENT_PHONE": "+447700900222", "PARENT_PHONE1": "+447700900333",
               "TAMMENI_ALLOWED_DESTINATIONS": "+447700900222,+447700900333", "TWILIO_ACCOUNT_SID": "AC" + "0" * 32, "TWILIO_AUTH_TOKEN": "x" * 32,
               "TWILIO_FROM": "+447700900000", "PUBLIC_URL": "https://example.test", "OPENAI_API_KEY": "test-key"}
        fake = MagicMock()
        fake.messages.create.return_value = MagicMock(sid="SM" + "1" * 32, status="queued")
        fake.calls.create.return_value = MagicMock(sid="CA" + "2" * 32, status="queued")
        with patch.dict(os.environ, env), patch("twilio.rest.Client", return_value=fake):
            with patch("backend.notify.load_context", AsyncMock(return_value=CTX)):
                self.post()
            with patch("backend.notify.load_context", AsyncMock(return_value={**CTX, "method": "call"})):
                self.post({**BODY, "method": "call"})
        self.assertEqual(fake.messages.create.call_args.kwargs["to"], "+447700900333")
        self.assertEqual(fake.calls.create.call_args.kwargs["to"], "+447700900222")

    def test_each_number_must_be_on_the_allow_list(self):
        env = {"TAMMENI_PROVIDER": "twilio", "PARENT_PHONE": "+447700900222", "PARENT_PHONE1": "+447700900333", "TAMMENI_ALLOWED_DESTINATIONS": "+447700900222",
               "TWILIO_ACCOUNT_SID": "AC" + "0" * 32, "TWILIO_AUTH_TOKEN": "x" * 32}
        with patch.dict(os.environ, env), patch("backend.notify.load_context", AsyncMock(return_value=CTX)), patch("twilio.rest.Client") as twilio:
            r = self.post()
        self.assertEqual(r.status_code, 403)
        twilio.assert_not_called()

    def test_force_mock_never_calls_twilio_even_when_the_provider_is_twilio(self):
        env = {"TAMMENI_PROVIDER": "twilio", "PARENT_PHONE": "+447700900123", "TAMMENI_ALLOWED_DESTINATIONS": "+447700900123",
               "TWILIO_ACCOUNT_SID": "AC" + "0" * 32, "TWILIO_AUTH_TOKEN": "x" * 32}
        with patch.dict(os.environ, env), patch("backend.notify.load_context", AsyncMock(return_value=CTX)), patch("twilio.rest.Client") as twilio:
            r = self.post({**BODY, "force_mock": True})
        twilio.assert_not_called()
        data = r.json()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(data["provider"], "mock")
        self.assertTrue(data["provider_sid"].startswith("MOCK-"))

    def test_status_of_a_mock_attempt_never_claims_delivery(self):
        r = self.client.post("/api/notify/status", json={"provider_sid": "MOCK-" + "a" * 24, "method": "message"}, headers={"X-Tammeni-Dispatch-Secret": SECRET})
        self.assertEqual(r.json()["status"], "accepted")


class CallContextTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_instructions_carry_only_this_update(self):
        text = context_instructions({**CTX, "method": "call"})
        self.assertIn("الحضور يوم الخميس 29 أكتوبر: غياب.", text)
        self.assertNotIn("درجة", text.split("ضوابط المكالمة")[0])
        self.assertIn("لا تؤكد أنك رفعت عذر", text)

    def test_context_with_more_than_one_topic_is_refused(self):
        self.assertTrue(valid_context(CTX))
        self.assertFalse(valid_context({**CTX, "allowed_topics": ["attendance", "grades"]}))

    def test_off_topic_redirect_uses_the_current_students_name(self):
        for name in ("ريم", "نواف"):
            with self.subTest(student=name):
                ctx = {**CTX, "method": "call", "student": {"first_name": name}}
                text = context_instructions(ctx)
                self.assertIn(f"أنا أساعدك بمتابعة أخبار {name} الدراسية. عندك سؤال عن الحضور أو الدرجات أو الاختبارات؟", text)
                self.assertIn("ولا تنه المكالمة لمجرد هذا السؤال", text)
                self.assertIn("يبقى داخل النطاق؛ أجب عنه من السجلات المتاحة", text)
                self.assertIn(CTX["opening"], text)

    def test_call_language_is_arabic_even_with_english_school_data(self):
        from backend.call_context import ARABIC_CALL_RULE
        ctx = {**CTX, "method": "call", "student": {**CTX["student"], "id": "reem-id"}, "conversation_data": {
            "student_id": "reem-id", "records": {"grades": [{"subject": "English", "assessment": "Quiz - Unit 3", "score": 9, "out_of": 10}]}}}
        text = context_instructions(ctx)
        self.assertTrue(text.startswith(ARABIC_CALL_RULE))
        self.assertIn("لا تبدأ بالإنجليزية ولا تنتقل إليها", text)
        self.assertIn('"score": 9', text)
        self.assertIn(CTX["opening"], text)

    def test_legacy_phone_path_uses_the_same_arabic_language_rule(self):
        from backend.call_context import ARABIC_CALL_RULE
        from backend.phone_bridge import build_instructions
        with patch("backend.phone_bridge._load_student", return_value=None), patch("backend.phone_bridge.opening_line", return_value="مرحبا، معك لولوة"):
            text = build_instructions({"persona": "lulwa", "gender": "f", "student": "reem"})
        self.assertTrue(text.startswith(ARABIC_CALL_RULE))

    def test_call_can_answer_other_topics_for_the_same_student(self):
        ctx = {**CTX, "method": "call", "student": {**CTX["student"], "id": "reem-id"}, "conversation_data": {
            "student_id": "reem-id", "as_of": "2026-10-29T14:00:00Z", "records": {
                "grades": [{"subject": "رياضيات", "assessment": "اختبار", "score": 9, "out_of": 10, "published_on": "2026-10-29"}],
                "attendance_terms": [{"school_days": 2, "present": 2, "absent": 0, "late": 0, "excused": 0}],
                "attendance_records": [
                    {"day": "2026-10-29", "status": "present", "origin": "import"},
                    {"day": "2026-10-29", "status": "absent", "origin": "demo"}],
            }}}
        self.assertTrue(valid_context(ctx))
        text = context_instructions(ctx)
        self.assertIn('"score": 9', text)
        self.assertIn("حتى لو اختلف السؤال عن سبب المكالمة", text)
        self.assertIn('"present": 1, "absent": 1', text)
        self.assertNotIn("سؤال توضيحي واحد كحد أقصى", text)
        # The triggering event remains unchanged while conversation scope expands.
        self.assertIn(CTX["opening"], text)
        wrong = {**ctx, "conversation_data": {**ctx["conversation_data"], "student_id": "nawaf-id"}}
        self.assertFalse(valid_context(wrong))
        self.assertFalse(valid_context({**ctx, "method": "message"}))

    def test_empty_grade_list_is_not_treated_as_zero(self):
        ctx = {**CTX, "method": "call", "student": {**CTX["student"], "id": "reem-id"}, "conversation_data": {
            "student_id": "reem-id", "records": {"grades": []}}}
        text = context_instructions(ctx)
        self.assertIn('"grades": []', text)
        self.assertIn("لا تعتبرها صفرًا", text)

    def test_voice_with_context_requires_a_valid_twilio_signature(self):
        env = {"TWILIO_AUTH_TOKEN": "x" * 32, "PUBLIC_URL": "https://example.ngrok-free.app"}
        with patch.dict(os.environ, env), patch("backend.phone_bridge.load_context", AsyncMock(return_value={**CTX, "method": "call"})):
            r = self.client.post(f"/api/phone/voice?ctx={TOKEN}", data={"CallSid": "CA1"}, headers={"X-Twilio-Signature": "forged"})
        self.assertEqual(r.status_code, 403)

    def test_signed_voice_request_streams_only_the_token(self):
        from twilio.request_validator import RequestValidator

        env = {"TWILIO_AUTH_TOKEN": "x" * 32, "PUBLIC_URL": "https://example.ngrok-free.app"}
        form = {"CallSid": "CA1"}
        url = f"https://example.ngrok-free.app/api/phone/voice?ctx={TOKEN}"
        signature = RequestValidator("x" * 32).compute_signature(url, form)
        with patch.dict(os.environ, env), patch("backend.phone_bridge.load_context", AsyncMock(return_value={**CTX, "method": "call"})):
            r = self.client.post(f"/api/phone/voice?ctx={TOKEN}", data=form, headers={"X-Twilio-Signature": signature})
        self.assertEqual(r.status_code, 200)
        self.assertIn(f'<Parameter name="ctx" value="{TOKEN}"/>', r.text)
        self.assertNotIn("ريم", r.text)  # no facts in TwiML

    def test_signed_voice_without_a_context_hangs_up_without_fallback(self):
        from twilio.request_validator import RequestValidator

        env = {"TWILIO_AUTH_TOKEN": "x" * 32, "PUBLIC_URL": "https://example.ngrok-free.app"}
        url = f"https://example.ngrok-free.app/api/phone/voice?ctx={TOKEN}"
        signature = RequestValidator("x" * 32).compute_signature(url, {})
        with patch.dict(os.environ, env), patch("backend.phone_bridge.load_context", AsyncMock(return_value=None)):
            r = self.client.post(f"/api/phone/voice?ctx={TOKEN}", headers={"X-Twilio-Signature": signature})
        self.assertIn("<Hangup/>", r.text)
        self.assertNotIn("محمد", r.text)

    def test_legacy_voice_path_is_unchanged(self):
        r = self.client.post("/api/phone/voice?persona=lulwa&student=محمد&scenario=absence")
        self.assertEqual(r.status_code, 200)
        self.assertIn('<Parameter name="student" value="محمد"/>', r.text)


if __name__ == "__main__":
    unittest.main()
