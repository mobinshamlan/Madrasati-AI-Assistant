import { operatorAction } from "@/lib/tammeni/api";
import { resetPreferences } from "@/lib/tammeni/operator";

export async function POST(_request: Request, ctx: RouteContext<"/api/demo-control/students/[id]/reset-preferences">) {
  const { id } = await ctx.params;
  return operatorAction((supabase) => resetPreferences(supabase, id));
}
