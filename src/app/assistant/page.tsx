import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantSetup } from "@/components/assistant/assistant-setup";
import { PageShell } from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "إعداد طمّني | تفضيلات ولي الأمر",
  description: "اختيار التحديثات وموعدها وطريقة التواصل — نموذج تعليمي تجريبي ببيانات خيالية.",
};

export default function AssistantPage() {
  return (
    <PageShell current="assistant">
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-10 text-lg text-ink-soft">جارٍ تحميل الصفحة…</p>}>
          <AssistantSetup />
        </Suspense>
      </main>
    </PageShell>
  );
}
