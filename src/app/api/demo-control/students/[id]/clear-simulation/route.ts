import { operatorAction } from "@/lib/tammeni/api";
import { clearSimulation } from "@/lib/tammeni/operator";

export async function POST(_request: Request, ctx: RouteContext<"/api/demo-control/students/[id]/clear-simulation">) {
  const { id } = await ctx.params;
  return operatorAction((supabase) => clearSimulation(supabase, id));
}
