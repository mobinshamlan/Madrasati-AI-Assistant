// Checks the demo roles against the real Supabase project with the publishable key and the two demo
// accounts from .env.local. Prints results only, never credentials. Writes nothing that persists:
// the denied inserts fail, and the user-metadata probe is reverted.
//   node --env-file=.env.local scripts/verify-supabase-roles.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const mk = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let pass = 0, fail = 0;
const check = (n, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(ok ? "PASS" : "FAIL", n, ok ? "" : "=> " + JSON.stringify(got));
};
const parent = mk(), operator = mk(), anon = mk();
const p = await parent.auth.signInWithPassword({ email: process.env.TAMMENI_DEMO_PARENT_EMAIL, password: process.env.TAMMENI_DEMO_PARENT_PASSWORD });
check("parent signs in", !!p.data.session && !p.error, true);
const o = await operator.auth.signInWithPassword({ email: process.env.TAMMENI_DEMO_OPERATOR_EMAIL, password: process.env.TAMMENI_DEMO_OPERATOR_PASSWORD });
check("operator signs in; role in app_metadata", [!!o.data.session, o.data.user?.app_metadata?.tammeni_role], [true, "demo_operator"]);
const wrong = await mk().auth.signInWithPassword({ email: process.env.TAMMENI_DEMO_PARENT_EMAIL, password: "wrong-password-123" });
check("wrong password rejected", !!wrong.error, true);
check("parent sees ريم and أحمد only", ((await parent.from("students").select("demo_key").order("demo_key")).data ?? []).map((s) => s.demo_key), ["ahmad", "sama"]);
check("operator sees the 4 demo students", ((await operator.from("students").select("demo_key")).data ?? []).length, 4);
check("anon sees no students", ((await anon.from("students").select("demo_key")).data ?? []).length, 0);
const sama = (await operator.from("students").select("id").eq("demo_key", "sama").single()).data.id;
const faisal = (await operator.from("students").select("id").eq("demo_key", "faisal").single()).data.id;
const pe = await parent.from("demo_events").insert({ student_id: sama, kind: "attendance", event_date: "2026-10-29", summary: "x", idempotency_key: "rls-parent-attempt-1" });
check("parent cannot record an event (direct request)", !!pe.error, true);
check("parent cannot read faisal's grades", ((await parent.from("grades").select("id").eq("student_id", faisal)).data ?? []).length, 0);
check("parent reads ريم's grades", ((await parent.from("grades").select("id").eq("student_id", sama)).data ?? []).length, 5);
const pf = await parent.from("assistant_preferences").insert({ student_id: faisal });
check("parent cannot save preferences for فيصل", !!pf.error, true);
const sp = await operator.from("demo_source_records").select("source_key");
check("operator cannot read the raw source", !!sp.error, true);
// Users cannot grant themselves the operator role: user metadata is not app_metadata.
await parent.auth.updateUser({ data: { tammeni_role: "demo_operator" } });
await parent.auth.refreshSession();
const pe2 = await parent.from("demo_events").insert({ student_id: sama, kind: "attendance", event_date: "2026-10-29", summary: "x", idempotency_key: "rls-parent-attempt-2" });
check("parent setting user_metadata.tammeni_role gains nothing", !!pe2.error, true);
await parent.auth.updateUser({ data: { tammeni_role: null } });
console.log(`\n${pass} passed, ${fail} failed (real Supabase, publishable key, real Auth users)`);
