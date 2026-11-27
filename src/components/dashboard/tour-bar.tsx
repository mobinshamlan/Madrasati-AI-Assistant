"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { students } from "./data";
import { SignOut } from "./sign-out";

// The visitor plays a parent for a short tour. The bar says who they are and where they are in three steps.
// Names come from the bundled copy of the two fictional children, so the bar needs no request.

const TOTAL = 3;

function stepIndex(pathname: string): number {
  if (pathname.startsWith("/assistant/confirmation")) return 2;
  if (pathname.startsWith("/assistant")) return 1;
  if (pathname === "/tammeni") return 0;
  return -1;
}

function Bar() {
  const pathname = usePathname();
  const studentId = useSearchParams().get("student");
  const child = students.find((s) => s.id === studentId) ?? students[0];
  const index = stepIndex(pathname);
  if (index < 0) return null;

  const copy = [
    `تصفّح أخبار ${child.firstName}: الحضور والاختبارات والدرجات. بعدها اضبط تنبيهاتك.`,
    `اختر وش يوصلك عن ${child.firstName}، ومتى، وكيف.`,
    "هذا ملخص اختياراتك. تقدر ترجع وتعدّلها متى ما أردت.",
  ];

  return (
    <div role="region" aria-label="الجولة التجريبية" className="bg-bell-soft">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-2.5 gap-y-1.5 px-4 py-2 text-[0.875rem] leading-6 text-ink sm:gap-x-5 sm:px-6 sm:py-2.5 sm:text-[0.9375rem] sm:leading-7">
        <p className="font-bold max-[359px]:text-[0.75rem]">خذ جولة وكأنك ولي أمر {child.firstName}</p>
        <p className="hidden min-w-[15rem] flex-1 sm:block">
          <span className="font-semibold">الخطوة {index + 1} من {TOTAL}:</span> {copy[index]}
        </p>
        <p className="ms-auto text-[0.8125rem] font-semibold sm:hidden">
          {index + 1} من {TOTAL}
        </p>
        <SignOut className="!min-h-9 !gap-1.5 !px-3 !text-[0.8125rem] max-[359px]:!px-2 max-[359px]:!text-[0.75rem] sm:!hidden" />
        <ol className="flex w-full gap-1.5 sm:w-auto" aria-hidden="true">
          {Array.from({ length: TOTAL }, (_, i) => (
            <li key={i} className="h-1 flex-1 rounded-full sm:h-1.5 sm:w-8 sm:flex-none" style={{ background: i <= index ? "var(--color-board)" : "var(--color-surface)" }} />
          ))}
        </ol>
      </div>
    </div>
  );
}

export function TourBar() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
