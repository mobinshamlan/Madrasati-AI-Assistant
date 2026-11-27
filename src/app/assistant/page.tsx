import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantSetup } from "@/components/assistant/assistant-setup";
import { PageShell } from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "تفضيلات التنبيه | طمّنـــي",
  description: "اختر وش يوصلك عن أبنائك، ومتى، وكيف — نموذج تجريبي ببيانات وهمية.",
};

export default function AssistantPage() {
  return (
    <PageShell current="assistant">
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Suspense fallback={<p role="status" className="mx-auto max-w-[1100px] px-4 py-10 text-ink-soft sm:px-6">جارٍ تحميل الصفحة…</p>}>
          <AssistantSetup />
        </Suspense>
      </main>
    </PageShell>
  );
}
