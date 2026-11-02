import type { SupabaseClient } from "@supabase/supabase-js";

/** Archive one demo event (or all), retaining delivery attempts as an audit trail. */
export async function archiveDemoEvents(db: SupabaseClient, studentId: string, eventId?: string) {
  const events = await db.from("demo_events").select("id, kind, payload").eq("student_id", studentId).is("archived_at", null);
  if (events.error) throw new Error("تحميل الأحداث");
  const active = events.data ?? [];
  const removed = active.filter((e) => !eventId || e.id === eventId);
  const ids = removed.map((e) => e.id);
  if (!ids.length) return { cleared: 0, cancelled: 0, alreadySent: 0 };
  const kept = active.filter((e) => !ids.includes(e.id));
  const now = new Date().toISOString();
  const restoreExams = removed.filter((e) => e.kind === "exam_cancelled")
    .map((e) => (e.payload as { examId?: string }).examId)
    .filter((id): id is string => Boolean(id) && !kept.some((e) => e.kind === "exam_cancelled" && e.payload.examId === id));
  const changes = await Promise.all([
    db.from("attendance_records").update({ archived_at: now }).eq("student_id", studentId).in("demo_event_id", ids),
    db.from("grades").update({ archived_at: now }).eq("student_id", studentId).in("demo_event_id", ids),
    db.from("exams").update({ archived_at: now }).eq("student_id", studentId).in("demo_event_id", ids),
    restoreExams.length ? db.from("exams").update({ status: "scheduled" }).eq("student_id", studentId).in("id", restoreExams).is("archived_at", null) : Promise.resolve({ error: null }),
  ]);
  if (changes.some((r) => r.error)) throw new Error("حذف سجلات الحدث");

  // Deleting an accepted excuse restores the linked absence/late record when it still exists.
  // Its old notification stays cancelled: deletion must never send or recreate an alert.
  for (const event of removed.filter((e) => e.kind === "excuse_accepted")) {
    const attendanceId = event.payload.attendanceEventId;
    const original = kept.find((e) => e.id === attendanceId && e.kind === "attendance");
    const otherExcuse = kept.some((e) => e.kind === "excuse_accepted" && e.payload.attendanceEventId === attendanceId);
    if (original && !otherExcuse && ["absent", "late"].includes(original.payload.status)) {
      const restored = await db.from("attendance_records").update({ status: original.payload.status })
        .eq("student_id", studentId).eq("demo_event_id", attendanceId).eq("origin", "demo").is("archived_at", null);
      if (restored.error) throw new Error("تحديث سجل الغياب");
    }
  }
  const pending = await db.from("notifications").update({ status: "cancelled", reason: "حُذف الحدث من الديمو." })
    .eq("student_id", studentId).in("demo_event_id", ids).in("status", ["waiting", "ready", "suppressed"]).select("id");
  if (pending.error) throw new Error("إلغاء التحديثات المعلقة");
  const sent = await db.from("notifications").select("id").eq("student_id", studentId).in("demo_event_id", ids).in("status", ["sending", "accepted", "delivered"]);
  if (sent.error) throw new Error("قراءة سجل الإرسال");
  const archived = await db.from("demo_events").update({ archived_at: now }).eq("student_id", studentId).in("id", ids);
  if (archived.error) throw new Error("حذف الحدث");
  return { cleared: ids.length, cancelled: (pending.data ?? []).length, alreadySent: (sent.data ?? []).length };
}
