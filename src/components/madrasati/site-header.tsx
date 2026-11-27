"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { endDemoSession } from "@/lib/demo-session";
import { useComingSoon } from "./coming-soon";
import { parent } from "@/components/dashboard/data";
import {
  AccessibilityIcon,
  AttendanceIcon,
  BellIcon,
  ChevronDownIcon,
  ChildrenIcon,
  CloseIcon,
  ExamIcon,
  GradesIcon,
  HeadsetIcon,
  HomeIcon,
  LogoutIcon,
  MailIcon,
  MenuIcon,
  SearchIcon,
  SparkleIcon,
  UserIcon,
} from "@/components/dashboard/icons";

export type PageKey = "home" | "assistant";

type NavItem = {
  label: string;
  Icon: typeof HomeIcon;
  page?: PageKey;
  href?: string;
  description?: string;
};

const navItems: NavItem[] = [
  { label: "الرئيسية", Icon: HomeIcon, page: "home", href: "/" },
  { label: "أبنائي", Icon: ChildrenIcon, description: "صفحة أبنائي ستعرض ملفات الأبناء وبياناتهم المدرسية بالتفصيل. غير متوفرة في هذه النسخة التجريبية." },
  { label: "الحضور والغياب", Icon: AttendanceIcon, description: "سجل الحضور والغياب التفصيلي لكل فصل دراسي غير متوفر في هذه النسخة. الملخص يظهر في الرئيسية." },
  { label: "الاختبارات", Icon: ExamIcon, description: "جدول الاختبارات الكامل غير متوفر في هذه النسخة. الاختبارات القادمة تظهر في الرئيسية." },
  { label: "الدرجات", Icon: GradesIcon, description: "كشف الدرجات التفصيلي غير متوفر في هذه النسخة. آخر الدرجات تظهر في الرئيسية." },
  { label: "طمّنـــي", Icon: SparkleIcon, page: "assistant", href: "/assistant" },
];

const utilityActions = [
  { label: "بحث", Icon: SearchIcon },
  { label: "الرسائل", Icon: MailIcon },
  { label: "التنبيهات", Icon: BellIcon },
  { label: "الدعم الفني", Icon: HeadsetIcon },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <p translate="no" className="tammeni-mark text-[1.75rem] sm:text-[2rem]">طمّنـــي</p>
      <span className="hidden h-10 w-px bg-brand-400 sm:block" aria-hidden="true" />
      <Image
        src="/brand/madrasati-logo.svg"
        alt=""
        width={114}
        height={58}
        unoptimized
        priority
        className="hidden h-9 w-auto sm:block lg:h-11"
      />
      <span className="sr-only">نموذج تعليمي مستوحى من واجهة مدرستي، غير تابع للمنصة الرسمية</span>
    </div>
  );
}

/** The logo bar alone, for the demo login page. */
export function BrandHeader() {
  return (
    <header className="border-b border-mint-300 bg-mint-200">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center px-4 lg:h-[72px] lg:px-6">
        <BrandMark />
      </div>
    </header>
  );
}

