import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "طمّني",
  description: "أخبار أبنائك في المدرسة توصلك باتصال أو رسالة، حسب اختياراتك. نموذج تعليمي تجريبي ببيانات خيالية، غير تابع لمنصة مدرستي الرسمية.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">
          تخطي إلى المحتوى
        </a>
        {children}
      </body>
    </html>
  );
}
