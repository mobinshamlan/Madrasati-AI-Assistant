"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { CheckIcon } from "@/components/dashboard/icons";
import { useLinkedStudents, useStudentPreferences, type LinkedStudent } from "@/lib/tammeni/parent-data";
import type { Preferences } from "./preferences";
import { PreferencesPreview } from "./preferences-preview";
import { Character, DeliveryNotes, DemoLabel, formatSavedAt, ReviewList } from "./summary";

const primaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-600 px-10 text-lg font-bold text-white transition-colors hover:bg-brand-700";
const secondaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-brand-600 bg-white px-10 text-lg font-bold text-brand-700 transition-colors hover:bg-mint-100";

const setupHref = (studentId: string) => `/assistant?student=${studentId}`;
const homeHref = (studentId: string) => `/?student=${studentId}`;

export function AssistantConfirmation() {
  const studentId = useSearchParams().get("student");
  const linked = useLinkedStudents();
  if (linked.status === "loading") return <Waiting text="جارٍ تحميل البيانات…" />;
  if (linked.status === "error") {
    return <Problem title="تعذّر تحميل البيانات" body={linked.message} action={{ href: studentId ? setupHref(studentId) : "/assistant", label: "العودة إلى إعداد المساعد" }} home="/" />;
  }
  const student = linked.data.find((s) => s.id === studentId);
  if (!student) {
    return (
      <Problem
        title="لم نتعرف على الابن أو الابنة"
        body="افتح إعداد المساعد واختر الابن أو الابنة، ثم احفظ التفضيلات."
        action={{ href: "/assistant", label: "الذهاب إلى إعداد المساعد" }}
        home="/"
      />
    );
  }
  // Keyed by student so focus and the saved record are read afresh for each one.
  return <StudentConfirmation key={student.id} student={student} />;
}

function StudentConfirmation({ student }: { student: LinkedStudent }) {
  const saved = useStudentPreferences(student.dbId);

  // Only a record the database returned counts as saved. Anything else is not shown as a success.
  if (saved.status === "loading") return <Waiting text={`جارٍ تحميل تفضيلات ${student.firstName}…`} />;
  if (saved.status === "error") {
    return (
      <Problem
        title={`تعذّر تحميل تفضيلات ${student.firstName}`}
        body={saved.message}
        action={{ href: setupHref(student.id), label: "العودة إلى إعداد المساعد" }}
        home={homeHref(student.id)}
      />
    );
  }
  if (!saved.data.exists) {
    return (
      <Problem
        title={`لم تُحفظ تفضيلات لـ${student.firstName} بعد`}
        body="لا توجد تفضيلات محفوظة في حسابك لهذا الابن. أكمل خطوات الإعداد واضغط «حفظ التفضيلات»."
        action={{ href: setupHref(student.id), label: "إعداد التفضيلات" }}
        home={homeHref(student.id)}
      />
    );
  }
  return <Success student={student} preferences={saved.data.preferences} />;
}

function Waiting({ text }: { text: string }) {
  return (
    <p role="status" className="mx-auto max-w-3xl px-4 py-16 text-center text-lg text-ink-soft">
      {text}
    </p>
  );
}

function Success({ student, preferences }: { student: LinkedStudent; preferences: Preferences }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Land keyboard and screen-reader users on the result. Nothing moves on by itself.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <>
      <section aria-labelledby="confirmation-title" className="bg-mint-200">
        <div className="mx-auto max-w-3xl px-4 pt-5 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Breadcrumb studentId={student.id} />
            <DemoLabel />
          </div>
          <div className="mt-4 flex items-center gap-4 sm:gap-6">
            <Character className="size-20 sm:size-32" />
            <div className="min-w-0">
              <h1
                id="confirmation-title"
                ref={headingRef}
                tabIndex={-1}
                className="flex items-start gap-2 text-2xl leading-tight font-extrabold text-ink focus:outline-none sm:text-3xl"
              >
                <CheckIcon size={26} strokeWidth={3} className="mt-0.5 shrink-0 text-[#067647]" />
                تم حفظ التفضيلات
              </h1>
              <p className="mt-2 text-lg leading-8 text-ink">
                اختيارات <strong>{student.name}</strong> — {student.grade}.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-lg">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={homeHref(student.id)} className={primaryButton}>
            العودة إلى الرئيسية
          </Link>
          <Link href={setupHref(student.id)} className={secondaryButton}>
            تعديل التفضيلات
          </Link>
        </div>

        <section aria-labelledby="summary-title" className="space-y-4">
          <h2 id="summary-title" className="text-2xl font-extrabold text-ink">
            ملخص اختياراتك
          </h2>
          <ReviewList preferences={preferences} student={student} legacy={null} showRetry />
          {preferences.savedAt && (
            <p className="text-base text-ink-soft">آخر حفظ: {formatSavedAt(preferences.savedAt)} بتوقيت السعودية</p>
          )}
        </section>

        <PreferencesPreview key={JSON.stringify(preferences)} studentId={student.id} preferences={preferences} />

        <section aria-labelledby="notes-title" className="space-y-4">
          <h2 id="notes-title" className="text-2xl font-extrabold text-ink">
            معلومات مهمة
          </h2>
          <DeliveryNotes student={student} />
        </section>
      </div>
    </>
  );
}

function Problem({
  title,
  body,
  action,
  home,
}: {
  title: string;
  body: string;
  action: { href: string; label: string };
  home: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <>
      <section aria-labelledby="confirmation-title" className="bg-mint-200">
        <div className="mx-auto max-w-3xl px-4 pt-5 pb-8">
          <h1
            id="confirmation-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl leading-tight font-extrabold text-ink focus:outline-none"
          >
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-ink">{body}</p>
        </div>
      </section>
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-8 sm:flex-row">
        <Link href={action.href} className={primaryButton}>
          {action.label}
        </Link>
        <Link href={home} className={secondaryButton}>
          العودة إلى الرئيسية
        </Link>
      </div>
    </>
  );
}

function Breadcrumb({ studentId }: { studentId: string }) {
  return (
    <nav aria-label="مسار التنقل" className="text-base">
      <ol className="flex flex-wrap items-center gap-2 text-ink-soft">
        <li>
          <Link
            href={homeHref(studentId)}
            className="inline-flex min-h-11 items-center font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
          >
            الرئيسية
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link
            href={setupHref(studentId)}
            className="inline-flex min-h-11 items-center font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
          >
            المساعد الذكي
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page">تم الحفظ</li>
      </ol>
    </nav>
  );
}
