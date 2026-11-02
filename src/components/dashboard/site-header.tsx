"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Wordmark } from "@/components/brand/mark";
import { endDemoSession } from "@/lib/demo-session";
import { parent } from "./data";
import { HomeIcon, LogoutIcon, SparkleIcon } from "./icons";

export type PageKey = "home" | "assistant";

const items: { page: PageKey; label: string; path: string; Icon: typeof HomeIcon }[] = [
  { page: "home", label: "الرئيسية", path: "/tammeni", Icon: HomeIcon },
  { page: "assistant", label: "تفضيلات التنبيه", path: "/assistant", Icon: SparkleIcon },
];

/** The logo bar alone, for the pages before entry. */
export function BrandHeader({ end }: { end?: React.ReactNode }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-16 max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/welcome" aria-label="طمّني — الصفحة التعريفية" className="rounded-lg">
          <Wordmark />
        </Link>
        {end}
      </div>
    </header>
  );
}

/**
 * Tammeni's own bar: two destinations, the parent, and sign-out. It keeps the selected child in each
 * link, so moving between the home and the settings never changes whose news is on screen.
 */
export function SiteHeader({ current }: { current: PageKey }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-16 max-w-[1100px] flex-wrap items-center gap-x-6 px-4 sm:px-6">
        <Link href="/tammeni" aria-label="طمّني — الرئيسية" className="rounded-lg py-3">
          <Wordmark />
        </Link>
        <Suspense fallback={<Nav current={current} student={null} />}>
          <NavWithStudent current={current} />
        </Suspense>
        <div className="ms-auto flex items-center gap-3 py-2">
          <span className="hidden text-end leading-tight md:block">
            <span className="block text-[0.9375rem] font-semibold text-ink">{parent.shortName}</span>
            <span className="block text-[0.8125rem] text-faint">ولي أمر — حساب تجريبي</span>
          </span>
          <SignOut />
        </div>
      </div>
    </header>
  );
}

function NavWithStudent({ current }: { current: PageKey }) {
  return <Nav current={current} student={useSearchParams().get("student")} />;
}

function Nav({ current, student }: { current: PageKey; student: string | null }) {
  const query = student ? `?student=${encodeURIComponent(student)}` : "";
  return (
    <nav aria-label="القائمة الرئيسة" className="order-last -mx-4 w-[calc(100%+2rem)] border-t border-rule sm:order-none sm:mx-0 sm:w-auto sm:border-0">
      <ul className="grid grid-cols-2 sm:flex sm:gap-1">
        {items.map(({ page, label, path, Icon }) => {
          const active = page === current;
          return (
            <li key={page} className="flex">
              <Link
                href={`${path}${query}`}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-12 w-full items-center justify-center gap-2 px-4 text-[0.9375rem] font-semibold transition-colors sm:min-h-16 sm:justify-start ${
                  active ? "text-ink" : "text-ink-soft hover:text-ink"
                }`}
              >
                <Icon size={18} className={active ? "text-brand" : "text-faint"} />
                {label}
                {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-brand" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Ends only the demo session; the saved preferences stay as they are.
function SignOut() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    await endDemoSession();
    router.replace("/login");
  };
  return (
    <button type="button" onClick={leave} aria-busy={leaving || undefined} className="btn-secondary btn-sm">
      <LogoutIcon size={18} />
      {leaving ? "جارٍ الخروج…" : "خروج"}
    </button>
  );
}
