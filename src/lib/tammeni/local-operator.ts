// Local demo shortcut: /demo-control may sign the operator in without the form, from the server, using
// TAMMENI_DEMO_OPERATOR_* in .env.local. It is allowed only when every check below passes:
//
// - TAMMENI_LOCAL_OPERATOR=1 is set explicitly (off by default);
// - the server is `next dev` (NODE_ENV "development"), never a build started with `next start` or a deploy;
// - the request reached `next dev` straight from this machine. Next only fills X-Forwarded-For/-Host/-Proto
//   when they are missing, so a tunnel such as ngrok leaves the visitor's IP, its own host and https in them,
//   and a visitor on the local network shows a LAN address. Host, X-Forwarded-Host and X-Forwarded-For must
//   all be loopback and the scheme plain http;
// - for the sign-in itself, the request comes from a page on the same local origin.
//
// Anyone else gets the normal operator form, and the operator API still answers 401/403 as before. The
// session is the real operator account's, in its own cookie; RLS in the database is unchanged.
//
// Pure (no server-only import) so the checks can be tested directly; only server code calls it.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
// Set by other proxies and CDNs. Their presence alone means the request did not come straight from here.
const PROXY_HEADERS = ["forwarded", "x-real-ip", "cf-connecting-ip", "true-client-ip", "x-original-host"];

type Env = Record<string, string | undefined>;

function hostname(value: string | null) {
  if (!value || value.includes(",")) return null;
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return null;
  }
}

/** Why the local shortcut is refused for this request, or null when it is allowed. */
export function localOperatorRefusal(env: Env, headers: Headers, opts: { signIn?: boolean } = {}): string | null {
  if (env.TAMMENI_LOCAL_OPERATOR !== "1") return "off";
  if (env.NODE_ENV !== "development") return "not-dev-server";
  if (env.VERCEL) return "hosted";

  const host = hostname(headers.get("host"));
  if (!host || !LOOPBACK_HOSTS.has(host)) return "host";
  const forwardedHost = hostname(headers.get("x-forwarded-host"));
  if (!forwardedHost || !LOOPBACK_HOSTS.has(forwardedHost)) return "forwarded-host";
  const forwardedFor = (headers.get("x-forwarded-for") ?? "").split(",").map((ip) => ip.trim());
  if (!forwardedFor.every((ip) => LOOPBACK_IPS.has(ip))) return "forwarded-for";
  if ((headers.get("x-forwarded-proto") ?? "http") !== "http") return "forwarded-proto";
  if (PROXY_HEADERS.some((h) => headers.has(h))) return "proxy";

  if (opts.signIn) {
    const origin = headers.get("origin");
    let originUrl: URL | null = null;
    try {
      originUrl = origin ? new URL(origin) : null;
    } catch {}
    if (!originUrl || originUrl.host !== headers.get("host") || !LOOPBACK_HOSTS.has(originUrl.hostname)) return "origin";
    const site = headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return "origin";
  }
  return null;
}

export const localOperatorAllowed = (env: Env, headers: Headers, opts?: { signIn?: boolean }) => localOperatorRefusal(env, headers, opts) === null;
