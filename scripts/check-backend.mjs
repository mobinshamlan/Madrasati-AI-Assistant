// Read-only check: MOCK status never contacts Twilio or sends a notification.
const base = process.env.TAMMENI_BACKEND_URL?.trim() || "http://127.0.0.1:8000";
const secret = process.env.TAMMENI_DISPATCH_SECRET;
try {
  if (!secret) throw new Error("TAMMENI_DISPATCH_SECRET is missing in .env.local.");
  const health = await fetch(new URL("/api/health", base), { signal: AbortSignal.timeout(5000) });
  if (!health.ok) throw new Error(`Python health check returned HTTP ${health.status}.`);
  const response = await fetch(new URL("/api/notify/status", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tammeni-Dispatch-Secret": secret },
    body: JSON.stringify({ provider_sid: "MOCK-connection-check", method: "message" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Dispatch connection returned HTTP ${response.status}. Check that both dispatch secrets match.`);
  const data = await response.json();
  if (data.provider !== "mock" || data.provider_status !== "mock-accepted") throw new Error("Unexpected backend response.");
  console.log("Website environment → Python → authenticated notification endpoint: OK. No SMS or call sent.");
} catch (error) {
  console.error(error instanceof TypeError ? "Cannot reach Python. Start Test_AI_Agent_Upload/.venv/bin/python -m uvicorn backend.app:app from Test_AI_Agent_Upload, and check TAMMENI_BACKEND_URL (default http://127.0.0.1:8000)." : error.message);
  process.exitCode = 1;
}
