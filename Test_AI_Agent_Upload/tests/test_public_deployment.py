"""TAMMENI_PUBLIC_DEPLOYMENT: only production routes answer. Everything external is mocked."""
import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import backend.app as backend
import backend.phone_bridge as bridge

SECRET = "test-dispatch-secret-0123456789"
PREVIEW = {"student": {}, "preferences": {}}
START = {"event": "start", "start": {"streamSid": "MZ1", "callSid": "CA1", "customParameters": {}}}


class PublicDeploymentTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(backend.app)
        self.env = patch.dict(os.environ, {"TAMMENI_PUBLIC_DEPLOYMENT": "1", "TAMMENI_DISPATCH_SECRET": SECRET,
                                           "TAMMENI_PROVIDER": "mock", "PUBLIC_URL": "https://example.invalid",
                                           "TWILIO_AUTH_TOKEN": "throwaway"}, clear=False)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_only_production_routes_answer(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        with patch.object(backend, "load_dataset", side_effect=AssertionError("must not load")):
            for path in ("/api/students", "/api/students/sama", "/api/status", "/docs", "/openapi.json"):
                self.assertEqual(self.client.get(path).status_code, 404, path)
            for path in ("/api/conversations", "/api/student/chat", "/api/student/lookup", "/api/live/session"):
                self.assertEqual(self.client.post(path, json={}).status_code, 404, path)
            self.assertEqual(self.client.delete("/api/conversations/x").status_code, 404)

    def test_forged_host_cannot_change_the_gated_path(self):
        response = self.client.get("/api/students", headers={"Host": "x/api/health?"})
        self.assertEqual(response.status_code, 404)

    def test_preview_needs_the_secret(self):
        self.assertEqual(self.client.post("/api/parent/preview", json=PREVIEW).status_code, 403)
        ok = self.client.post("/api/parent/preview", json=PREVIEW, headers={"X-Tammeni-Dispatch-Secret": SECRET})
        self.assertEqual(ok.status_code, 422)  # past the secret; the empty body is then rejected

    def test_voice_without_context_or_signature_is_refused(self):
        self.assertEqual(self.client.post("/api/phone/voice").status_code, 403)
        self.assertEqual(self.client.post("/api/phone/voice?ctx=" + "t" * 43, data={"CallSid": "CA1"}).status_code, 403)
        self.assertEqual(self.client.post("/api/phone/voice?ctx=" + "t" * 43, headers={"X-Twilio-Signature": "bad"}).status_code, 403)

    def assert_refused(self, *messages, context=None):
        with patch.object(bridge, "_connect_openai", AsyncMock(side_effect=AssertionError("no OpenAI"))) as openai, \
                patch.object(bridge, "load_context", AsyncMock(return_value=context)):
            with self.client.websocket_connect("/api/phone/media") as socket:
                for message in messages:
                    socket.send_json(message)
                with self.assertRaises(WebSocketDisconnect) as closed:
                    socket.receive_text()
            self.assertEqual(closed.exception.code, 1008)
            openai.assert_not_called()

    def test_media_refuses_unverified_streams(self):
        self.assert_refused(START)
        self.assert_refused({"event": "media", "media": {"payload": "AA=="}})
        self.assert_refused({"event": "start", "start": {"streamSid": "MZ1", "callSid": "CA1", "customParameters": {"ctx": "t" * 43}}})

    def test_valid_token_alone_cannot_open_a_stream(self):
        token = "t" * 43
        start = {"event": "start", "start": {"streamSid": "MZ1", "callSid": "CA1", "customParameters": {"ctx": token}}}
        self.assert_refused(start, context={"method": "call"})

    def test_signed_call_opens_one_stream_for_its_own_token(self):
        bridge._remember_signed_call("CA1", "token-a")
        self.assertFalse(bridge._claim_signed_call("CA1", "token-b"))
        bridge._remember_signed_call("CA1", "token-a")
        self.assertTrue(bridge._claim_signed_call("CA1", "token-a"))
        self.assertFalse(bridge._claim_signed_call("CA1", "token-a"))
        self.assertFalse(bridge._claim_signed_call(None, "token-a"))

    def test_media_closes_a_silent_socket(self):
        with patch.object(bridge, "MEDIA_START_DEADLINE_SECONDS", 0.01):
            self.assert_refused()


class LocalBehaviourTests(unittest.TestCase):
    def test_switch_unset_keeps_demo_routes(self):
        with patch.dict(os.environ, {"TAMMENI_PUBLIC_DEPLOYMENT": ""}, clear=False):
            client = TestClient(backend.app)
            self.assertEqual(client.get("/api/status").status_code, 200)
            self.assertIn("<Stream", client.post("/api/phone/voice").text)
            self.assertEqual(client.post("/api/parent/preview", json=PREVIEW).status_code, 422)


if __name__ == "__main__":
    unittest.main()
