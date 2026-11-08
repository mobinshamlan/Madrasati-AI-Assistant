import { autoDispatchEnabled, autoRealAllowed, dispatchSecretValid, maxLateMs } from "@/lib/tammeni/auto-dispatch";
import { OperatorError, runDueNotifications, serverClient } from "@/lib/tammeni/operator";

/** Called once a minute by the always-on backend. Does nothing unless TAMMENI_AUTO_DISPATCH=1. */
export async function POST(request: Request) {
  if (!dispatchSecretValid(process.env, request.headers.get("x-tammeni-dispatch-secret"))) {
    return Response.json({ error: "غير مصرّح." }, { status: 403 });
  }
  if (!autoDispatchEnabled(process.env)) return Response.json({ enabled: false });
  try {
    const report = await runDueNotifications(serverClient(), {
      real: autoRealAllowed(process.env),
      maxLateMs: maxLateMs(process.env),
      maxBatches: 10,
      budgetMs: 45_000,
    });
    return Response.json({ enabled: true, real: autoRealAllowed(process.env), ...report });
  } catch (error) {
    const status = error instanceof OperatorError ? error.status : 500;
    return Response.json({ error: "تعذّر تشغيل المواعيد." }, { status });
  }
}
