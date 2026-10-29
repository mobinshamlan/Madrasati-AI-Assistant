import { sharedDemoRefusal } from "@/lib/tammeni/shared-demo";
import { markSharedDispatch } from "@/lib/tammeni/shared-dispatch";
import { isOperator, operatorServerClient } from "@/lib/supabase/server";

/**
 * Shared demo URL: signs the existing operator account in from the server, so /demo-control opens
 * without a password. Refused unless TAMMENI_SHARED_DEMO=1 and the POST comes from the same host.
 * The session is the operator cookie. A separate marker forces later sends to stay on the mock provider.
 */
export async function POST(request: Request) {
  const reason = sharedDemoRefusal(process.env, request.headers, { signIn: true });
  if (reason === "off") {
    return Response.json({ error: "الدخول التلقائي للمشغّل غير مفعّل على هذا الخادم." }, { status: 403 });
  }
  if (reason) {
    return Response.json({ error: "يجب أن يبدأ الدخول من صفحة الديمو نفسها." }, { status: 403 });
  }
  const email = process.env.TAMMENI_DEMO_OPERATOR_EMAIL;
  const password = process.env.TAMMENI_DEMO_OPERATOR_PASSWORD;
  if (!email || !password) {
    return Response.json({ error: "حساب المشغّل غير مُعدّ على الخادم (TAMMENI_DEMO_OPERATOR_*)." }, { status: 503 });
  }
  if (email.trim().toLowerCase() === process.env.TAMMENI_DEMO_PARENT_EMAIL?.trim().toLowerCase()) {
    return Response.json({ error: "حساب المشغّل يطابق حساب ولي الأمر؛ راجع الإعداد." }, { status: 500 });
  }
  const supabase = await operatorServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return Response.json({ error: "تعذّر دخول المشغّل التلقائي. تحقق من بيانات الحساب." }, { status: 502 });
  if (!isOperator(data.user)) {
    await supabase.auth.signOut({ scope: "local" });
    return Response.json({ error: "هذا الحساب لا يملك صلاحية تشغيل الديمو." }, { status: 403 });
  }
  await markSharedDispatch();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
