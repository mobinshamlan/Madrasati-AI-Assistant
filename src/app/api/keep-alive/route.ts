import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";

/**
 * A daily visit to the database (scheduled in vercel.json). Supabase pauses a free project after a week
 * with little use, which would stop the demo's tour. This signs in the demo parent, reads that parent's
 * own children and signs out again. It changes no records, and its reply carries no data and no tokens.
 */
export async function GET() {
  // Run on every visit; never answered from a copy made at build time.
  await connection();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.TAMMENI_DEMO_PARENT_EMAIL;
  const password = process.env.TAMMENI_DEMO_PARENT_PASSWORD;
  const reply = (ok: boolean, status: number) => Response.json({ ok }, { status, headers: { "Cache-Control": "no-store" } });
  if (!url || !key || !email || !password) return reply(false, 503);

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) return reply(false, 502);
  const read = await supabase.from("students").select("id").limit(2);
  await supabase.auth.signOut({ scope: "local" });
  // A failed visit answers with an error, so it shows as failed in Vercel's logs.
  return read.error || !read.data?.length ? reply(false, 502) : reply(true, 200);
}
