import { operatorAction } from "@/lib/tammeni/api";
import { overview, todayInRiyadh } from "@/lib/tammeni/operator";

export async function GET() {
  // The same switch the run route reads, so the studio can say before a send whether it can reach a real phone.
  // Even when true, the Python backend's provider and destination allow-list still decide.
  const realDispatch = process.env.TAMMENI_DEMO_REAL_DISPATCH === "1";
  return operatorAction(async (supabase) => ({ ...(await overview(supabase)), today: todayInRiyadh(), realDispatch }));
}
