import "server-only";

import { OperatorError, requireOperator } from "./operator";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Runs an operator action and turns failures into a plain Arabic message, never a stack or a secret. */
export async function operatorAction(run: (supabase: SupabaseClient) => Promise<unknown>) {
  try {
    const supabase = await requireOperator();
    const data = await run(supabase);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OperatorError) return Response.json({ error: e.message, ...e.extra }, { status: e.status });
    return Response.json({ error: "حدث خطأ غير متوقع. حاول مرة أخرى." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    throw new OperatorError(400, "تعذّرت قراءة الطلب.");
  }
}
