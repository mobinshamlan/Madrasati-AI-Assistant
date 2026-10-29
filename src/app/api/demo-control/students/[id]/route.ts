import { operatorAction } from "@/lib/tammeni/api";
import { studentPanel } from "@/lib/tammeni/operator";

export async function GET(_request: Request, ctx: RouteContext<"/api/demo-control/students/[id]">) {
  const { id } = await ctx.params;
  return operatorAction((supabase) => studentPanel(supabase, id));
}
