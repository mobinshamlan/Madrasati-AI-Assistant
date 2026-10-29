import "server-only";

import { cookies } from "next/headers";

/** Set only when this operator session was opened by the shared-demo shortcut, not by a password. */
export const SHARED_DISPATCH_COOKIE = "tammeni-shared-dispatch";

const options = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
});

export async function markSharedDispatch() {
  const store = await cookies();
  store.set(SHARED_DISPATCH_COOKIE, "1", options());
}

export async function clearSharedDispatch() {
  const store = await cookies();
  store.delete(SHARED_DISPATCH_COOKIE);
}

export async function isSharedDispatch() {
  const store = await cookies();
  return store.get(SHARED_DISPATCH_COOKIE)?.value === "1";
}
