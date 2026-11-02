import { createClient } from "@supabase/supabase-js";
import { directDemoAllowed } from "@/lib/tammeni/direct-demo";

/**
 * Demo entry: signs in the one fictional parent account and hands its session to the browser.
 * The password never leaves the server. This works from localhost and from the shared demo URL;
 * it is not limited to loopback. Anyone using the demo becomes that same fictional parent, who can
 * read and change only ريم and نواف (enforced by RLS). It grants no operator rights and uses the
 * parent cookie, never the operator's.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.TAMMENI_DEMO_PARENT_EMAIL;
  const password = process.env.TAMMENI_DEMO_PARENT_PASSWORD;
  const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  // Local fictional demo: derive the existing parent from both linked demo children.
  // No password reset, account creation or email delivery. Parent RLS still applies to the session.
  if (url && key && serverKey && directDemoAllowed(process.env, request.headers)) {
    const admin = createClient(url, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const links = await admin.from("parent_students").select("parent_id, students!inner(demo_key)").in("students.demo_key", ["reem", "nawaf"]);
    const ids = [...new Set((links.data ?? []).map(x => x.parent_id))];
    if (links.error || ids.length !== 1 || links.data?.length !== 2) {
      return Response.json({ error: "تعذّر تحديد ولي الأمر المرتبط بريم ونواف." }, { status: 503 });
    }
    const account = await admin.auth.admin.getUserById(ids[0]);
    if (account.error || !account.data.user?.email || account.data.user.app_metadata?.tammeni_role) {
      return Response.json({ error: "حساب ولي الأمر التجريبي غير متاح." }, { status: 503 });
    }
    const generated = await admin.auth.admin.generateLink({ type: "magiclink", email: account.data.user.email });
    if (generated.error || !generated.data.properties?.hashed_token || generated.data.user?.id !== ids[0]) {
      return Response.json({ error: "تعذّر فتح تجربة ولي الأمر. حاول مجددًا." }, { status: 502 });
    }
    const parent = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const verified = await parent.auth.verifyOtp({ type: "magiclink", token_hash: generated.data.properties.hashed_token });
    if (verified.error || !verified.data.session || verified.data.user?.id !== ids[0]) {
      return Response.json({ error: "تعذّر فتح تجربة ولي الأمر. حاول مجددًا." }, { status: 502 });
    }
    return Response.json({ access_token: verified.data.session.access_token, refresh_token: verified.data.session.refresh_token }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!url || !key || !email || !password) {
    return Response.json({ error: "الدخول التجريبي غير مُعدّ على الخادم." }, { status: 503 });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return Response.json({ error: "تعذّر بدء الدخول التجريبي. حاول مرة أخرى." }, { status: 502 });
  }
  if (data.user.app_metadata?.tammeni_role) {
    // Misconfiguration guard: the demo parent must never carry an operator role.
    return Response.json({ error: "إعداد حساب ولي الأمر التجريبي غير صحيح." }, { status: 500 });
  }
  return Response.json(
    { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
