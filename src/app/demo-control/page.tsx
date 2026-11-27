import type { Metadata } from "next";
import { TammeniExperience } from "@/components/brand/experience";
import { DemoNotice } from "@/components/dashboard/page-shell";
import { DemoControl } from "@/components/demo-control/demo-control";
import "@/components/demo-control/demo-studio.css";

export const metadata: Metadata = {
  title: "استوديو العرض | طمّنـــي",
  description: "محاكاة أحداث المدرسة واختبار استجابة طمّنـــي وفق تفضيلات ولي الأمر المحفوظة. بيانات تجريبية.",
  robots: { index: false, follow: false },
};

export default function DemoControlPage() {
  return (
    <TammeniExperience>
      <div className="demo-studio">
        <DemoNotice />
        <DemoControl />
      </div>
    </TammeniExperience>
  );
}
