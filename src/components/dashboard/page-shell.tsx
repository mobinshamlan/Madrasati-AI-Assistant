"use client";

import { ComingSoonProvider, useComingSoon } from "./coming-soon";
import { AccessibilityIcon, InfoIcon } from "./icons";
import { SiteHeader, type HeaderVariant, type PageKey } from "./site-header";

export function PageShell({
  current,
  variant = "parent",
  children,
}: {
  current: PageKey;
  variant?: HeaderVariant;
  children: React.ReactNode;
}) {
  return (
    <ComingSoonProvider>
      <DemoNotice />
      <SiteHeader current={current} variant={variant} />
      {children}
      <footer className="mt-auto border-t border-mint-300 bg-mint-100 px-4 py-4 text-center text-sm text-ink-soft">
        نموذج تعليمي تجريبي ببيانات خيالية — غير تابع لمنصة مدرستي الرسمية ولا يمثل خدمة صادرة عن وزارة التعليم.
      </footer>
      <AccessibilityButton />
    </ComingSoonProvider>
  );
}

function DemoNotice() {
  return (
    <p
      role="note"
      className="flex items-center justify-center gap-2 bg-[#fffaeb] px-4 py-2 text-center text-sm font-bold text-[#7a2e0e] border-b border-[#fedf89]"
    >
      <InfoIcon size={18} className="shrink-0" />
      نموذج تعليمي تجريبي ببيانات خيالية — غير تابع لمنصة مدرستي الرسمية
    </p>
  );
}

function AccessibilityButton() {
  const openComingSoon = useComingSoon();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label="أدوات إمكانية الوصول"
      onClick={() => openComingSoon({ title: "إمكانية الوصول", description: "أدوات التخصيص وإمكانية الوصول ستتوفر قريبًا." })}
      className="fixed bottom-4 left-4 z-20 hidden size-12 place-items-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 lg:grid"
    >
      <AccessibilityIcon size={26} />
    </button>
  );
}
