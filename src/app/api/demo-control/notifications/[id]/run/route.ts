import { operatorAction, readJson } from "@/lib/tammeni/api";
import { runNotification } from "@/lib/tammeni/operator";
import { isSharedDispatch } from "@/lib/tammeni/shared-dispatch";

/**
 * «تشغيل التحديث الآن — للديمو». A password session uses the provider on the Python backend.
 * A session opened by the shared-demo shortcut is forced to mock here, before any provider call.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/demo-control/notifications/[id]/run">) {
  const { id } = await ctx.params;
  const forceMock = await isSharedDispatch();
  return operatorAction(async (supabase) => {
    const body = await readJson(request);
    return runNotification(supabase, id, {
      idempotencyKey: body.idempotencyKey,
      prefsVersion: body.prefsVersion,
      resendOf: body.resendOf,
      forceMock,
    });
  });
}
