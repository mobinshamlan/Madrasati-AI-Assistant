"""Once a minute, asks the website to send whatever is due. Off unless TAMMENI_SCHEDULER_ENABLED=1.

The website owns the rules (latest preferences, claims, attempts), so this only keeps time.
"""
from __future__ import annotations

import asyncio
import logging
import os

import httpx

log = logging.getLogger("scheduler")
DEFAULT_INTERVAL_SECONDS = 60
MIN_INTERVAL_SECONDS = 15


def scheduler_enabled() -> bool:
    return os.getenv("TAMMENI_SCHEDULER_ENABLED") == "1"


def interval_seconds() -> int:
    try:
        return max(MIN_INTERVAL_SECONDS, int(os.getenv("TAMMENI_SCHEDULER_INTERVAL_SECONDS", "")))
    except ValueError:
        return DEFAULT_INTERVAL_SECONDS


async def tick(client: httpx.AsyncClient) -> dict | None:
    site = os.getenv("TAMMENI_SITE_URL", "").rstrip("/")
    secret = os.getenv("TAMMENI_DISPATCH_SECRET", "")
    if not site or not secret:
        log.warning("scheduler is on but TAMMENI_SITE_URL or TAMMENI_DISPATCH_SECRET is missing")
        return None
    try:
        response = await client.post(f"{site}/api/internal/run-due", headers={"X-Tammeni-Dispatch-Secret": secret}, timeout=90)
    except httpx.HTTPError as exc:
        log.warning("scheduler could not reach the website (%s)", type(exc).__name__)
        return None
    if response.status_code != 200:
        log.warning("scheduler run refused (HTTP %s)", response.status_code)
        return None
    report = response.json()
    if report.get("sent") or report.get("failed"):
        # Counts only: no names, numbers or message text.
        log.warning("scheduler run: sent=%s failed=%s providers=%s", report.get("sent"), report.get("failed"), report.get("providers"))
    return report


async def run_forever() -> None:
    async with httpx.AsyncClient() as client:
        while True:
            try:
                await tick(client)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - one bad run must not stop the clock
                log.warning("scheduler run failed (%s)", type(exc).__name__)
            await asyncio.sleep(interval_seconds())
