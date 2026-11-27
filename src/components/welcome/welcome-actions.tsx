"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { safeReturnPath, startDemoSession } from "@/lib/demo-session";
import "./welcome.css";

const primaryClass = "btn-primary min-h-14 w-full px-6 text-[1.0625rem] sm:w-auto sm:px-9";
const label = "جرّب بنفسك: خذ جولة كولي أمر";
const note = "تدخل كولي أمر تجريبي ببيانات وهمية، بدون حساب ولا كلمة مرور.";

/**
 * One action on the existing demo entry (one fictional parent, no password). It opens the parent
 * dashboard, where the parent chooses a child before setting up the assistant; a safe local `next`
 * from a direct link (with its student) wins instead.
 */
export function WelcomeActions() {
  const router = useRouter();
  const requested = useSearchParams().get("next");
  // The tour opens as the parent of سما.
  const next = requested ? safeReturnPath(requested).replace(/^\/(?=\?|$)/, "/tammeni") : "/tammeni?student=sama";
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  // The tour's first page is fetched while the visitor reads, so only the sign-in is left to wait for.
  // Nothing is signed in until the button is pressed.
  useEffect(() => router.prefetch(next), [router, next]);

  // Next.js keeps this page mounted (hidden) after leaving it; reset so Back never shows it stuck.
  useLayoutEffect(() => () => setStarting(false), []);

  const start = async () => {
    if (starting) return;
    setFailed(false);
    setStarting(true);
    if (await startDemoSession()) {
      router.push(next);
    } else {
      setStarting(false);
      setFailed(true);
    }
  };

  return (
    <div className="mt-7 flex w-full flex-col items-center">
      {/* aria-busy rather than disabled, so focus stays on the button while the page opens. */}
      <button type="button" onClick={start} aria-busy={starting || undefined} className={primaryClass}>
        {starting && <span className="spinner" aria-hidden="true" />}
        {starting ? "جارٍ فتح طمّنـــي…" : label}
      </button>
      <p role="status" className="sr-only">
        {starting ? "جارٍ فتح طمّنـــي" : ""}
      </p>
      <p className="mt-4 max-w-[34ch] text-[0.9375rem] leading-7 text-ink-soft">{note}</p>
      {failed && (
        <p role="alert" className="notice notice-danger mt-4 max-w-md">
          تعذّر بدء الدخول التجريبي. تأكد من اتصالك بالإنترنت، ثم جرّب مرة ثانية.
        </p>
      )}
    </div>
  );
}

/** Shown before the script runs (and without it): the existing login page, which leads to the dashboard. */
export function WelcomeActionsFallback() {
  return (
    <div className="mt-7 flex w-full flex-col items-center">
      <Link href="/login?next=%2Ftammeni%3Fstudent%3Dsama" className={primaryClass}>
        {label}
      </Link>
      <p className="mt-4 max-w-[34ch] text-[0.9375rem] leading-7 text-ink-soft">{note}</p>
    </div>
  );
}
