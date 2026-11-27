"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BrandBlock } from "@/components/brand/brand-block";
import { parent } from "./data";
import { HomeIcon, SparkleIcon } from "./icons";
import { SignOut } from "./sign-out";

export type PageKey = "home" | "assistant";

const items: { page: PageKey; label: string; path: string; Icon: typeof HomeIcon }[] = [
  { page: "home", label: "الرئيسية", path: "/tammeni", Icon: HomeIcon },
  { page: "assistant", label: "تفضيلات التنبيه", path: "/assistant", Icon: SparkleIcon },
];

/** The logo bar alone, for the pages before entry. */
export function BrandHeader({ end }: { end?: React.ReactNode }) {
  return (
    <header className="on-board border-b border-board-raised">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6">
        <BrandBlock href="/welcome" label="طمّنـــي — الصفحة التعريفية" />
        {end}
      </div>
    </header>
  );
}

/**
 * Tammeni's own bar: the same identity as the welcome page, then the two destinations, the parent and
 * sign-out. It keeps the selected child in each link, so moving between the home and the settings never
 * changes whose news is on screen. On phones sign-out sits in the tour bar under it.
 */
export function SiteHeader({ current }: { current: PageKey }) {
  return (
    <header className="on-board border-b border-board-raised">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-6 px-4 sm:px-6">
        <Suspense fallback={<HomeBlock student={null} />}>
          <HomeBlockWithStudent />
        </Suspense>
        <Suspense fallback={<Nav current={current} student={null} />}>
          <NavWithStudent current={current} />
        </Suspense>
        <div className="ms-auto hidden items-center gap-3 py-2 sm:flex">
          <span className="hidden text-end leading-tight lg:block">
            <span className="block text-[0.9375rem] font-semibold text-chalk">{parent.shortName}</span>
            <span className="block text-[0.8125rem] text-chalk-soft">ولي أمر — حساب تجريبي</span>
          </span>
          <SignOut />
        </div>
      </div>
    </header>
  );
}

function HomeBlockWithStudent() {
  return <HomeBlock student={useSearchParams().get("student")} />;
}

function HomeBlock({ student }: { student: string | null }) {
  return <BrandBlock href={student ? `/tammeni?student=${encodeURIComponent(student)}` : "/tammeni"} label="طمّنـــي — الرئيسية" />;
}

function NavWithStudent({ current }: { current: PageKey }) {
  return <Nav current={current} student={useSearchParams().get("student")} />;
}

function Nav({ current, student }: { current: PageKey; student: string | null }) {
  const query = student ? `?student=${encodeURIComponent(student)}` : "";
  // On phones the two destinations sit in a bottom bar, within thumb reach. The alert setup has its own
  // save bar there, so the navigation steps aside while choosing.
  const inSetup = usePathname() === "/assistant";
  return (
    <nav
      aria-label="القائمة الرئيسة"
      className={`on-board fixed inset-x-0 bottom-0 z-30 border-t border-board-line pb-[env(safe-area-inset-bottom)] sm:static sm:z-auto sm:border-0 sm:pb-0 ${inSetup ? "max-sm:hidden" : ""}`}
    >
      <ul className="grid grid-cols-2 sm:flex sm:gap-1">
        {items.map(({ page, label, path, Icon }) => {
          const active = page === current;
          return (
            <li key={page} className="flex">
              <Link
                href={`${path}${query}`}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 w-full flex-col items-center justify-center gap-0.5 px-4 text-[0.8125rem] font-semibold transition-colors sm:flex-row sm:justify-start sm:gap-2 sm:text-[0.9375rem] ${
                  active ? "text-chalk" : "text-chalk-soft hover:text-chalk"
                }`}
              >
                <Icon size={18} className={active ? "text-bell-light" : "text-chalk-soft"} />
                {label}
                {active && <span aria-hidden="true" className="absolute inset-x-6 top-0 h-[3px] rounded-full bg-bell-light sm:inset-x-3 sm:top-auto sm:bottom-0" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
