import { operatorAction, readJson } from "@/lib/tammeni/api";
import { runNotification } from "@/lib/tammeni/operator";

/** «تشغيل التحديث الآن — للديمو». Uses the provider configured on the Python backend (mock by default). */
export async function POST(request: Request, ctx: RouteContext<"/api/demo-control/notifications/[id]/run">) {
  const { id } = await ctx.params;
  return operatorAction(async (supabase) => {
    const body = await readJson(request);
    return runNotification(supabase, id, { idempotencyKey: body.idempotencyKey, prefsVersion: body.prefsVersion, resendOf: body.resendOf });
  });
}
