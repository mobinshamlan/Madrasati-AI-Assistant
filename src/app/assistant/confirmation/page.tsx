import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantConfirmation } from "@/components/assistant/assistant-confirmation";
import { PageShell } from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "تم الحفظ | طمّني",
  description: "ملخص تفضيلات طمّني المحفوظة في الحساب التجريبي — نموذج تعليمي تجريبي ببيانات خيالية.",
};

export default function AssistantConfirmationPage() {
  return (
    <PageShell current="assistant">
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Suspense fallback={<p role="status" className="mx-auto max-w-[760px] px-4 py-10 text-ink-soft sm:px-6">جارٍ تحميل الصفحة…</p>}>
          <AssistantConfirmation />
        </Suspense>
      </main>
    </PageShell>
  );
}
