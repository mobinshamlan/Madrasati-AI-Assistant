import { operatorAction, readJson } from "@/lib/tammeni/api";
import { runNotification } from "@/lib/tammeni/operator";

/** Direct local demo: mock unless real dispatch is explicitly enabled on the server. */
export async function POST(request: Request, ctx: RouteContext<"/api/demo-control/notifications/[id]/run">) {
  const { id } = await ctx.params;
  const forceMock = process.env.TAMMENI_DEMO_REAL_DISPATCH !== "1";
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
