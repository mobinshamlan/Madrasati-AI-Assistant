import type { SupabaseClient } from "@supabase/supabase-js";

const sources = {
  attendance_terms: "term_label, school_days, present, absent, late, excused",
  attendance_records: "id, day, status, note, origin, created_at",
  grades: "id, subject, assessment, score, out_of, published_on, created_at",
  exams: "id, subject, exam_date, start_time, status, created_at",
  assignments: "id, subject, title, assigned_on, due_on, status",
  announcements: "id, title, body, published_on",
  online_lessons: "id, subject, lesson_date, status, duration_minutes",
} as const;

/** A fresh, student-scoped snapshot for questions during a call.
 * Notification preferences still decide whether/why/how the call starts.
 * They do not limit answers when the parent asks about another subject.
 */
export async function callStudentData(db: SupabaseClient, studentId: string, today: string) {
  const entries = await Promise.all(Object.entries(sources).map(async ([table, columns]) => {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = db.from(table).select(columns).eq("student_id", studentId);
      if (["attendance_records", "grades", "exams"].includes(table)) query = query.is("archived_at", null);
      if (table === "grades") query = query.lte("published_on", today);
      // A stable order prevents duplicates or omissions across pages.
      query = query.order(table === "attendance_terms" ? "term_label" : "id");
      const { data, error } = await query.range(offset, offset + 499);
      if (error || !data) throw new Error("تعذّر تحميل بيانات الطالب للمكالمة. أعد المحاولة.");
      rows.push(...data as unknown as Record<string, unknown>[]);
      if (data.length < 500) break;
    }
    return [table, rows] as const;
  }));
  return { student_id: studentId, as_of: new Date().toISOString(), records: Object.fromEntries(entries) };
}
