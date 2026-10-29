import type { Metadata } from "next";
import { SchoolApp } from "@/components/school/school-app";

export const metadata: Metadata = {
  title: "نظام المدرسة | طمّني",
  description: "لوحة المدرسة لتسجيل الحضور والدرجات والاختبارات — نموذج تعليمي تجريبي ببيانات خيالية.",
};

export default function SchoolPage() {
  return <SchoolApp />;
}
