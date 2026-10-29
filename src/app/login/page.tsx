import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicShell } from "@/components/dashboard/page-shell";
import { DemoLogin } from "@/components/login/demo-login";

export const metadata: Metadata = {
  title: "دخول تجريبي | المساعد الذكي لولي الأمر",
  description: "دخول تجريبي بولي أمر خيالي، دون كلمة مرور أو بيانات شخصية.",
};

export default function LoginPage() {
  return (
    <PublicShell>
      <Suspense fallback={<p className="flex-1 px-4 py-16 text-center text-lg text-ink-soft">جارٍ فتح الصفحة…</p>}>
        <DemoLogin />
      </Suspense>
    </PublicShell>
  );
}
