"use client";

import { useCallback, useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/mark";
import { InfoIcon } from "@/components/dashboard/icons";
import { ChildSwitcher, Placeholder } from "@/components/dashboard/ui";
import { api, ErrorNote } from "./shared";
import { StudentPanel } from "./student-panel";

type Overview = {
  parent: { name: string } | null;
  students: { id: string; key: string; name: string; firstName: string; grade: string; stage: string | null; school: string }[];
  today: string;
  /** The website may hand a send to the real provider (still behind the backend's own allow-list). */
  realDispatch?: boolean;
};

const container = "mx-auto w-full max-w-[1280px] px-4 sm:px-6";

export function DemoControl() {
  const [data, setData] = useState<{ state: "loading" } | { state: "error"; message: string } | { state: "ready"; overview: Overview }>({
    state: "loading",
  });
  const onSignedOut = useCallback(() => setData({ state: "error", message: "تعذّر الوصول لبيانات العرض. تحقق من إعدادات الخادم ثم أعد المحاولة." }), []);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData({ state: "loading" });
    const r = await api<Overview>("/api/demo-control/overview");
    if (!r.ok) return setData({ state: "error", message: r.error });
    setData({ state: "ready", overview: r.data });
    setSelected((s) => r.data.students.some((student) => student.id === s) ? s : r.data.students[0]?.id ?? null);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const overview = data.state === "ready" ? data.overview : null;
  const real = overview?.realDispatch === true;

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className={`${container} flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2`}>
          <Wordmark sub="استوديو العرض — للمشغّل فقط" />
          <a href="/welcome" target="_blank" rel="noopener" className="btn-secondary btn-sm">
            فتح صفحة ولي الأمر
            <span aria-hidden="true">↗</span>
            <span className="sr-only"> (في تبويب جديد)</span>
          </a>
        </div>
      </header>

      {overview && (real ? (
        <p role="note" className="border-b border-[#efd3a4] bg-warn-bg">
          <span className={`${container} flex items-start gap-2.5 py-2.5 text-[0.9375rem] leading-6 font-medium text-warn`}>
            <InfoIcon size={18} className="mt-0.5 shrink-0" />
            الإرسال الفعلي مسموح على هذا الخادم: زر الإرسال قد يتصل أو يرسل رسالة حقيقية لرقم الاختبار المعتمد. كل إرسال يحتاج تأكيدًا.
          </span>
        </p>
      ) : (
        <p role="note" className="border-b border-line bg-panel">
          <span className={`${container} flex items-start gap-2.5 py-2.5 text-[0.9375rem] leading-6 text-ink-soft`}>
            <InfoIcon size={18} className="mt-0.5 shrink-0" />
            وضع تجريبي: الإرسال يُسجَّل في السجل فقط، وما يصل شيء لأي جوال.
          </span>
        </p>
      ))}

      <main id="main" className={`${container} flex-1 py-6 sm:py-8`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[1.5rem] leading-tight font-bold tracking-tight sm:text-[1.75rem]">جرّب طمّني مع أحداث المدرسة</h1>
            <p className="mt-1.5 max-w-[70ch] leading-7 text-ink-soft">
              سجّل حدثًا لطالب، وشوف وش يقرر طمّني حسب تفضيلات ولي الأمر{overview?.parent ? ` (${overview.parent.name})` : ""}، ثم اعرض الرسالة وأرسلها.
            </p>
          </div>
          {overview && selected && (
            <ChildSwitcher students={overview.students} selectedId={selected} onSelect={setSelected} name="studio-student" legend="الطالب" />
          )}
        </div>

        <Guide />

        <div className="mt-6">
          {data.state === "loading" && <StudioLoading />}
          {data.state === "error" && (
            <div className="max-w-xl space-y-3">
              <ErrorNote>{data.message}</ErrorNote>
              <button type="button" onClick={load} className="btn-secondary btn-sm">
                إعادة المحاولة
              </button>
            </div>
          )}
          {overview && overview.students.length === 0 && (
            <section role="status" className="sheet max-w-xl p-5">
              <h2 className="font-semibold">ما فيه طلاب متاحين للعرض</h2>
              <p className="mt-2 leading-7 text-ink-soft">اربط طالبًا بحساب ولي الأمر التجريبي، ثم أعد تحميل بيانات العرض.</p>
              <button type="button" onClick={load} className="btn-secondary btn-sm mt-4">إعادة تحميل البيانات</button>
            </section>
          )}
          {overview && selected && (
            <StudentPanel key={selected} studentId={selected} today={overview.today} realDispatch={real} onSignedOut={onSignedOut} />
          )}
        </div>
      </main>
    </>
  );
}

function Guide() {
  return (
    <details className="studio-disclosure mt-4 rounded-2xl bg-surface px-4 sm:px-5">
      <summary className="text-[0.9375rem]">كيف يشتغل العرض؟</summary>
      <div className="grid gap-5 pb-5 text-[0.9375rem] leading-7 text-ink-soft md:grid-cols-3">
        <div>
          <p className="font-semibold text-ink">سجّل حدثًا</p>
          <p>غياب، درجة، اختبار، إلغاء اختبار، أو قبول عذر. التسجيل يضيفه لسجل الطالب، وما يرسل شيئًا.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">طمّني يقرر</p>
          <p>حسب تفضيلات ولي الأمر بتوقيت الرياض: لن يُرسل (متوقف)، أو بانتظار الموعد، أو جاهز للإرسال.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">اعرض ثم أرسل</p>
          <p>المعاينة تعرض النص بدون إرسال. الإرسال من هنا يدوي ويتجاوز الانتظار فقط؛ ما يتجاوز نوعًا متوقفًا، وما فيه جدولة تلقائية.</p>
        </div>
      </div>
    </details>
  );
}

function StudioLoading() {
  return (
    <div className="grid gap-4 lg:grid-cols-12" aria-busy="true">
      <p role="status" className="sr-only">
        جارٍ تحميل بيانات العرض
      </p>
      <div className="sheet space-y-4 p-5 lg:col-span-5">
        <Placeholder className="h-6 w-40" />
        <Placeholder className="h-12 w-full" />
        <Placeholder className="h-12 w-full" />
      </div>
      <div className="space-y-3 lg:col-span-7">
        <Placeholder className="h-6 w-48" />
        <Placeholder className="h-40 w-full" />
        <Placeholder className="h-40 w-full" />
      </div>
    </div>
  );
}
