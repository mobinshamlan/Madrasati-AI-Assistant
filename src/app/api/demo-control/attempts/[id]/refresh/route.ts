import { operatorAction } from "@/lib/tammeni/api";
import { refreshAttempt } from "@/lib/tammeni/operator";

export async function POST(_request: Request, ctx: RouteContext<"/api/demo-control/attempts/[id]/refresh">) {
  const { id } = await ctx.params;
  return operatorAction((supabase) => refreshAttempt(supabase, id));
}
