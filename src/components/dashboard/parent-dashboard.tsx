"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Character, PreferenceSummary } from "@/components/assistant/summary";
import type { Preferences } from "@/components/assistant/preferences";
import { arabicDay, arabicMoment, evaluate, riyadhDay } from "@/lib/tammeni/evaluate";
import {
  useDashboardStudent,
  useLinkedStudents,
  useStudentPreferences,
  type DashboardStudent,
  type LinkedStudent,
} from "@/lib/tammeni/parent-data";
import type { AttendanceStatus } from "./data";
import { BellIcon, ClockIcon } from "./icons";
import { PageShell } from "./page-shell";
import { ChildSwitcher, LoadProblem, Placeholder } from "./ui";

export function ParentDashboard() {
  return (
    <PageShell current="home">
      <Suspense fallback={<HomeLoading />}>
        <DashboardBody />
      </Suspense>
    </PageShell>
  );
}

const container = "mx-auto w-full max-w-[1100px] px-4 sm:px-6";

function DashboardBody() {
  const router = useRouter();
  // The selected child lives in the address, so a refresh or a return from the settings keeps it.
  const selectedId = useSearchParams().get("student");
  // The parent's children and their records come from Supabase (RLS: only this parent's children).
  const linked = useLinkedStudents();
  const list = linked.status === "ready" ? linked.data : [];
  const current = list.find((s) => s.id === selectedId) ?? list[0] ?? null;
  const record = useDashboardStudent(current);
  const prefs = useStudentPreferences(current?.dbId ?? null);
  const setStudentId = (id: string) => router.replace(`/tammeni?student=${id}`, { scroll: false });

  if (linked.status === "loading") return <HomeLoading />;
  if (linked.status === "error") return <Problem message={linked.message} onRetry={linked.reload} />;
  if (!current) return <Problem message="ما فيه أبناء مرتبطين بهذا الحساب بعد." />;

  return (
    <main id="main" tabIndex={-1} className="flex-1 pb-16 focus:outline-none">
      <p className="sr-only" aria-live="polite">
        يتم الآن عرض أخبار {current.name}
      </p>
      <section aria-labelledby="home-title" className="on-board">
        <div className={`${container} pt-8 pb-10 sm:pt-12 sm:pb-12`}>
          <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[0.9375rem] text-chalk-soft">
                {current.grade}
                <span aria-hidden="true"> · </span>
                {current.school}
              </p>
              <h1 id="home-title" className="mt-2 text-[2.25rem] leading-[1.25] text-chalk sm:text-[3rem]">
                أخبار {current.firstName}
              </h1>
            </div>
            <ChildSwitcher students={list} selectedId={current.id} onSelect={setStudentId} />
          </div>
          <Finding student={current} record={record.status === "ready" ? record.data : null} recordFailed={record.status === "error"} prefs={prefs} />
        </div>
      </section>

      {/* Two columns that each stack on their own, so no panel is stretched to its neighbour's height. On phones
          the wrappers dissolve (display: contents) and the panels follow the reading order below. */}
      <div className={`${container} mt-8 flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start`}>
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-4">
          <div className="order-1">
            <PreferencesPanel student={current} prefs={prefs} />
          </div>
          {record.status === "ready" && (
            <div className="order-4">
              <GradesPanel student={record.data} />
            </div>
          )}
        </div>
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-4">
          <div className="order-2">
            {record.status === "error" ? (
              <LoadProblem title="تعذّر تحميل سجلات المدرسة" message={record.message} onRetry={record.reload} />
            ) : record.status === "loading" ? (
              <PanelLoading className="" />
            ) : (
              <ExamsPanel student={record.data} prefs={prefs.status === "ready" && prefs.data.exists ? prefs.data.preferences : null} />
            )}
          </div>
          {record.status === "ready" && (
            <div className="order-3">
              <AttendancePanel student={record.data} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

type PrefsState = ReturnType<typeof useStudentPreferences>;

/** The one fact that matters most now, in a sentence: the next exam and when Tammeni would remind. */
function Finding({ student, record, recordFailed, prefs }: { student: LinkedStudent; record: DashboardStudent | null; recordFailed: boolean; prefs: PrefsState }) {
  const href = `/assistant?student=${student.id}`;
  // The setup action needs only the preferences, so it shows even if school records fail.
  const needsSetup = prefs.status === "ready" && !prefs.data.exists;
  if (!needsSetup && recordFailed) return null;
  if (prefs.status === "loading" || (!record && !needsSetup)) {
    return (
      <div className="note mt-7 max-w-[44rem] space-y-2" aria-hidden="true">
        <Placeholder className="h-6 w-full" />
        <Placeholder className="h-6 w-2/3" />
      </div>
    );
  }
  if (prefs.status === "error") return null;
  if (!prefs.data.exists) {
    return (
      <div className="note mt-7 flex max-w-[44rem] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <BellIcon size={22} className="note-bell" />
        <p className="text-[1.0625rem] leading-8">
          <strong className="font-semibold">ما ضبطت تنبيهات {student.firstName} بعد.</strong> اختر وش يوصلك عنها، ومتى، وكيف.
        </p>
        <Link href={href} className="btn-primary shrink-0">
          اضبط التنبيهات
        </Link>
      </div>
    );
  }
  if (!record) return null;
  const next = nextExam(record, prefs.data.preferences);
  // With no upcoming exam, the exams panel already says so.
  if (!next) return null;
  return (
    <p className="note mt-7 max-w-[44rem] text-[1.0625rem] leading-8">
      <BellIcon size={22} className="note-bell" />
      أقرب اختبار: <strong className="font-semibold">{next.subject}</strong> يوم {arabicDay(next.examDate)}.{" "}
      {next.reminder.status === "suppressed"
        ? "تذكير الاختبارات متوقف."
        : `${reminderText(next.reminder)}، ${next.reminder.method === "call" ? "باتصال" : "برسالة"}.`}
    </p>
  );
}

function upcomingExams(record: DashboardStudent) {
  const today = riyadhDay(new Date());
  return record.examDates.filter((e) => !e.cancelled && e.examDate >= today).sort((a, b) => a.examDate.localeCompare(b.examDate));
}

/** When the saved choices would remind about an exam — the same rules the demo studio uses. */
function reminderFor(exam: DashboardStudent["examDates"][number], prefs: Preferences | null) {
  const now = new Date();
  return evaluate(
    { kind: "exam_added", date: riyadhDay(now), examDate: exam.examDate, startTime: exam.startTime, subject: exam.subject, examKind: exam.kind },
    prefs,
    now,
  );
}

/** A reminder whose time has passed says so, rather than reading as still to come. */
function reminderText(r: ReturnType<typeof reminderFor>) {
  if (r.status === "suppressed") return "بدون تذكير";
  if (!r.dueAt) return "التذكير مباشرة";
  return r.status === "ready" ? `موعد التذكير مضى (${arabicMoment(r.dueAt)})` : `التذكير ${arabicMoment(r.dueAt)}`;
}

function nextExam(record: DashboardStudent, prefs: Preferences) {
  const exam = upcomingExams(record)[0];
  return exam ? { ...exam, reminder: reminderFor(exam, prefs) } : null;
}

function PanelHeader({ id, title, aside }: { id: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="text-[1.125rem] font-semibold">
        {title}
      </h2>
      {aside}
    </div>
  );
}

function PreferencesPanel({ student, prefs }: { student: LinkedStudent; prefs: PrefsState }) {
  const href = `/assistant?student=${student.id}`;
  return (
    <section aria-labelledby="prefs-title" className="sheet p-5 sm:p-6">
      <PanelHeader
        id="prefs-title"
        title={`كيف يوصلك الخبر عن ${student.firstName}`}
        aside={
          prefs.status === "ready" && prefs.data.exists ? (
            <Link href={href} className="btn-secondary btn-sm">
              عدّل التنبيهات
            </Link>
          ) : null
        }
      />
      <div className="mt-4">
        {prefs.status === "loading" ? (
          <div className="space-y-5 py-2" aria-busy="true">
            <p role="status" className="sr-only">
              جارٍ تحميل التفضيلات
            </p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Placeholder className="h-5 w-40" />
                <Placeholder className="h-5 w-3/4" />
              </div>
            ))}
          </div>
        ) : prefs.status === "error" ? (
          <LoadProblem title="تعذّر تحميل التفضيلات" message={prefs.message} onRetry={prefs.reload} />
        ) : prefs.data.exists ? (
          <PreferenceSummary preferences={prefs.data.preferences} firstName={student.firstName} />
        ) : (
          <div className="flex items-center gap-4 rounded-xl bg-panel p-4">
            <Character className="size-16" size={64} />
            <p className="text-[0.9375rem] leading-7 text-ink-soft">ما يوصلك شيء عن {student.firstName} قبل ما تحفظ اختياراتك.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ExamsPanel({ student, prefs }: { student: DashboardStudent; prefs: Preferences | null }) {
  const upcoming = useMemo(() => upcomingExams(student), [student]);
  const shown = upcoming.slice(0, 4);
  return (
    <section aria-labelledby="exams-title" className="tone p-5 sm:p-6">
      <PanelHeader id="exams-title" title="الاختبارات القادمة" aside={<span className="num text-[0.9375rem] text-faint">{examCount(upcoming.length)}</span>} />
      {shown.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-control px-4 py-3 text-[0.9375rem] text-ink-soft">
          ما فيه اختبارات قادمة مسجّلة لـ{student.firstName}.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {shown.map((e, i) => {
            const reminder = prefs ? reminderFor(e, prefs) : null;
            return (
              <li key={`${e.subject}-${e.examDate}-${i}`} className="py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">{e.subject}</p>
                  <p className="shrink-0 text-[0.9375rem] text-ink-soft">{arabicDay(e.examDate)}</p>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.875rem] leading-6 text-faint">
                  <span>{e.kind}</span>
                  {reminder && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon size={14} />
                        {reminderText(reminder)}
                      </span>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {upcoming.length > shown.length && (
        <p className="mt-2 text-[0.875rem] text-faint">وبعدها {examCount(upcoming.length - shown.length)}.</p>
      )}
    </section>
  );
}

const statusLook: Record<AttendanceStatus, { label: string; tone: string }> = {
  present: { label: "حاضر", tone: "ok" },
  absent: { label: "غائب", tone: "danger" },
  late: { label: "متأخر", tone: "warn" },
  excused: { label: "غياب بعذر", tone: "info" },
};

function AttendancePanel({ student }: { student: DashboardStudent }) {
  const a = student.attendance;
  const rate = attendanceRate(student);
  const days = [...a.week].reverse();
  return (
    <section aria-labelledby="attendance-title" className="tone p-5 sm:p-6">
      <PanelHeader id="attendance-title" title="الحضور" aside={<span className="text-[0.875rem] text-faint">{a.termLabel}</span>} />
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="num text-[2rem] leading-none font-medium" dir="ltr">
          {rate}%
        </p>
        <p className="num text-[0.9375rem] text-ink-soft">
          حضر {a.present + a.late} من {a.schoolDays} يومًا دراسيًا
        </p>
      </div>
      <dl className="num mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem]">
        {[
          ["غياب", a.absent],
          ["تأخر", a.late],
          ["غياب بعذر", a.excused],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-1.5">
            <dt className="text-faint">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 text-[0.875rem] font-semibold text-ink-soft">آخر الأيام المسجلة</h3>
      <ul className="mt-1 divide-y divide-line">
        {days.map((d) => {
          const look = statusLook[d.status];
          return (
            <li key={d.date} className="flex min-h-12 items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="font-medium">{d.day}</span> <span className="num text-[0.875rem] text-faint">{d.date}</span>
                {d.note && <span className="block truncate text-[0.8125rem] text-faint">{d.note}</span>}
              </span>
              <span className="chip" data-tone={look.tone}>
                {look.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GradesPanel({ student }: { student: DashboardStudent }) {
  const rows = student.grades.slice(0, 6);
  return (
    <section aria-labelledby="grades-title" className="tone p-5 sm:p-6">
      <PanelHeader
        id="grades-title"
        title="آخر الدرجات"
        aside={
          rows.length > 0 ? (
            <span className="text-[0.875rem] text-faint">
              المتوسط{" "}
              <bdi dir="ltr" className="num font-semibold text-ink">
                {gradeAverage(student)}%
              </bdi>
            </span>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-control px-4 py-3 text-[0.9375rem] text-ink-soft">ما نُشرت درجات بعد.</p>
      ) : (
        <table className="mt-2 w-full text-[0.9375rem]">
          <caption className="sr-only">آخر الدرجات المنشورة لـ{student.name}</caption>
          <thead>
            <tr className="text-[0.8125rem] text-faint">
              <th scope="col" className="py-2 text-start font-medium">
                المادة
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                الدرجة
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {rows.map((g, i) => {
              const low = g.score / g.outOf < 0.8;
              return (
                <tr key={`${g.subject}-${g.assessment}-${i}`}>
                  <th scope="row" className="py-2.5 text-start font-normal">
                    <span className="block font-medium">{g.subject}</span>
                    <span className="block text-[0.8125rem] text-faint"><bdi>{g.assessment}</bdi></span>
                  </th>
                  <td className="num py-2.5 text-end align-top whitespace-nowrap">
                    <bdi dir="ltr" className={`font-semibold ${low ? "text-warn" : ""}`}>
                      {fmt(g.score)} / {fmt(g.outOf)}
                    </bdi>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** "اختبار واحد" / "اختباران" / "3 اختبارات" / "11 اختبارًا". */
function examCount(n: number) {
  if (n === 0) return "لا اختبارات";
  if (n === 1) return "اختبار واحد";
  if (n === 2) return "اختباران";
  return n <= 10 ? `${n} اختبارات` : `${n} اختبارًا`;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

function HomeLoading() {
  return (
    <main id="main" className="flex-1 pb-16" aria-busy="true">
      <p role="status" className="sr-only">
        جارٍ تحميل أخبار الأبناء
      </p>
      <div className={`${container} space-y-3 pt-10`}>
        <Placeholder className="h-5 w-56" />
        <Placeholder className="h-9 w-48" />
        <Placeholder className="h-6 w-full max-w-xl" />
      </div>
      <div className={`${container} mt-8 grid gap-4 lg:grid-cols-12`}>
        <PanelLoading className="lg:col-span-7" />
        <PanelLoading className="lg:col-span-5" />
      </div>
    </main>
  );
}

function PanelLoading({ className }: { className: string }) {
  return (
    <div className={`tone space-y-4 p-6 ${className}`} aria-hidden="true">
      <Placeholder className="h-6 w-40" />
      <Placeholder className="h-5 w-full" />
      <Placeholder className="h-5 w-5/6" />
      <Placeholder className="h-5 w-2/3" />
    </div>
  );
}

function Problem({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <main id="main" className={`${container} flex-1 py-12`}>
      <h1 className="mb-4 text-[1.5rem] font-bold">أخبار الأبناء</h1>
      <div className="max-w-xl">
        <LoadProblem message={message} onRetry={onRetry} />
      </div>
    </main>
  );
}

function attendanceRate(student: DashboardStudent) {
  const a = student.attendance;
  return a.schoolDays ? Math.round(((a.present + a.late) / a.schoolDays) * 100) : 0;
}

function gradeAverage(student: DashboardStudent) {
  const g = student.grades;
  return g.length ? Math.round((g.reduce((sum, x) => sum + x.score / x.outOf, 0) / g.length) * 100) : 0;
}
