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
  // The site's own address on Vercel, so link previews load this deployment's picture.
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  title: "طمّنـــي",
  openGraph: { siteName: "طمّنـــي", locale: "ar_SA", type: "website" },
  twitter: { card: "summary_large_image" },
  description: "أخبار أبنائك في المدرسة توصلك باتصال أو رسالة، حسب اختياراتك. نموذج تجريبي ببيانات وهمية، غير تابع لمنصة مدرستي الرسمية.",
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
