"use client";

import Link from "next/link";
import { TammeniExperience } from "@/components/brand/experience";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TammeniMark } from "@/components/brand/mark";
import { isLeavingOnPurpose, useDemoSession } from "@/lib/demo-session";
import { InfoIcon } from "./icons";
import { BrandHeader, SiteHeader, type PageKey } from "./site-header";
import { TourBar } from "./tour-bar";

/** Pages behind the demo entry. Without a demo session they send the visitor to /welcome, then on to /login and back. */
export function PageShell({ current, children }: { current: PageKey; children: React.ReactNode }) {
  return (
    <TammeniExperience>
      <DemoSessionGate>
        <SiteHeader current={current} />
        <TourBar />
        {children}
      </DemoSessionGate>
      <Footer />
      {/* Room for the bottom bar on phones, so it never covers the footer. */}
      <div className={`on-board h-16 sm:hidden ${current === "assistant" ? "hidden" : ""}`} aria-hidden="true" />
    </TammeniExperience>
  );
}

/** The login page: the same notice, logo bar and footer, without the signed-in navigation. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <TammeniExperience>
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
          جارٍ فتح طمّنـــي…
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
    <p role="note" className="flex items-center justify-center gap-1.5 whitespace-nowrap bg-board-hover px-2 py-1.5 text-center text-[clamp(0.625rem,3.3vw,0.8125rem)] leading-6 text-chalk-soft sm:gap-2 sm:px-4">
      <InfoIcon size={16} className="shrink-0" />
      نسخة تجريبية ببيانات وهمية — غير تابعة لمنصة مدرستي الرسمية
    </p>
  );
}

export function Footer({ className = "" }: { className?: string }) {
  return (
    <footer className={`on-board mt-auto ${className}`}>
      <div className="mx-auto max-w-[1100px] px-4 pt-10 pb-8 sm:px-6">
        <p className="flex items-center gap-2.5 font-display text-[1.375rem] font-semibold">
          <TammeniMark size={50} />
          <span translate="no">طمّنـــي</span>
        </p>
        <p className="mt-3 font-display text-[1.25rem] leading-snug font-medium text-chalk">أخبار عيالك من المدرسة، توصلك.</p>
        <div className="perforation mt-7 text-chalk" aria-hidden="true" />
        <p className="mt-5 text-[0.875rem] leading-7 text-chalk-soft">
          نموذج تجريبي ببيانات وهمية. غير تابع لمنصة مدرستي، ولا يمثل خدمة صادرة عن وزارة التعليم.
        </p>
      </div>
    </footer>
  );
}
