import { localOperatorAllowed } from "@/lib/tammeni/local-operator";
import { isOperator, operatorServerClient } from "@/lib/supabase/server";

/**
 * Local demo only: signs the operator account in from the server, so /demo-control opens without the form.
 * Refused unless TAMMENI_LOCAL_OPERATOR=1, `next dev`, and a request straight from this machine (see
 * local-operator.ts). The session goes into the operator's own cookie, never the parent's.
 */
export async function POST(request: Request) {
  if (!localOperatorAllowed(process.env, request.headers, { signIn: true })) {
    return Response.json({ error: "الدخول التلقائي للمشغّل متاح فقط في الديمو المحلي." }, { status: 403 });
  }
  const email = process.env.TAMMENI_DEMO_OPERATOR_EMAIL;
  const password = process.env.TAMMENI_DEMO_OPERATOR_PASSWORD;
  if (!email || !password) {
    return Response.json({ error: "حساب المشغّل غير مُعدّ على الخادم (TAMMENI_DEMO_OPERATOR_*)." }, { status: 503 });
  }
  if (email.trim().toLowerCase() === process.env.TAMMENI_DEMO_PARENT_EMAIL?.trim().toLowerCase()) {
    // Misconfiguration guard: the operator and the parent must be different accounts.
    return Response.json({ error: "حساب المشغّل يطابق حساب ولي الأمر؛ راجع الإعداد." }, { status: 500 });
  }
  const supabase = await operatorServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return Response.json({ error: "تعذّر دخول المشغّل التلقائي. تحقق من بيانات الحساب." }, { status: 502 });
  if (!isOperator(data.user)) {
    await supabase.auth.signOut({ scope: "local" });
    return Response.json({ error: "هذا الحساب لا يملك صلاحية تشغيل الديمو." }, { status: 403 });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
