import { operatorAction } from "@/lib/tammeni/api";
import { overview, todayInRiyadh } from "@/lib/tammeni/operator";

export async function GET() {
  return operatorAction(async (supabase) => ({ ...(await overview(supabase)), today: todayInRiyadh() }));
}
