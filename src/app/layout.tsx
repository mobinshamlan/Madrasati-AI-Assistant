import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "المساعد الذكي لولي الأمر",
  description: "نموذج تعليمي تجريبي ببيانات طلاب خيالية، غير تابع لمنصة مدرستي الرسمية.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
