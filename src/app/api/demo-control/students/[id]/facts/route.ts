import { operatorAction } from "@/lib/tammeni/api";
import { studentCallFacts } from "@/lib/tammeni/operator";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return operatorAction((supabase) => studentCallFacts(supabase, id));
}
