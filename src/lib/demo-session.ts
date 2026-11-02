"use client";

import { useSyncExternalStore } from "react";
import { getParentClient } from "@/lib/supabase/browser";

// The demo parent's session is a real Supabase Auth session for one fictional parent account, kept in
// cookies. «ابدأ مع طمّني» / «دخول» ask the server to sign that account in (its password stays on the
// server). What the parent can read or change is enforced by RLS in the database, not by this module.
//
// The earlier browser-only marker (localStorage "madrasati-demo:session:v1") is no longer read; it is
// left in place untouched.

export type DemoSessionStatus = "checking" | "signed-in" | "signed-out";

let status: DemoSessionStatus = "checking";
const listeners = new Set<() => void>();
let watching = false;

function set(next: DemoSessionStatus) {
  if (next === status) return;
  status = next;
  for (const l of listeners) l();
}

function watch() {
  if (watching) return;
  watching = true;
  const supabase = getParentClient();
  // getSession reads the cookie for the page's state only; every data request is checked by RLS.
  supabase.auth.getSession().then(({ data }) => set(data.session ? "signed-in" : "signed-out"));
  supabase.auth.onAuthStateChange((_event, session) => set(session ? "signed-in" : "signed-out"));
}

function subscribe(onChange: () => void) {
  watch();
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** "checking" during the server render and hydration, then the session state. */
export function useDemoSession(): DemoSessionStatus {
  return useSyncExternalStore(subscribe, () => status, () => "checking");
}

// Set when the parent chooses to leave, so the next page opens the login without asking to come back.
let leftOnPurpose = false;
export const isLeavingOnPurpose = () => leftOnPurpose;

/** Signs the demo parent account in. False when the server or Supabase cannot start the session. */
export async function startDemoSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/demo/parent-session", { method: "POST", cache: "no-store" });
    if (!response.ok) return false;
    const tokens = (await response.json()) as { access_token?: string; refresh_token?: string };
    if (!tokens.access_token || !tokens.refresh_token) return false;
    const { error } = await getParentClient().auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
    if (error) return false;
  } catch {
    return false;
  }
  leftOnPurpose = false;
  set("signed-in");
  return true;
}

/** Signs out in this browser only; other open demo sessions stay. Saved preferences are untouched. */
export async function endDemoSession() {
  leftOnPurpose = true;
  try {
    await getParentClient().auth.signOut({ scope: "local" });
  } catch {
    // Nothing to sign out of.
  }
  set("signed-out");
}

/** Pages a "next" link may return to after entry. Anything else falls back to the home page. */
const RETURN_PATHS = new Set(["/", "/tammeni", "/assistant", "/assistant/confirmation"]);

export function safeReturnPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  try {
    const url = new URL(next, "http://prototype.local");
    if (url.origin !== "http://prototype.local" || !RETURN_PATHS.has(url.pathname)) return "/";
    const student = url.searchParams.get("student");
    return student ? `${url.pathname}?student=${encodeURIComponent(student)}` : url.pathname;
  } catch {
    return "/";
  }
}
