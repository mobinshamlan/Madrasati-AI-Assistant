import { operatorAction } from "@/lib/tammeni/api";
import { previewNotification } from "@/lib/tammeni/operator";

/** «معاينة التحديث»: re-evaluates with the latest saved preferences. Never contacts anyone. */
export async function POST(_request: Request, ctx: RouteContext<"/api/demo-control/notifications/[id]/preview">) {
  const { id } = await ctx.params;
  return operatorAction((supabase) => previewNotification(supabase, id));
}
