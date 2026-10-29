import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** The operator's session uses its own cookie, so it never mixes with the parent's in one browser. */
export const OPERATOR_COOKIE = "tammeni-operator";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return { url, key };
}

async function make(cookieName?: string): Promise<SupabaseClient> {
  const { url, key } = env();
  const store = await cookies();
  return createServerClient(url, key, {
    ...(cookieName ? { cookieOptions: { name: cookieName, sameSite: "lax", secure: process.env.NODE_ENV === "production" } } : {}),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Route handlers can write cookies; elsewhere this throws and the browser refreshes instead.
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {}
      },
    },
  });
}

/** Acts as the signed-in parent (default Supabase cookie). */
export const parentServerClient = () => make();
/** Acts as the signed-in demo operator (separate cookie). */
export const operatorServerClient = () => make(OPERATOR_COOKIE);

/** The verified user behind a client, checked with Supabase Auth (not just decoded from the cookie). */
export async function verifiedUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export const isOperator = (user: { app_metadata?: Record<string, unknown> } | null) =>
  user?.app_metadata?.tammeni_role === "demo_operator";
