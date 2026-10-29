import type { Metadata } from "next";
import { DemoNotice, Footer } from "@/components/dashboard/page-shell";
import { DemoControl } from "@/components/demo-control/demo-control";

export const metadata: Metadata = {
  title: "لوحة تشغيل الديمو | طمّني",
  description: "محاكاة أحداث المدرسة واختبار استجابة طمّني وفق تفضيلات ولي الأمر المحفوظة. بيانات تجريبية.",
  robots: { index: false, follow: false },
};

export default function DemoControlPage() {
  return (
    <>
      <DemoNotice />
      <header className="bg-mint-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 lg:px-6">
          <p className="text-2xl leading-none font-extrabold text-brand-800">طمّني</p>
          <h1 className="text-2xl leading-tight font-extrabold text-ink">لوحة تشغيل الديمو</h1>
          <span className="inline-flex items-center rounded-md bg-tile-navy px-2.5 py-1 text-sm leading-none font-bold text-white">بيانات تجريبية</span>
        </div>
      </header>
      <main id="main" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 text-lg lg:px-6">
          <DemoControl />
        </div>
      </main>
      <Footer />
    </>
  );
}
