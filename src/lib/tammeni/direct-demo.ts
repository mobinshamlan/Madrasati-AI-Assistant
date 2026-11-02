// Direct database access is for this laptop's fictional demo, not a public admin API.
export function directDemoAllowed(env: Record<string, string | undefined>, headers: Headers) {
  if (env.NODE_ENV !== "development" || env.VERCEL) return false;
  const local = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const host = headers.get("host");
  try {
    if (!host || !local.has(new URL(`http://${host}`).hostname)) return false;
    const forwarded = headers.get("x-forwarded-host");
    if (forwarded && forwarded !== host) return false;
    if ((headers.get("x-forwarded-for") ?? "127.0.0.1").split(",").some(x => !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(x.trim()))) return false;
    if (["forwarded", "x-real-ip", "cf-connecting-ip", "x-original-host"].some(x => headers.has(x))) return false;
    if ((headers.get("x-forwarded-proto") ?? "http") !== "http") return false;
    const origin = headers.get("origin");
    if (origin && new URL(origin).host !== host) return false;
    if (["cross-site", "same-site"].includes(headers.get("sec-fetch-site") ?? "")) return false;
    return true;
  } catch { return false; }
}
