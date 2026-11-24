"use client";

import Link from "next/link";
import { TammeniExperience } from "@/components/brand/experience";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TammeniMark } from "@/components/brand/mark";
import { isLeavingOnPurpose, useDemoSession } from "@/lib/demo-session";
import { InfoIcon } from "./icons";
import { BrandHeader, SiteHeader, type PageKey } from "./site-header";

/** Pages behind the demo entry. Without a demo session they send the visitor to /welcome, then on to /login and back. */
export function PageShell({ current, children }: { current: PageKey; children: React.ReactNode }) {
  return (
    <TammeniExperience>
      <DemoNotice />
      <DemoSessionGate>
        <SiteHeader current={current} />
        {children}
      </DemoSessionGate>
      <Footer />
    </TammeniExperience>
  );
}

/** The login page: the same notice, logo bar and footer, without the signed-in navigation. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <TammeniExperience>
      <DemoNotice />
      <BrandHeader />
      {children}
      <Footer />
    </TammeniExperience>
  );
}

function DemoSessionGate({ children }: { children: React.ReactNode }) {
  const status = useDemoSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "signed-out") return;
    // A first visit meets the welcome page and comes back to the same page (and student) after entry.
    // A parent who chose to leave goes back to the welcome page.
    const here = `${window.location.pathname}${window.location.search}`;
    if (isLeavingOnPurpose()) router.replace("/welcome");
    else router.replace(here === "/" ? "/welcome" : `/welcome?next=${encodeURIComponent(here)}`);
  }, [status, router]);

  if (status === "signed-in") return children;
  return (
    <main id="main" className="grid flex-1 place-items-center px-4 py-20">
      {status === "checking" ? (
        <p role="status" className="flex items-center gap-3 text-ink-soft">
          <span className="spinner text-brand" aria-hidden="true" />
          جارٍ فتح طمّني…
        </p>
      ) : (
        <p role="status" className="max-w-md text-center text-ink">
          هذي الصفحة تحتاج الدخول التجريبي أولًا.{" "}
          <Link href="/login" className="link">
            الدخول التجريبي
          </Link>
        </p>
      )}
    </main>
  );
}

/** Always visible: this is a prototype with fictional data, not the official platform. */
export function DemoNotice() {
  return (
    <p role="note" className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-center text-[0.8125rem] leading-6 text-white">
      <InfoIcon size={16} className="shrink-0" />
      نسخة تجريبية ببيانات خيالية — غير تابعة لمنصة مدرستي الرسمية
    </p>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-4 py-6 text-[0.875rem] leading-6 text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="inline-flex items-center gap-2 font-semibold text-ink">
          <TammeniMark size={22} />
          طمّني
        </span>
        <p>نموذج تعليمي تجريبي ببيانات خيالية. غير تابع لمنصة مدرستي، ولا يمثل خدمة صادرة عن وزارة التعليم.</p>
      </div>
    </footer>
  );
}
