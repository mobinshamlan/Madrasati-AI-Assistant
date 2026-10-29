"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * The parent's browser client. The session lives in cookies set by the server's demo entry, so the
 * server and the browser see the same signed-in parent. Access is enforced by RLS, not by this client.
 */
export function getParentClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Add the Supabase URL and publishable key to .env.local, then restart Next.js.");
  if (key.startsWith("sb_secret_")) throw new Error("Use a publishable key for the browser, never a secret key.");
  client = createBrowserClient(url, key);
  return client;
}
