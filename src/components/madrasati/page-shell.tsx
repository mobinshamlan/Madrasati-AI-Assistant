"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isLeavingOnPurpose, useDemoSession } from "@/lib/demo-session";
import { ComingSoonProvider, useComingSoon } from "./coming-soon";
import { AccessibilityIcon, InfoIcon } from "@/components/dashboard/icons";
import { BrandHeader, SiteHeader, type PageKey } from "./site-header";

/** Pages behind the demo entry. Without a demo session they send the visitor to /welcome, then on to /login and back. */
export function PageShell({ current, children }: { current: PageKey; children: React.ReactNode }) {
  return (
    <ComingSoonProvider>
      <DemoNotice />
      <DemoSessionGate>
        <SiteHeader current={current} />
        {children}
        <AccessibilityButton />
      </DemoSessionGate>
      <Footer />
    </ComingSoonProvider>
  );
}

/** The login page: the same notice, logo bar and footer, without the signed-in navigation. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoNotice />
      <BrandHeader />
      {children}
      <Footer />
    </>
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
    <main id="main" className="flex-1 px-4 py-16 text-center text-lg">
      {status === "checking" ? (
        <p role="status" className="text-ink-soft">
          جارٍ فتح الصفحة…
        </p>
      ) : (
        <p role="status" className="text-ink">
          هذه الصفحة تحتاج إلى الدخول التجريبي أولًا.{" "}
          <Link href="/login" className="font-bold text-brand-700 underline underline-offset-4">
            الانتقال إلى الدخول التجريبي
          </Link>
        </p>
      )}
    </main>
  );
}

export function DemoNotice() {
  return (
    <p
      role="note"
      className="flex items-center justify-center gap-2 border-b-2 border-warn-line bg-warn-bg px-4 py-3 text-center text-base font-bold text-warn"
    >
      <InfoIcon size={20} className="shrink-0" />
      نموذج تجريبي ببيانات وهمية — غير تابع لمنصة مدرستي الرسمية
    </p>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-mint-300 bg-mint-100 px-4 py-5 text-center text-base text-ink">
      <p className="tammeni-mark mb-1 text-xl">طمّنـــي</p>
      نموذج تجريبي ببيانات وهمية. غير تابع لمنصة مدرستي، ولا يمثل خدمة صادرة عن وزارة التعليم.
    </footer>
  );
}

function AccessibilityButton() {
  const openComingSoon = useComingSoon();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label="أدوات إمكانية الوصول — غير متوفرة بعد في هذه النسخة"
      onClick={() =>
        openComingSoon({
          title: "إمكانية الوصول",
          description: "هذه الأداة غير جاهزة بعد. حجم الخط والتباين مضبوطان من الصفحة نفسها؛ أدوات التخصيص ستتوفر لاحقًا.",
        })
      }
      className="fixed bottom-4 left-4 z-20 hidden size-14 cursor-pointer place-items-center rounded-full bg-brand-600 text-white hover:bg-brand-700 lg:grid"
    >
      <AccessibilityIcon size={26} />
    </button>
  );
}
