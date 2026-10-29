import { localOperatorAllowed } from "@/lib/tammeni/local-operator";
import { isOperator, operatorServerClient, verifiedUser } from "@/lib/supabase/server";

/** Operator sign-in with a real Supabase Auth account. Only accounts whose app_metadata grants the role pass. */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "تعذّرت قراءة الطلب." }, { status: 400 });
  }
  if (typeof body.email !== "string" || typeof body.password !== "string" || !body.email || !body.password) {
    return Response.json({ error: "اكتب البريد وكلمة المرور." }, { status: 400 });
  }
  const supabase = await operatorServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: body.email.trim(), password: body.password });
  if (error || !data.user) return Response.json({ error: "البريد أو كلمة المرور غير صحيحة." }, { status: 401 });
  if (!isOperator(data.user)) {
    await supabase.auth.signOut({ scope: "local" });
    return Response.json({ error: "هذا الحساب لا يملك صلاحية تشغيل الديمو." }, { status: 403 });
  }
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const supabase = await operatorServerClient();
  const user = await verifiedUser(supabase);
  // `local`: this request may use the local demo sign-in (session/local). False for any tunnel or deploy.
  return Response.json({ signedIn: isOperator(user), local: localOperatorAllowed(process.env, request.headers) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  const supabase = await operatorServerClient();
  await supabase.auth.signOut({ scope: "local" });
  return Response.json({ ok: true });
}
