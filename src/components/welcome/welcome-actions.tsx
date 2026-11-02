"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { safeReturnPath, startDemoSession } from "@/lib/demo-session";
import "./welcome.css";

const primaryClass = "btn-primary min-h-14 w-full px-9 text-[1.0625rem] sm:w-auto";
const label = "ابدأ التجربة";
const note = "تدخل كولي أمر تجريبي ببيانات خيالية، بدون حساب ولا كلمة مرور.";

/**
 * One action on the existing demo entry (one fictional parent, no password). It opens the parent
 * dashboard, where the parent chooses a child before setting up the assistant; a safe local `next`
 * from a direct link (with its student) wins instead.
 */
export function WelcomeActions() {
  const router = useRouter();
  const requested = useSearchParams().get("next");
  const next = requested ? safeReturnPath(requested) : "/tammeni";
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

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
    <div className="welcome-rise welcome-after3 mt-8">
      {/* aria-busy rather than disabled, so focus stays on the button while the page opens. */}
      <button type="button" onClick={start} aria-busy={starting || undefined} className={primaryClass}>
        {starting && <span className="spinner" aria-hidden="true" />}
        {starting ? "جارٍ فتح طمّني…" : label}
      </button>
      <p role="status" className="sr-only">
        {starting ? "جارٍ فتح طمّني" : ""}
      </p>
      <p className="mt-3 text-[0.9375rem] leading-7 text-faint">{note}</p>
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
    <div className="welcome-rise welcome-after3 mt-8">
      <Link href="/login?next=%2Ftammeni" className={primaryClass}>
        {label}
      </Link>
      <p className="mt-3 text-[0.9375rem] leading-7 text-faint">{note}</p>
    </div>
  );
}
