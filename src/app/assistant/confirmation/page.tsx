import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantConfirmation } from "@/components/assistant/assistant-confirmation";
import { PageShell } from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "تم حفظ التفضيلات | المساعد الذكي لولي الأمر",
  description: "ملخص تفضيلات المساعد الذكي المحفوظة على هذا الجهاز — نموذج تعليمي تجريبي ببيانات خيالية.",
};

export default function AssistantConfirmationPage() {
  return (
    <PageShell current="assistant">
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-10 text-lg text-ink-soft">جارٍ تحميل الصفحة…</p>}>
          <AssistantConfirmation />
        </Suspense>
      </main>
    </PageShell>
  );
}
