import { createClient } from "@supabase/supabase-js";

/**
 * Demo entry: signs in the one fictional parent account and hands its session to the browser.
 * The password never leaves the server. This is a deliberate demo shortcut: anyone using the demo
 * becomes that same fictional parent, who can read and change only ريم and نواف (enforced by RLS).
 * It grants no operator rights.
 */
export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.TAMMENI_DEMO_PARENT_EMAIL;
  const password = process.env.TAMMENI_DEMO_PARENT_PASSWORD;
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
