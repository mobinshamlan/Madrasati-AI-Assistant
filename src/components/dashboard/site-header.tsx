"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useComingSoon } from "./coming-soon";
import { parent } from "./data";
import {
  AttendanceIcon,
  BellIcon,
  ChevronDownIcon,
  ChildrenIcon,
  CloseIcon,
  ExamIcon,
  GradesIcon,
  HeadsetIcon,
  HomeIcon,
  MailIcon,
  MenuIcon,
  SearchIcon,
  SparkleIcon,
  UserIcon,
} from "./icons";

type NavItem = {
  label: string;
  Icon: typeof HomeIcon;
  current?: boolean;
  isNew?: boolean;
  description?: string;
};

const navItems: NavItem[] = [
  { label: "الرئيسية", Icon: HomeIcon, current: true },
  { label: "أبنائي", Icon: ChildrenIcon, description: "صفحة أبنائي ستعرض ملفات الأبناء وبياناتهم المدرسية بالتفصيل." },
  { label: "الحضور والغياب", Icon: AttendanceIcon, description: "سجل الحضور والغياب التفصيلي لكل فصل دراسي سيتوفر قريبًا." },
  { label: "الاختبارات", Icon: ExamIcon, description: "جدول الاختبارات الكامل ونتائجها سيتوفر قريبًا." },
  { label: "الدرجات", Icon: GradesIcon, description: "كشف الدرجات التفصيلي لجميع المواد سيتوفر قريبًا." },
  {
    label: "المساعد الذكي",
    Icon: SparkleIcon,
    isNew: true,
    description:
      "ميزة جديدة قيد التطوير: سيختار ولي الأمر التحديثات التي تهمه وجدول الاتصال المفضل لديه لتلقي ملخص عن أبنائه.",
  },
];

const utilityActions = [
  { label: "بحث", Icon: SearchIcon },
  { label: "الرسائل", Icon: MailIcon },
  { label: "التنبيهات", Icon: BellIcon, count: 2 },
  { label: "الدعم الفني", Icon: HeadsetIcon },
];

function NewBadge() {
  return (
    <span className="rounded-md bg-tile-navy px-1.5 py-0.5 text-[11px] leading-none font-bold text-white">جديد</span>
  );
}

export function SiteHeader() {
  const openComingSoon = useComingSoon();
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

  return (
    <header className="relative z-30 border-b border-mint-300 bg-mint-200">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 lg:h-[72px] lg:px-6">
        <div className="shrink-0">
          <Image
            src="/brand/madrasati-logo.svg"
            alt="شعار منصة مدرستي"
            width={114}
            height={58}
            unoptimized
            priority
            className="h-10 w-auto lg:h-12"
          />
        </div>

        <nav aria-label="القائمة الرئيسة" className="hidden h-full flex-1 lg:block">
          <ul className="flex h-full items-stretch justify-center gap-1 xl:gap-2">
            {navItems.map((item) => (
              <li key={item.label} className="flex">
                {item.current ? (
                  <a
                    href="#main"
                    aria-current="page"
                    className="flex items-center gap-2 border-b-[3px] border-brand-500 bg-mint-300 px-3 text-[15px] font-bold text-ink xl:px-4"
                  >
                    <item.Icon size={19} className="text-brand-700" />
                    {item.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => openItem(item)}
                    className="flex items-center gap-2 border-b-[3px] border-transparent px-3 text-[15px] font-bold text-ink hover:bg-mint-300/60 xl:px-4"
                  >
                    <item.Icon size={19} className="text-brand-700" />
                    {item.label}
                    {item.isNew && <NewBadge />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <ul className="hidden items-center gap-2 lg:flex" aria-label="أدوات المساعدة">
            {utilityActions.map(({ label, Icon, count }) => (
              <li key={label}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={count ? `${label} (${count} جديدة)` : label}
                  onClick={() => openUtility(label)}
                  className="relative grid size-10 place-items-center rounded-full bg-white text-brand-600 shadow-sm hover:bg-mint-50"
                >
                  <Icon size={19} />
                  {count ? (
                    <span className="absolute -top-1.5 -end-1 grid size-5 place-items-center rounded-full bg-[#f5a524] text-[11px] font-bold text-ink">
                      {count}
                    </span>
                  ) : null}
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
              <span className="block text-sm font-bold text-brand-800">{parent.shortName}</span>
              <span className="block text-xs text-ink-soft">{parent.role}</span>
            </span>
            <ChevronDownIcon size={16} className="text-ink-soft" />
          </button>

          <button
            type="button"
            aria-haspopup="dialog"
            aria-label="التنبيهات (2 جديدة)"
            onClick={() => openUtility("التنبيهات")}
            className="relative grid size-10 place-items-center rounded-full bg-white text-brand-600 shadow-sm lg:hidden"
          >
            <BellIcon size={19} />
            <span className="absolute -top-1.5 -end-1 grid size-5 place-items-center rounded-full bg-[#f5a524] text-[11px] font-bold text-ink">
              2
            </span>
          </button>
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-full bg-brand-600 text-white lg:hidden"
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
                {item.current ? (
                  <a
                    href="#main"
                    aria-current="page"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-md border-s-4 border-brand-500 bg-mint-200 px-3 py-3 font-bold"
                  >
                    <item.Icon size={20} className="text-brand-700" />
                    {item.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => openItem(item)}
                    className="flex w-full items-center gap-3 rounded-md border-s-4 border-transparent px-3 py-3 text-start font-bold hover:bg-mint-100"
                  >
                    <item.Icon size={20} className="text-brand-700" />
                    {item.label}
                    {item.isNew ? (
                      <NewBadge />
                    ) : (
                      <span className="ms-auto text-xs font-medium text-ink-soft">قريبًا</span>
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <ul className="flex flex-wrap gap-2 border-t border-mint-200 px-4 py-3" aria-label="أدوات المساعدة">
          {utilityActions
            .filter(({ count }) => !count)
            .map(({ label, Icon }) => (
              <li key={label}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => openUtility(label)}
                  className="flex items-center gap-2 rounded-full bg-mint-100 px-3 py-2 text-sm font-bold text-brand-700"
                >
                  <Icon size={17} />
                  {label}
                </button>
              </li>
            ))}
        </ul>
      </div>
    </header>
  );
}
