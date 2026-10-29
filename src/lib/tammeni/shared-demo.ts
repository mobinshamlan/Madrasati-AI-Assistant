// Shared demo shortcut for teammates on the demo URL (including a tunnel such as ngrok).
// TAMMENI_SHARED_DEMO=1 must be set on the server. Off unless it is exactly "1".
//
// When it is on, /demo-control may sign the existing operator account in without a password form.
// The password stays in server env. The session uses the operator cookie, never the parent's.
// A sign-in POST is accepted only from a page on the same host (blocks another site from starting it).
// There is no loopback requirement: that is what distinguishes this from TAMMENI_LOCAL_OPERATOR.
//
// Automatic sessions are mock-only. A password sign-in clears that restriction and keeps the
// provider configured on the Python backend (mock by default, Twilio only when set up on purpose).
//
// Pure (no server-only import) so the checks can be tested directly.

type Env = Record<string, string | undefined>;

export function sharedDemoEnabled(env: Env) {
  return env.TAMMENI_SHARED_DEMO === "1";
}

/** Why automatic shared sign-in is refused, or null when this request may use it. */
export function sharedDemoRefusal(env: Env, headers: Headers, opts: { signIn?: boolean } = {}): string | null {
  if (!sharedDemoEnabled(env)) return "off";
  if (!opts.signIn) return null;

  const host = headers.get("host");
  const origin = headers.get("origin");
  if (!host || host.includes(",") || !origin) return "origin";
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return "origin";
  }
  if (originUrl.host !== host) return "origin";
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return "origin";
  return null;
}

export const sharedDemoSignInAllowed = (env: Env, headers: Headers) => sharedDemoRefusal(env, headers, { signIn: true }) === null;

/** Automatic shared access never selects the real provider. Password sessions use the server setting. */
export function dispatchModeForSession(sharedAutomatic: boolean): "mock" | "configured" {
  return sharedAutomatic ? "mock" : "configured";
}
