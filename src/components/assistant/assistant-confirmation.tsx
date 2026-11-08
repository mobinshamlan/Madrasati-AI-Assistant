"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { NO_AUTOMATIC_SENDING } from "./config";
import { CheckIcon } from "@/components/dashboard/icons";
import { LoadProblem, Placeholder } from "@/components/dashboard/ui";
import { useLinkedStudents, useStudentPreferences, type LinkedStudent } from "@/lib/tammeni/parent-data";
import type { Preferences } from "./preferences";
import { Character, PreferenceSummary, formatSavedAt } from "./summary";

const setupHref = (studentId: string) => `/assistant?student=${studentId}`;
const homeHref = (studentId: string) => `/tammeni?student=${studentId}`;
const container = "mx-auto w-full max-w-[760px] px-4 sm:px-6";

export function AssistantConfirmation() {
  const studentId = useSearchParams().get("student");
  const linked = useLinkedStudents();
  if (linked.status === "loading") return <Waiting />;
  if (linked.status === "error") {
    return <Problem title="تعذّر تحميل البيانات" body={linked.message} action={{ href: studentId ? setupHref(studentId) : "/assistant", label: "الرجوع للتفضيلات" }} home="/tammeni" />;
  }
  const student = linked.data.find((s) => s.id === studentId);
  if (!student) {
    return (
      <Problem
        title="ما تعرّفنا على الابن أو الابنة"
        body="افتح تفضيلات التنبيه واختر الابن أو الابنة، ثم احفظ."
        action={{ href: "/assistant", label: "فتح تفضيلات التنبيه" }}
        home="/tammeni"
      />
    );
  }
  const siblings = linked.data.filter((s) => s.id !== student.id);
  // Keyed by student so focus and the saved record are read afresh for each one.
  return <StudentConfirmation key={student.id} student={student} siblings={siblings} />;
}

function StudentConfirmation({ student, siblings }: { student: LinkedStudent; siblings: LinkedStudent[] }) {
  const saved = useStudentPreferences(student.dbId);

  // Only a record the database returned counts as saved. Anything else is not shown as a success.
  if (saved.status === "loading") return <Waiting />;
  if (saved.status === "error") {
    return (
      <Problem
        title={`تعذّر تحميل تفضيلات ${student.firstName}`}
        body={saved.message}
        action={{ href: setupHref(student.id), label: "الرجوع للتفضيلات" }}
        home={homeHref(student.id)}
      />
    );
  }
  if (!saved.data.exists) {
    return (
      <Problem
        title={`ما فيه تفضيلات محفوظة لـ${student.firstName}`}
        body="ما لقينا تفضيلات محفوظة في حسابك لهذا الابن. اختر التنبيهات واضغط «حفظ التفضيلات»."
        action={{ href: setupHref(student.id), label: `ضبط تنبيهات ${student.firstName}` }}
        home={homeHref(student.id)}
      />
    );
  }
  return <Success student={student} siblings={siblings} preferences={saved.data.preferences} updatedAt={saved.data.updatedAt} />;
}

function Waiting() {
  return (
    <div className={`${container} space-y-4 py-12`} aria-busy="true">
      <p role="status" className="sr-only">
        جارٍ تحميل التفضيلات المحفوظة
      </p>
      <Placeholder className="h-9 w-72" />
      <Placeholder className="h-6 w-96 max-w-full" />
      <Placeholder className="h-56 w-full" />
    </div>
  );
}

function Success({
  student,
  siblings,
  preferences,
  updatedAt,
}: {
  student: LinkedStudent;
  siblings: LinkedStudent[];
  preferences: Preferences;
  updatedAt: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Land keyboard and screen-reader users on the result. Nothing moves on by itself.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className={`${container} py-10 sm:py-14`}>
      <div className="flex items-start gap-4">
        <span className="arrive mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-ok text-white" aria-hidden="true">
          <CheckIcon size={22} strokeWidth={2.6} />
        </span>
        <div className="min-w-0">
          <h1 ref={headingRef} tabIndex={-1} className="text-[1.75rem] leading-tight font-bold tracking-tight focus:outline-none sm:text-[2rem]">
            حفظنا تنبيهات {student.firstName}
          </h1>
          <p className="mt-2 text-[1.0625rem] leading-8 text-ink-soft">
            هذي المواعيد المحفوظة لـ{student.firstName}. تقدر تعدّلها أي وقت.
            {updatedAt && <span className="block text-[0.9375rem] text-faint">آخر حفظ: {formatSavedAt(updatedAt)}</span>}
          </p>
        </div>
      </div>

      <section aria-labelledby="summary-title" className="sheet mt-8 p-5 sm:p-6">
        <h2 id="summary-title" className="sr-only">
          ملخص تنبيهات {student.firstName}
        </h2>
        <PreferenceSummary preferences={preferences} firstName={student.firstName} />
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href={homeHref(student.id)} className="btn-primary">
          الرجوع للرئيسية
        </Link>
        <Link href={setupHref(student.id)} className="btn-secondary">
          تعديل التنبيهات
        </Link>
      </div>

      {siblings.length > 0 && (
        <aside className="tone mt-10 flex items-center gap-4 p-5" aria-label="الخطوة التالية">
          <Character className="size-14" size={56} />
          <p className="min-w-0 flex-1 leading-7">
            <span className="block font-semibold">لكل ابن تنبيهاته الخاصة</span>
            {siblings.map((s, i) => (
              <span key={s.id}>
                {i > 0 && "، "}
                <Link href={setupHref(s.id)} className="link">
                  اضبط تنبيهات {s.firstName}
                </Link>
              </span>
            ))}
          </p>
        </aside>
      )}

      <p className="mt-8 text-[1rem] leading-7 text-ink-soft">{NO_AUTOMATIC_SENDING}</p>
    </div>
  );
}

function Problem({ title, body, action, home }: { title: string; body: string; action: { href: string; label: string }; home: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <div className={`${container} py-12`}>
      <h1 ref={headingRef} tabIndex={-1} className="text-[1.75rem] leading-tight font-bold focus:outline-none">
        {title}
      </h1>
      <div className="mt-4">
        <LoadProblem title="ما قدرنا نعرض الملخص" message={body} />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href={action.href} className="btn-primary">
          {action.label}
        </Link>
        <Link href={home} className="btn-secondary">
          الرجوع للرئيسية
        </Link>
      </div>
    </div>
  );
}
