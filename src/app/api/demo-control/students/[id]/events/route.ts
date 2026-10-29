import { operatorAction, readJson } from "@/lib/tammeni/api";
import { recordEvent } from "@/lib/tammeni/operator";

/** «حفظ الحدث»: saves and evaluates. Never contacts anyone. */
export async function POST(request: Request, ctx: RouteContext<"/api/demo-control/students/[id]/events">) {
  const { id } = await ctx.params;
  return operatorAction(async (supabase) => {
    const body = await readJson(request);
    return recordEvent(supabase, id, (body.event ?? {}) as Record<string, unknown>, body.idempotencyKey);
  });
}
