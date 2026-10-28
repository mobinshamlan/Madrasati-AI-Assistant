import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AssistantSetup } from "@/components/assistant/assistant-setup";
import { PageShell } from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "إعداد المساعد الذكي | المساعد الذكي لولي الأمر",
  description: "اختيار التحديثات وموعد الاتصال المفضل — نموذج تعليمي تجريبي ببيانات خيالية.",
};

export default function AssistantPage() {
  return (
    <PageShell current="assistant">
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <section aria-labelledby="page-title" className="bg-linear-to-b from-mint-200 to-mint-400">
          <div className="mx-auto max-w-3xl px-4 pt-5 pb-8">
            <nav aria-label="مسار التنقل" className="text-base">
              <ol className="flex items-center gap-2 text-ink-soft">
                <li>
                  <Link
                    href="/"
                    className="inline-flex min-h-11 items-center font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
                  >
                    الرئيسية
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">المساعد الذكي</li>
              </ol>
            </nav>
            <h1 id="page-title" className="mt-4 text-3xl leading-tight font-extrabold text-ink">
              إعداد المساعد الذكي
            </h1>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-ink">
              اختر ما تريد معرفته عن أبنائك، والوقت المناسب لنتصل بك ونخبرك به. خمس خطوات قصيرة.
            </p>
          </div>
        </section>

        <Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-10 text-lg text-ink-soft">جارٍ تحميل الصفحة…</p>}>
          <AssistantSetup />
        </Suspense>
      </main>
    </PageShell>
  );
}
