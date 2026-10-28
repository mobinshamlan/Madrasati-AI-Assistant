import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/** Connection only. Authentication and database access policies are configured separately. */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Add the Supabase URL and publishable key to .env.local, then restart Next.js.");
  }
  if (key.startsWith("sb_secret_")) {
    throw new Error("Use a publishable key for the browser, never a secret key.");
  }
  client = createClient(url, key);
  return client;
}
