"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttendanceStatus, Student } from "@/components/dashboard/data";
import type { Preferences } from "@/components/assistant/preferences";
import { getParentClient } from "@/lib/supabase/browser";
import { PREFERENCE_COLUMNS, preferencesToRow, rowToPreferences, type PreferencesRow } from "./preferences-row";

// Everything here reads as the signed-in parent; RLS decides which students and rows come back.
// Nothing falls back to the bundled demo data: when Supabase fails, the page shows the error.

export type LinkedStudent = {
  /** Database id (uuid). */
  dbId: string;
  /** Stable key used in links, e.g. "reem". */
  id: string;
  name: string;
  firstName: string;
  grade: string;
  stage: string | null;
  classroom: string | null;
  school: string;
};

type Loaded<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** Runs `load` for `key`; a reply for an older key is dropped, so a slow request never shows another student. */
function useKeyedLoad<T>(key: string | null, load: () => Promise<T>): Loaded<T> & { reload: () => void } {
  const [state, setState] = useState<{ key: string | null; value: Loaded<T> }>({ key: null, value: { status: "loading" } });
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((n) => n + 1), []);

  useEffect(() => {
    if (key === null) return;
    let current = true;
    load().then(
      (data) => current && setState({ key, value: { status: "ready", data } }),
      (e: unknown) => current && setState({ key, value: { status: "error", message: e instanceof Error ? e.message : "تعذّر تحميل البيانات." } }),
    );
    return () => {
      current = false;
    };
    // `load` changes every render; the key and the reload round decide when to fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, round]);

  const value: Loaded<T> = state.key === key ? state.value : { status: "loading" };
  return { ...value, reload };
}

const fail = (what: string) => new Error(`تعذّر تحميل ${what} من قاعدة البيانات. تحقق من الاتصال ثم أعد المحاولة.`);

export function useLinkedStudents() {
  return useKeyedLoad<LinkedStudent[]>("linked-students", async () => {
    const { data, error } = await getParentClient()
      .from("students")
      .select("id, demo_key, full_name, first_name, grade_label, stage_label, classroom_label, school_name")
      .order("full_name");
    if (error) throw fail("قائمة الأبناء");
    return (data ?? []).map((s) => ({
      dbId: s.id,
      id: s.demo_key,
      name: s.full_name,
      firstName: s.first_name,
      grade: s.grade_label,
      stage: s.stage_label,
      classroom: s.classroom_label,
      school: s.school_name,
    }));
  });
}

export type SavedPreferences = { exists: false } | { exists: true; preferences: Preferences; updatedAt: string };

export function useStudentPreferences(dbId: string | null) {
  return useKeyedLoad<SavedPreferences>(dbId && `prefs:${dbId}`, async () => {
    const { data, error } = await getParentClient()
      .from("assistant_preferences")
      .select(PREFERENCE_COLUMNS)
      .eq("student_id", dbId)
      .maybeSingle<PreferencesRow>();
    if (error) throw fail("التفضيلات");
    return data ? { exists: true, preferences: rowToPreferences(data), updatedAt: data.updated_at ?? "" } : { exists: false };
  });
}

/** Saves to Supabase. Resolves only after the database confirmed the write. */
export async function savePreferencesToDb(dbId: string, preferences: Preferences, exists: boolean): Promise<{ ok: true } | { ok: false }> {
  const supabase = getParentClient();
  const row = preferencesToRow(preferences);
  if (exists) {
    const { data, error } = await supabase.from("assistant_preferences").update(row).eq("student_id", dbId).select("id");
    return !error && data && data.length === 1 ? { ok: true } : { ok: false };
  }
  const { error } = await supabase.from("assistant_preferences").insert({ ...row, student_id: dbId });
  if (!error) return { ok: true };
  // Saved meanwhile in another tab: update that record instead.
  if (error.code === "23505") return savePreferencesToDb(dbId, preferences, true);
  return { ok: false };
}

// ---------- the dashboard's view of one student ----------

const hijriFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
function hijri(day: string) {
  const p = Object.fromEntries(hijriFmt.formatToParts(new Date(`${day}T00:00:00Z`)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${parseInt(p.year, 10)}`;
}
const weekdayAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const monthAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const dayName = (day: string) => weekdayAr[new Date(`${day}T00:00:00Z`).getUTCDay()];
const gregorianText = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  return `${d.getUTCDate()} ${monthAr[d.getUTCMonth()]}`;
};
const timeText = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `الساعة ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "صباحًا" : "مساءً"}`;
};

export type DashboardStudent = Student & {
  /** Records added by the demo control page, so the parent can tell them apart. */
  simulated: { attendanceDays: number; exams: number; grades: number };
};

export function useDashboardStudent(student: LinkedStudent | null) {
  return useKeyedLoad<DashboardStudent>(student && `dashboard:${student.dbId}`, async () => {
    const supabase = getParentClient();
    const id = student!.dbId;
    const [terms, attendance, exams, grades, announcements] = await Promise.all([
      supabase.from("attendance_terms").select("term_label, school_days, present, absent, late, excused").eq("student_id", id),
      supabase.from("attendance_records").select("day, status, note, display_day, hijri_text, origin").eq("student_id", id).order("day"),
      supabase.from("exams").select("subject, kind, exam_date, start_time, period_label, hijri_text, status, origin").eq("student_id", id).order("exam_date"),
      supabase.from("grades").select("subject, assessment, score, out_of, published_on, hijri_text, origin").eq("student_id", id).order("published_on", { ascending: false }),
      supabase.from("announcements").select("title, body, tag, display_date, published_on").eq("student_id", id).order("published_on", { ascending: false }),
    ]);
    if (terms.error || attendance.error || exams.error || grades.error || announcements.error) throw fail("سجلات الطالب");

    const term = terms.data?.[0];
    if (!term) throw fail("ملخص الحضور");
    // Simulated days take the place of an imported record for the same day; new days are added.
    // The term totals move with them, so they always add up (never a blind increment).
    const byDay = new Map<string, { day: string; status: AttendanceStatus; note?: string; origin: string; hijri: string }>();
    const counts = { schoolDays: term.school_days, present: term.present, absent: term.absent, late: term.late, excused: term.excused };
    for (const r of attendance.data ?? []) {
      const prev = byDay.get(r.day);
      const status = r.status as AttendanceStatus;
      if (r.origin === "demo") {
        if (prev) counts[prev.status]--;
        else counts.schoolDays++;
        counts[status]++;
      }
      if (!prev || r.origin === "demo") {
        byDay.set(r.day, { day: r.day, status, note: r.note ?? undefined, origin: r.origin, hijri: r.hijri_text ?? hijri(r.day) });
      }
    }
    const week = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-5);

    const examRows = exams.data ?? [];
    const gradeRows = grades.data ?? [];
    const s = student!;
    return {
      id: s.id,
      name: s.name,
      firstName: s.firstName,
      grade: s.grade,
      stage: s.stage ?? "",
      classroom: s.classroom ?? "",
      school: s.school,
      attendance: {
        termLabel: term.term_label,
        ...counts,
        week: week.map((w) => ({
          day: dayName(w.day),
          date: w.hijri.slice(0, 5),
          status: w.status,
          note: w.origin === "demo" ? `${w.note ? `${w.note} — ` : ""}من الديمو` : w.note,
        })),
      },
      exams: examRows.map((e) => ({
        subject: e.subject,
        kind: e.status === "cancelled" ? `${e.kind} — ملغى` : e.kind,
        day: dayName(e.exam_date),
        date: gregorianText(e.exam_date),
        hijri: e.hijri_text ?? hijri(e.exam_date),
        period: e.start_time ? timeText(e.start_time) : (e.period_label ?? ""),
      })),
      grades: gradeRows.slice(0, 8).map((g) => ({
        subject: g.subject,
        assessment: g.origin === "demo" ? `${g.assessment} (من الديمو)` : g.assessment,
        score: Number(g.score),
        outOf: Number(g.out_of),
        date: g.hijri_text ?? hijri(g.published_on),
      })),
      announcements: (announcements.data ?? []).map((n) => ({ title: n.title, body: n.body, date: n.display_date ?? "", tag: n.tag ?? "" })),
      simulated: {
        attendanceDays: (attendance.data ?? []).filter((r) => r.origin === "demo").length,
        exams: examRows.filter((e) => e.origin === "demo").length,
        grades: gradeRows.filter((g) => g.origin === "demo").length,
      },
    };
  });
}
