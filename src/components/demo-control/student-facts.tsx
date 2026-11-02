"use client";

import { useState } from "react";
import { arabicDay } from "@/lib/tammeni/evaluate";
import { api, ErrorNote } from "./shared";

type Facts = {
  as_of: string;
  records: {
    attendance_records: { day: string; status: string; origin: string; created_at: string }[];
    grades: { subject: string; assessment: string; score: number; out_of: number; published_on: string; created_at: string }[];
    exams: { subject: string; exam_date: string; status: string }[];
  };
};
const statuses: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "غياب بعذر" };

export function StudentFacts({ studentId, name }: { studentId: string; name: string }) {
  const [data, setData] = useState<Facts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    const result = await api<Facts>(`/api/demo-control/students/${studentId}/facts`);
    setLoading(false);
    if (!result.ok) return setError(result.error);
    setData(result.data);
  };
  const byDay = new Map<string, Facts["records"]["attendance_records"][number]>();
  for (const row of [...(data?.records.attendance_records ?? [])].sort((a, b) => a.day.localeCompare(b.day) || Number(a.origin === "demo") - Number(b.origin === "demo") || a.created_at.localeCompare(b.created_at))) byDay.set(row.day, row);
  const attendance = [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 5);
  const grades = [...(data?.records.grades ?? [])].sort((a, b) => b.published_on.localeCompare(a.published_on) || b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const exams = [...(data?.records.exams ?? [])].sort((a, b) => a.exam_date.localeCompare(b.exam_date));

  const section = (title: string, items: React.ReactNode[], empty: string) => (
    <section>
      <h3 className="text-[0.875rem] font-semibold text-ink-soft">{title}</h3>
      <ul className="mt-1 divide-y divide-rule text-[0.9375rem]">
        {items.length ? items : <li className="py-2 text-faint">{empty}</li>}
      </ul>
    </section>
  );

  return (
    <details className="studio-disclosure rounded-2xl bg-surface px-4 sm:px-5" onToggle={(e) => { if (e.currentTarget.open) void load(); }}>
      <summary className="text-[0.9375rem]">سجلات {name} المدرسية</summary>
      <div className="pb-5">
        <p className="text-[0.875rem] leading-6 text-faint">
          هذي السجلات اللي تقرأ منها لولوة أثناء المكالمة. قارن إجاباتها بها. تُقرأ من جديد كل ما فتحت هذا القسم.
        </p>
        {loading ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-[0.9375rem] text-ink-soft">
            <span className="spinner" aria-hidden="true" />
            جارٍ تحميل السجلات…
          </p>
        ) : error ? (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : (
          data && (
            <div className="mt-3 space-y-4">
              {section(
                "آخر أيام الحضور",
                attendance.map((a) => (
                  <li key={a.day} className="flex justify-between gap-3 py-2">
                    <span>{arabicDay(a.day)}</span>
                    <span className="font-medium">{statuses[a.status] ?? a.status}</span>
                  </li>
                )),
                "ما فيه سجلات حضور.",
              )}
              {section(
                "آخر الدرجات المنشورة",
                grades.map((g, i) => (
                  <li key={`${g.subject}-${g.assessment}-${i}`} className="flex justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{g.subject}</span>
                      <span className="block text-[0.8125rem] text-faint">
                        {g.assessment}، {arabicDay(g.published_on)}
                      </span>
                    </span>
                    <bdi dir="ltr" className="num shrink-0 font-semibold">
                      {g.score} / {g.out_of}
                    </bdi>
                  </li>
                )),
                "ما فيه درجات منشورة.",
              )}
              {section(
                "الاختبارات",
                exams.map((exam, i) => (
                  <li key={`${exam.subject}-${i}`} className="flex justify-between gap-3 py-2">
                    <span className="font-medium">{exam.subject}</span>
                    <span className="text-ink-soft">
                      {arabicDay(exam.exam_date)}
                      {exam.status === "cancelled" ? " — ملغى" : ""}
                    </span>
                  </li>
                )),
                "ما فيه اختبارات محفوظة.",
              )}
            </div>
          )
        )}
      </div>
    </details>
  );
}
