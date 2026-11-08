import { createHash, timingSafeEqual } from "node:crypto";

// Server code only: used by src/proxy.ts and operator.ts. It takes env and headers as arguments
// (no "server-only" import) so `node --test` can load it; node:crypto keeps it out of client bundles.

const OPERATOR_USERNAME = "operator";

// Hashing first gives equal-length buffers, so neither content nor length leaks through timing.
const sameText = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** HTTP Basic check for the operator. Fails closed when TAMMENI_OPERATOR_PASSWORD is unset or empty. */
export function operatorCredentialsValid(env: Record<string, string | undefined>, authorization: string | null) {
  const expected = env.TAMMENI_OPERATOR_PASSWORD;
  if (!expected || !authorization) return false;
  const encoded = /^Basic +([A-Za-z0-9+/]+={0,2})$/i.exec(authorization.trim())?.[1];
  if (!encoded) return false;
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  const usernameMatches = sameText(decoded.slice(0, separator), OPERATOR_USERNAME);
  const passwordMatches = sameText(decoded.slice(separator + 1), expected);
  return usernameMatches && passwordMatches;
}

/** Browsers attach Basic credentials automatically, so writes from another site must be refused. */
export function crossOriginWriteRefused(method: string, headers: Headers) {
  if (method === "GET" || method === "HEAD") return false;
  if (["cross-site", "same-site"].includes(headers.get("sec-fetch-site") ?? "")) return true;
  const origin = headers.get("origin");
  if (origin === null) return false;
  try {
    return new URL(origin).host.toLowerCase() !== (headers.get("host") ?? "").toLowerCase();
  } catch {
    return true; // Includes `Origin: null` from sandboxed pages.
  }
}