export function SiteHeader({ current }: { current: PageKey }) {
  const openComingSoon = useComingSoon();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const openItem = (item: NavItem) => {
    setMenuOpen(false);
    openComingSoon({ title: item.label, description: item.description });
  };

  const openUtility = (label: string) => {
    setMenuOpen(false);
    openComingSoon({ title: label });
  };

  // Ends only the demo session; the assistant preferences saved on this device stay as they are.
  const leave = async () => {
    setMenuOpen(false);
    await endDemoSession();
    router.replace("/welcome");
  };

  return (
    <header className="relative z-30 border-b border-mint-300 bg-mint-200">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 lg:h-[72px] lg:px-6">
        <div className="shrink-0">
          <BrandMark />
        </div>

        <nav aria-label="القائمة الرئيسة" className="hidden h-full flex-1 lg:block">
          <ul className="flex h-full items-stretch justify-center gap-1 xl:gap-2">
            {navItems.map((item) => (
              <li key={item.label} className="flex">
                {item.href ? (
                  <Link
                    href={item.href}
                    aria-current={item.page === current ? "page" : undefined}
                    className={`flex items-center gap-2 border-b-[3px] px-3 text-[15px] font-bold text-ink xl:px-4 ${
                      item.page === current ? "border-brand-500 bg-mint-300" : "border-transparent hover:bg-mint-300/60"
                    }`}
                  >
                    <item.Icon size={19} className="text-brand-700" />
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => openItem(item)}
                    className="flex cursor-pointer items-center gap-2 border-b-[3px] border-transparent px-3 text-[15px] font-bold text-ink hover:bg-mint-300/60 xl:px-4"
                  >
                    <item.Icon size={19} className="text-brand-700" />
                    {item.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <ul className="hidden items-center gap-2 lg:flex" aria-label="أدوات المساعدة">
            {utilityActions.map(({ label, Icon }) => (
              <li key={label}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`${label} — غير متوفر بعد في هذه النسخة`}
                  onClick={() => openUtility(label)}
                  className="relative grid size-12 cursor-pointer place-items-center rounded-full bg-white text-brand-600 hover:bg-mint-50"
                >
                  <Icon size={20} />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => openUtility("الملف الشخصي")}
            className="hidden items-center gap-2 rounded-full py-1 ps-1 pe-2 hover:bg-mint-300/60 lg:flex"
          >
            <span className="grid size-10 place-items-center rounded-full bg-white text-[#9da4ae]">
              <UserIcon size={20} />
            </span>
            <span className="text-start leading-tight">
              <span className="block text-base font-bold text-brand-800">{parent.shortName}</span>
              <span className="block text-base text-ink">{parent.role}</span>
            </span>
            <ChevronDownIcon size={16} className="text-ink-soft" />
          </button>

          <button
            type="button"
            onClick={leave}
            className="hidden min-h-12 cursor-pointer items-center gap-1.5 rounded-full border-2 border-brand-600 bg-white px-4 text-base font-bold text-brand-700 hover:bg-mint-50 lg:flex"
          >
            <LogoutIcon size={18} />
            خروج
          </button>

          <button
            type="button"
            aria-haspopup="dialog"
            aria-label="التنبيهات — غير متوفرة بعد في هذه النسخة"
            onClick={() => openUtility("التنبيهات")}
            className="relative grid size-12 cursor-pointer place-items-center rounded-full bg-white text-brand-600 lg:hidden"
          >
            <BellIcon size={20} />
          </button>
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid size-12 cursor-pointer place-items-center rounded-full bg-brand-600 text-white lg:hidden"
          >
            {menuOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="absolute inset-x-0 top-full border-b border-mint-300 bg-white shadow-lg lg:hidden"
      >
        <div className="flex items-center gap-3 bg-mint-100 px-4 py-3">
          <span className="grid size-10 place-items-center rounded-full bg-white text-[#9da4ae]">
            <UserIcon size={20} />
          </span>
          <span className="leading-tight">
            <span className="block font-bold text-brand-800">{parent.name}</span>
            <span className="block text-sm text-ink-soft">{parent.role}</span>
          </span>
        </div>
        <nav aria-label="القائمة الرئيسة (الجوال)">
          <ul className="divide-y divide-mint-200 px-2 py-1">
            {navItems.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    aria-current={item.page === current ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-md border-s-4 px-3 py-3 font-bold ${
                      item.page === current ? "border-brand-500 bg-mint-200" : "border-transparent hover:bg-mint-100"
                    }`}
                  >
                    <item.Icon size={20} className="text-brand-700" />
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => openItem(item)}
                    className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-md border-s-4 border-transparent px-3 py-3 text-start font-bold hover:bg-mint-100"
                  >
                    <item.Icon size={20} className="text-brand-700" />
                    {item.label}
                    <span className="ms-auto text-sm font-medium text-ink-soft">غير متوفر</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <ul className="flex flex-wrap gap-2 border-t border-mint-200 px-4 py-3" aria-label="أدوات المساعدة">
          {[...utilityActions, { label: "إمكانية الوصول", Icon: AccessibilityIcon }].map(({ label, Icon }) => (
              <li key={label}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => openUtility(label)}
                  className="flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-mint-100 px-3 py-2 text-base font-bold text-brand-700"
                >
                  <Icon size={18} />
                  {label}
                </button>
              </li>
            ))}
        </ul>
        <div className="border-t border-mint-200 px-4 py-3">
          <button
            type="button"
            onClick={leave}
            className="btn-secondary w-full"
          >
            <LogoutIcon size={20} />
            خروج من الدخول التجريبي
          </button>
        </div>
      </div>
    </header>
  );
}
