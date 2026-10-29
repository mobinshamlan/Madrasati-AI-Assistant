"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { safeReturnPath, startDemoSession } from "@/lib/demo-session";
import "./welcome.css";

const primaryClass =
  "inline-flex min-h-14 w-full cursor-pointer items-center justify-center rounded-lg bg-brand-600 px-10 text-xl font-bold text-white transition-colors hover:bg-brand-700 sm:w-auto aria-disabled:cursor-wait aria-disabled:bg-brand-700";
const label = "ابدأ مع طمّني";
const note = "تجربة ببيانات خيالية، دون إنشاء حساب.";

/**
 * One action on the existing demo entry (one fictional parent, no password). It opens the parent
 * dashboard, where the parent chooses a child before setting up the assistant; a safe local `next`
 * from a direct link (with its student) wins instead.
 */
export function WelcomeActions() {
  const router = useRouter();
  const requested = useSearchParams().get("next");
  const next = requested ? safeReturnPath(requested) : "/";
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
      {/* aria-disabled rather than disabled, so focus stays on the button while the page opens. */}
      <button type="button" onClick={start} aria-disabled={starting || undefined} className={primaryClass}>
        {starting ? "جارٍ فتح طمّني…" : label}
      </button>
      <p role="status" className="sr-only">
        {starting ? "جارٍ فتح طمّني" : ""}
      </p>
      <p className="mt-4 text-base leading-7 text-ink">{note}</p>
      {failed && (
        <p role="alert" className="mt-4 rounded-xl border-2 border-[#fecdca] bg-[#fef3f2] p-4 font-bold text-[#b42318]">
          تعذّر بدء الدخول التجريبي. تأكد من اتصالك بالإنترنت، ثم حاول مرة أخرى.
        </p>
      )}
    </div>
  );
}

/** Shown before the script runs (and without it): the existing login page, which leads to the dashboard. */
export function WelcomeActionsFallback() {
  return (
    <div className="welcome-rise welcome-after3 mt-8">
      <Link href="/login" className={primaryClass}>
        {label}
      </Link>
      <p className="mt-4 text-base leading-7 text-ink">{note}</p>
    </div>
  );
}
