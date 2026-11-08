"""The scheduler stays off by default, and only ever calls the website with the shared secret."""
import asyncio
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

import backend.app as backend
import backend.scheduler as scheduler


def client_with(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


class SchedulerTests(unittest.TestCase):
    def run_tick(self, handler):
        async def go():
            async with client_with(handler) as client:
                return await scheduler.tick(client)
        return asyncio.run(go())

    def test_off_by_default(self):
        with patch.dict(os.environ, {"TAMMENI_SCHEDULER_ENABLED": ""}, clear=False):
            self.assertFalse(scheduler.scheduler_enabled())
            with patch.object(backend, "run_forever", side_effect=AssertionError("must not start")):
                with TestClient(backend.app) as client:
                    self.assertEqual(client.get("/api/health").status_code, 200)

    def test_only_exact_switch_enables(self):
        with patch.dict(os.environ, {"TAMMENI_SCHEDULER_ENABLED": "true"}, clear=False):
            self.assertFalse(scheduler.scheduler_enabled())
        with patch.dict(os.environ, {"TAMMENI_SCHEDULER_ENABLED": "1"}, clear=False):
            self.assertTrue(scheduler.scheduler_enabled())

    def test_tick_posts_with_the_secret(self):
        seen = {}

        def handler(request):
            seen["url"], seen["secret"], seen["method"] = str(request.url), request.headers.get("x-tammeni-dispatch-secret"), request.method
            return httpx.Response(200, json={"enabled": True, "sent": 0})

        with patch.dict(os.environ, {"TAMMENI_SITE_URL": "https://site.invalid/", "TAMMENI_DISPATCH_SECRET": "s3cret-value"}, clear=False):
            report = self.run_tick(handler)
        self.assertEqual(report["enabled"], True)
        self.assertEqual(seen, {"url": "https://site.invalid/api/internal/run-due", "secret": "s3cret-value", "method": "POST"})

    def test_missing_settings_send_nothing(self):
        with patch.dict(os.environ, {"TAMMENI_SITE_URL": "", "TAMMENI_DISPATCH_SECRET": "x"}, clear=False):
            self.assertIsNone(self.run_tick(lambda _: self.fail("must not call")))

    def test_errors_do_not_escape(self):
        def down(_):
            raise httpx.ConnectError("down")

        with patch.dict(os.environ, {"TAMMENI_SITE_URL": "https://site.invalid", "TAMMENI_DISPATCH_SECRET": "x"}, clear=False):
            self.assertIsNone(self.run_tick(down))
            self.assertIsNone(self.run_tick(lambda _: httpx.Response(500)))

    def test_interval_has_a_floor(self):
        with patch.dict(os.environ, {"TAMMENI_SCHEDULER_INTERVAL_SECONDS": "1"}, clear=False):
            self.assertEqual(scheduler.interval_seconds(), 15)
        with patch.dict(os.environ, {"TAMMENI_SCHEDULER_INTERVAL_SECONDS": "bad"}, clear=False):
            self.assertEqual(scheduler.interval_seconds(), 60)


if __name__ == "__main__":
    unittest.main()
