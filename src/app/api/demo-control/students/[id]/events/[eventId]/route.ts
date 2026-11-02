import { operatorAction } from "@/lib/tammeni/api";
import { clearSimulation } from "@/lib/tammeni/operator";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await ctx.params;
  return operatorAction((supabase) => clearSimulation(supabase, id, eventId));
}
