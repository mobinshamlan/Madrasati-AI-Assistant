import type { Metadata } from "next";
import { DemoControl } from "@/components/demo-control/demo-control";
import "@/components/demo-control/demo-studio.css";

export const metadata: Metadata = {
  title: "استوديو الديمو | طمّني",
  description: "محاكاة أحداث المدرسة واختبار استجابة طمّني وفق تفضيلات ولي الأمر المحفوظة. بيانات تجريبية.",
  robots: { index: false, follow: false },
};

export default function DemoControlPage() {
  return (
    <div className="demo-studio">
      <p className="studio-banner">نموذج تعليمي تجريبي ببيانات خيالية — غير تابع لمنصة مدرستي الرسمية</p>
      <DemoControl />
    </div>
  );
}
