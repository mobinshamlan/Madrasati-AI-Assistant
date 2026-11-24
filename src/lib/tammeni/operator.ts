import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { planBatches, tooLate, type DueItem } from "./auto-dispatch";
import { directDemoAllowed } from "./direct-demo";
import { operatorCredentialsValid } from "./operator-access";
import { callStudentData } from "./call-student-data";
import { archiveDemoEvents } from "./archive-events";
import {
  arabicDay,
  arabicMoment,
  callOpening,
  evaluate,
  factLines,
  messageText,
  riyadhDay,
  topicOf,
  weekday,
  type ContentInput,
  type Decision,
  type SchoolEvent,
} from "./evaluate";
import { DEFAULT_ROW, PREFERENCE_COLUMNS, rowToPreferences, type PreferencesRow } from "./preferences-row";

// Local demo server only. Database credentials never leave the server. Parent RLS is unchanged.

export class OperatorError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

/** Direct server database connection; no operator account, password, session or cookie. */
export async function requireOperator(): Promise<SupabaseClient> {
  const requestHeaders = await headers();
  if (!directDemoAllowed(process.env, requestHeaders) && !operatorCredentialsValid(process.env, requestHeaders.get("authorization"))) {
    throw new OperatorError(403, "لوحة التشغيل المباشرة متاحة على هذا الجهاز في وضع التطوير فقط.");
  }
  return serverClient();
}

/** The server's own database connection. Callers must have authorised the request first. */
export function serverClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new OperatorError(503, "اتصال قاعدة بيانات الديمو غير مكتمل. أضف مفتاح Supabase الخاص بالخادم في إعدادات الموقع، ثم أعد تشغيله. لا تحتاج إلى تسجيل دخول.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

const dbFail = (what: string): never => {
  throw new OperatorError(502, `تعذّر ${what} في قاعدة البيانات. حاول مرة أخرى.`);
};

// ---------- reading ----------

export async function overview(supabase: SupabaseClient) {
  const [parents, links] = await Promise.all([
    supabase.from("parent_profiles").select("id, full_name"),
    supabase.from("parent_students").select("parent_id, students!inner (id, demo_key, full_name, first_name, grade_label, stage_label, school_name)").in("students.demo_key", ["reem", "nawaf"]),
  ]);
  if (parents.error || links.error) dbFail("تحميل ولي الأمر والأبناء");
  // The demo has one parent. Students are the ones linked to that parent (ريم and نواف).
  const parent = parents.data?.find((p) => links.data?.some((l) => l.parent_id === p.id)) ?? null;
  type S = { id: string; demo_key: string; full_name: string; first_name: string; grade_label: string; stage_label: string | null; school_name: string };
  const students = (links.data ?? [])
    .filter((l) => l.parent_id === parent?.id)
    .map((l) => l.students as unknown as S)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"))
    .map((s) => ({ id: s.id, key: s.demo_key, name: s.full_name, firstName: s.first_name, grade: s.grade_label, stage: s.stage_label, school: s.school_name }));
  return { parent: parent && { name: parent.full_name }, students };
}

async function loadStudent(supabase: SupabaseClient, studentId: string) {
  if (!/^[0-9a-f-]{36}$/.test(studentId)) throw new OperatorError(400, "طالب غير معروف.");
  const { data, error } = await supabase.from("students").select("id, demo_key, full_name, first_name").eq("id", studentId).in("demo_key", ["reem", "nawaf"]).maybeSingle();
  if (error) dbFail("تحميل الطالب");
  if (!data) throw new OperatorError(404, "هذا الطالب غير موجود في بيانات الديمو.");
  return data;
}

async function loadPreferences(supabase: SupabaseClient, studentId: string) {
  const { data, error } = await supabase.from("assistant_preferences").select(PREFERENCE_COLUMNS).eq("student_id", studentId).maybeSingle<PreferencesRow>();
  if (error) dbFail("تحميل التفضيلات");
  return data ? { preferences: rowToPreferences(data), version: data.updated_at ?? null } : { preferences: null, version: null };
}

export async function studentPanel(supabase: SupabaseClient, studentId: string) {
  const student = await loadStudent(supabase, studentId);
  const prefs = await loadPreferences(supabase, studentId);
  const [events, notifications, attempts, exams, absences, grades] = await Promise.all([
    supabase.from("demo_events").select("id, kind, event_date, summary, payload, created_at").eq("student_id", studentId).is("archived_at", null).order("created_at", { ascending: false }).limit(30),
    supabase.from("notifications").select("id, demo_event_id, topic, status, method, due_at, reason, content, window_start, window_end, prefs_version, evaluated_at").eq("student_id", studentId).order("evaluated_at", { ascending: false }).limit(40),
    supabase.from("dispatch_attempts").select("id, notification_id, kind, provider, method, destination_masked, status, provider_status, error_message, ran_early, original_due_at, triggered_by, created_at").eq("student_id", studentId).order("created_at", { ascending: false }).limit(40),
    supabase.from("exams").select("id, subject, kind, exam_date, origin").eq("student_id", studentId).eq("status", "scheduled").is("archived_at", null).order("exam_date"),
    supabase.from("attendance_records").select("demo_event_id, day, status").eq("student_id", studentId).eq("origin", "demo").is("archived_at", null).in("status", ["absent", "late"]).order("day", { ascending: false }),
    supabase.from("grades").select("subject, assessment").eq("student_id", studentId).is("archived_at", null),
  ]);
  if (events.error || notifications.error || attempts.error || exams.error || absences.error || grades.error) dbFail("تحميل أحداث الطالب");
  const byEvent = new Map((notifications.data ?? []).map((n) => [n.demo_event_id, n]));
  return {
    student: { id: student.id, key: student.demo_key, name: student.full_name, firstName: student.first_name },
    preferences: prefs.preferences,
    preferencesVersion: prefs.version,
    formOptions: {
      subjects: [...new Set([...(grades.data ?? []).map((g) => g.subject), ...(exams.data ?? []).map((e) => e.subject)])],
      assessments: [...new Set((grades.data ?? []).map((g) => g.assessment))],
      examKinds: [...new Set((exams.data ?? []).map((e) => e.kind))],
    },
    events: (events.data ?? []).map(({ payload, ...e }) => ({ ...e,
      summary: e.kind === "exam_added" ? `اختبار ${payload.subject} — ${arabicDay(payload.examDate)}` : e.summary,
      notification: byEvent.get(e.id) ?? null })),
    attempts: attempts.data ?? [],
    examsToCancel: (exams.data ?? [])
      .filter((e) => e.exam_date >= riyadhDay(new Date()))
      .map((e) => ({ id: e.id, label: `${e.subject} (${e.kind}) — ${arabicDay(e.exam_date)}`, examDate: e.exam_date })),
    absencesToExcuse: (absences.data ?? []).map((a) => ({ eventId: a.demo_event_id as string, label: `${a.status === "absent" ? "غياب" : "تأخر"} يوم ${arabicDay(a.day)}` })),
  };
}

/** Read the very same current records supplied to a new call, for demo verification. */
export async function studentCallFacts(supabase: SupabaseClient, studentId: string) {
  await loadStudent(supabase, studentId);
  return callStudentData(supabase, studentId, riyadhDay(new Date()));
}

// ---------- recording an event ----------

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim().length >= 1 && v.trim().length <= max ? v.trim() : null);
const statusLabel = { present: "حضور", absent: "غياب", late: "تأخر", excused: "غياب بعذر" } as const;

type EventInput =
  | { kind: "attendance"; date: string; status: keyof typeof statusLabel }
  | { kind: "grade_published"; date: string; subject: string; assessment: string; score: number; outOf: number }
  | { kind: "exam_added"; date: string; examDate: string; startTime: string | null; subject: string; examKind: string }
  | { kind: "exam_cancelled"; date: string; examId: string }
  | { kind: "excuse_accepted"; date: string; attendanceEventId: string };

/** Checks everything the operator typed. Throws a 400 with a plain Arabic message. */
export function parseEventInput(raw: Record<string, unknown>): EventInput {
  const bad = (m: string): never => {
    throw new OperatorError(400, m);
  };
  const date = isDay(raw.date) ? raw.date : bad("اختر تاريخًا صحيحًا.");
  switch (raw.kind) {
    case "attendance": {
      const status = raw.status as string;
      if (!(status in statusLabel)) bad("اختر حالة الحضور.");
      return { kind: "attendance", date, status: status as keyof typeof statusLabel };
    }
    case "grade_published": {
      const subject = text(raw.subject, 80) ?? bad("اكتب اسم المادة.");
      const assessment = text(raw.assessment, 120) ?? bad("اكتب اسم التقييم.");
      const outOf = Number(raw.outOf);
      const score = Number(raw.score);
      if (!Number.isFinite(outOf) || outOf <= 0 || outOf > 1000) bad("الدرجة الكاملة يجب أن تكون أكبر من صفر.");
      if (!Number.isFinite(score) || score < 0 || score > outOf) bad("الدرجة يجب أن تكون بين صفر والدرجة الكاملة.");
      return { kind: "grade_published", date, subject, assessment, score: Math.round(score * 100) / 100, outOf: Math.round(outOf * 100) / 100 };
    }
    case "exam_added": {
      const subject = text(raw.subject, 80) ?? bad("اكتب اسم المادة.");
      const examKind = text(raw.examKind, 80) ?? bad("اكتب نوع الاختبار.");
      const examDate = isDay(raw.examDate) ? raw.examDate : bad("اختر تاريخ الاختبار.");
      const startTime = raw.startTime ? (isTime(raw.startTime) ? raw.startTime : bad("وقت الاختبار غير صحيح.")) : null;
      return { kind: "exam_added", date, examDate, startTime, subject, examKind };
    }
    case "exam_cancelled":
      return { kind: "exam_cancelled", date, examId: typeof raw.examId === "string" && /^[0-9a-f-]{36}$/.test(raw.examId) ? raw.examId : bad("اختر الاختبار المراد إلغاؤه.") };
    case "excuse_accepted":
      return {
        kind: "excuse_accepted",
        date,
        attendanceEventId:
          typeof raw.attendanceEventId === "string" && /^[0-9a-f-]{36}$/.test(raw.attendanceEventId) ? raw.attendanceEventId : bad("اختر الغياب الذي قُبل عذره."),
      };
    default:
      return bad("نوع الحدث غير معروف.");
  }
}

const checkKey = (k: unknown) => {
  if (typeof k !== "string" || k.length < 8 || k.length > 100) throw new OperatorError(400, "طلب غير مكتمل؛ أعد تحميل الصفحة.");
  return k;
};

/** Saves the event and its school record, then evaluates it against the latest saved preferences. */
export async function recordEvent(supabase: SupabaseClient, studentId: string, raw: Record<string, unknown>, idempotencyKey: unknown) {
  const key = checkKey(idempotencyKey);
  const student = await loadStudent(supabase, studentId);
  const input = parseEventInput(raw);

  // The same submit (double click, retried request) returns the first result instead of a copy.
  const existing = await supabase.from("demo_events").select("id").eq("idempotency_key", key).maybeSingle();
  if (existing.error) dbFail("التحقق من الحدث");
  if (existing.data) return { duplicate: true, ...(await eventResult(supabase, existing.data.id)) };

  let payload: Record<string, unknown>;
  let summary: string;
  let schoolEvent: SchoolEvent | null = null;
  let cancelExam: { id: string; origin: string } | null = null;
  let excuse: { recordEventId: string } | null = null;

  if (input.kind === "attendance") {
    // Friday and Saturday are the Saudi weekend: no school day to record.
    if (weekday(input.date) === 5 || weekday(input.date) === 6) throw new OperatorError(400, "هذا اليوم إجازة نهاية الأسبوع. اختر يومًا دراسيًا.");
    const clash = await supabase.from("attendance_records").select("id").eq("student_id", studentId).eq("origin", "demo").eq("day", input.date).is("archived_at", null).maybeSingle();
    if (clash.error) dbFail("التحقق من الحضور");
    if (clash.data) throw new OperatorError(409, "يوجد حدث حضور تجريبي لهذا اليوم. امسح أحداث المحاكاة أو اختر يومًا آخر.");
    payload = { status: input.status };
    summary = `${statusLabel[input.status]} — ${arabicDay(input.date)}`;
    schoolEvent = { kind: "attendance", date: input.date, status: input.status };
  } else if (input.kind === "grade_published") {
    payload = { subject: input.subject, assessment: input.assessment, score: input.score, outOf: input.outOf };
    summary = `درجة ${input.subject}: ${input.assessment} (${input.score} من ${input.outOf})`;
    schoolEvent = input;
  } else if (input.kind === "exam_added") {
    payload = { subject: input.subject, examKind: input.examKind, examDate: input.examDate, startTime: input.startTime };
    summary = `اختبار ${input.subject} — ${arabicDay(input.examDate)}`;
    schoolEvent = { kind: "exam_added", date: input.date, examDate: input.examDate, startTime: input.startTime, subject: input.subject, examKind: input.examKind };
  } else if (input.kind === "exam_cancelled") {
    const exam = await supabase.from("exams").select("id, subject, kind, exam_date, origin, status").eq("id", input.examId).eq("student_id", studentId).maybeSingle();
    if (exam.error) dbFail("تحميل الاختبار");
    if (!exam.data || exam.data.status !== "scheduled") throw new OperatorError(409, "هذا الاختبار غير موجود أو أُلغي سابقًا.");
    payload = { examId: exam.data.id, subject: exam.data.subject, examKind: exam.data.kind, examDate: exam.data.exam_date };
    summary = `إلغاء اختبار ${exam.data.subject} — ${arabicDay(exam.data.exam_date)}`;
    schoolEvent = { kind: "exam_cancelled", date: input.date, examDate: exam.data.exam_date, subject: exam.data.subject, examKind: exam.data.kind };
    cancelExam = { id: exam.data.id, origin: exam.data.origin };
  } else {
    const rec = await supabase.from("attendance_records").select("id, day, status").eq("demo_event_id", input.attendanceEventId).eq("student_id", studentId).is("archived_at", null).maybeSingle();
    if (rec.error) dbFail("تحميل سجل الغياب");
    if (!rec.data || (rec.data.status !== "absent" && rec.data.status !== "late")) throw new OperatorError(409, "لا يوجد غياب تجريبي نشط بهذا الرقم.");
    payload = { attendanceEventId: input.attendanceEventId, day: rec.data.day };
    summary = `قبول عذر — ${arabicDay(rec.data.day)}`;
    excuse = { recordEventId: input.attendanceEventId };
  }

  const inserted = await supabase
    .from("demo_events")
    .insert({ student_id: studentId, kind: input.kind, event_date: input.date, payload, summary, idempotency_key: key })
    .select("id")
    .single();
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const again = await supabase.from("demo_events").select("id").eq("idempotency_key", key).single();
      if (!again.error) return { duplicate: true, ...(await eventResult(supabase, again.data.id)) };
    }
    dbFail("حفظ الحدث");
  }
  const eventId = inserted.data!.id as string;

  // The school record the parent's dashboard shows.
  if (input.kind === "attendance") {
    const r = await supabase.from("attendance_records").insert({ student_id: studentId, day: input.date, status: input.status, origin: "demo", demo_event_id: eventId });
    if (r.error) dbFail("حفظ سجل الحضور");
  } else if (input.kind === "grade_published") {
    const r = await supabase.from("grades").insert({
      student_id: studentId, subject: input.subject, assessment: input.assessment, score: input.score, out_of: input.outOf,
      published_on: input.date, origin: "demo", demo_event_id: eventId,
    });
    if (r.error) dbFail("حفظ الدرجة");
  } else if (input.kind === "exam_added") {
    const r = await supabase.from("exams").insert({
      student_id: studentId, subject: input.subject, kind: input.examKind, exam_date: input.examDate, start_time: input.startTime,
      status: "scheduled", origin: "demo", demo_event_id: eventId,
    });
    if (r.error) dbFail("حفظ الاختبار");
  } else if (cancelExam) {
    const r = await supabase.from("exams").update({ status: "cancelled" }).eq("id", cancelExam.id);
    if (r.error) dbFail("إلغاء الاختبار");
    // A reminder still waiting for this exam is no longer wanted.
    const added = await supabase.from("exams").select("demo_event_id").eq("id", cancelExam.id).maybeSingle();
    if (added.data?.demo_event_id) await cancelPending(supabase, added.data.demo_event_id, "أُلغي الاختبار؛ أُلغي تذكيره.");
  }

  if (excuse) {
    const r = await supabase.from("attendance_records").update({ status: "excused" }).eq("demo_event_id", excuse.recordEventId).eq("origin", "demo");
    if (r.error) dbFail("تحديث الغياب");
    const cancelled = await cancelPending(supabase, excuse.recordEventId, "قُبل العذر قبل الإرسال؛ أُلغي تحديث الغياب.");
    return { duplicate: false, event: { id: eventId, kind: input.kind, summary }, notification: null, excuse: cancelled };
  }

  await saveDecision(supabase, studentId, eventId, schoolEvent!, student, "create");
  return { duplicate: false, ...(await eventResult(supabase, eventId)) };
}

async function cancelPending(supabase: SupabaseClient, eventId: string, reason: string) {
  const n = await supabase.from("notifications").select("id, status").eq("demo_event_id", eventId).maybeSingle();
  if (n.error) dbFail("تحميل التحديث");
  if (!n.data) return { outcome: "none" as const };
  if (["waiting", "ready", "suppressed"].includes(n.data.status)) {
    const u = await supabase.from("notifications").update({ status: "cancelled", reason }).eq("id", n.data.id);
    if (u.error) dbFail("إلغاء التحديث");
    return { outcome: "cancelled" as const };
  }
  // Already handed to a provider: nothing can be pulled back from here.
  return { outcome: "already-sent" as const, status: n.data.status };
}

async function eventResult(supabase: SupabaseClient, eventId: string) {
  const [e, n] = await Promise.all([
    supabase.from("demo_events").select("id, kind, summary").eq("id", eventId).single(),
    supabase.from("notifications").select("id, topic, status, method, due_at, reason, content").eq("demo_event_id", eventId).maybeSingle(),
  ]);
  if (e.error || n.error) dbFail("تحميل نتيجة الحدث");
  return { event: e.data, notification: n.data && { ...n.data, dueLabel: n.data.due_at ? arabicMoment(n.data.due_at) : null } };
}

// ---------- evaluating ----------

function toSchoolEvent(kind: string, eventDate: string, payload: Record<string, unknown>): SchoolEvent {
  const p = payload as Record<string, never>;
  if (kind === "attendance") return { kind, date: eventDate, status: p.status };
  if (kind === "grade_published") return { kind, date: eventDate, subject: p.subject, assessment: p.assessment, score: Number(p.score), outOf: Number(p.outOf) };
  if (kind === "exam_added") return { kind, date: eventDate, examDate: p.examDate, startTime: p.startTime ?? null, subject: p.subject, examKind: p.examKind };
  if (kind === "exam_cancelled") return { kind, date: eventDate, examDate: p.examDate, subject: p.subject, examKind: p.examKind };
  throw new OperatorError(400, "هذا الحدث لا ينتج تحديثًا.");
}

async function contentFor(supabase: SupabaseClient, studentId: string, student: { full_name: string; first_name: string }, event: SchoolEvent, decision: Decision): Promise<ContentInput> {
  const input: ContentInput = { student: { fullName: student.full_name, firstName: student.first_name }, event, decision };
  if (decision.window) {
    // Monthly summary: only the grades published in its own month, never every old grade.
    const g = await supabase
      .from("grades")
      .select("subject, assessment, score, out_of, published_on")
      .eq("student_id", studentId)
      .is("archived_at", null)
      .gte("published_on", decision.window.start)
      .lte("published_on", decision.window.end)
      .order("published_on");
    if (g.error) dbFail("تحميل درجات الشهر");
    input.monthGrades = (g.data ?? []).map((x) => ({ subject: x.subject, assessment: x.assessment, score: Number(x.score), outOf: Number(x.out_of), date: x.published_on }));
  }
  return input;
}

/** Evaluates with the latest saved preferences and stores the decision. */
async function saveDecision(
  supabase: SupabaseClient,
  studentId: string,
  eventId: string,
  event: SchoolEvent,
  student: { full_name: string; first_name: string },
  mode: "create" | "update",
  notificationId?: string,
  onlyIfPending = false,
) {
  const prefs = await loadPreferences(supabase, studentId);
  const decision = evaluate(event, prefs.preferences, new Date());
  const input = await contentFor(supabase, studentId, student, event, decision);
  const row = {
    status: decision.status,
    method: decision.method,
    due_at: decision.dueAt,
    reason: decision.reason,
    content: decision.status === "suppressed" ? null : decision.method === "call" ? callOpening(input) : messageText(input),
    window_start: decision.window?.start ?? null,
    window_end: decision.window?.end ?? null,
    prefs_version: prefs.version,
    evaluated_at: new Date().toISOString(),
  };
  if (mode === "create") {
    const r = await supabase.from("notifications").insert({ ...row, student_id: studentId, demo_event_id: eventId, topic: topicOf(event) });
    if (r.error) dbFail("حفظ نتيجة التقييم");
  } else {
    const update = supabase.from("notifications").update(row).eq("id", notificationId!);
    // The scheduler must never overwrite an update another run has claimed in the meantime.
    const r = await (onlyIfPending ? update.in("status", PENDING) : update);
    if (r.error) dbFail("تحديث نتيجة التقييم");
  }
  return { decision, input, prefsVersion: prefs.version, preferences: prefs.preferences };
}

async function loadNotification(supabase: SupabaseClient, notificationId: string) {
  if (!/^[0-9a-f-]{36}$/.test(notificationId)) throw new OperatorError(400, "تحديث غير معروف.");
  const n = await supabase.from("notifications").select("id, student_id, demo_event_id, status, method, due_at, prefs_version").eq("id", notificationId).maybeSingle();
  if (n.error) dbFail("تحميل التحديث");
  if (!n.data) throw new OperatorError(404, "هذا التحديث غير موجود.");
  const e = await supabase.from("demo_events").select("kind, event_date, payload, archived_at").eq("id", n.data.demo_event_id).single();
  if (e.error || !e.data) return dbFail("تحميل الحدث");
  if (e.data.archived_at) throw new OperatorError(409, "هذا الحدث مُسح من المحاكاة.");
  const student = await loadStudent(supabase, n.data.student_id);
  return { n: n.data, event: toSchoolEvent(e.data.kind, e.data.event_date, e.data.payload), student };
}

const FINAL = new Set(["sending", "accepted", "delivered", "failed", "cancelled"]);
const PENDING = ["waiting", "ready", "suppressed"];

/** «معاينة التحديث»: re-evaluates with the latest saved preferences and shows exactly what would go out. */
export async function previewNotification(supabase: SupabaseClient, notificationId: string) {
  const { n, event, student } = await loadNotification(supabase, notificationId);
  if (FINAL.has(n.status)) {
    const prefs = await loadPreferences(supabase, n.student_id);
    const decision = evaluate(event, prefs.preferences, new Date());
    const input = await contentFor(supabase, n.student_id, student, event, decision);
    const note = n.status === "cancelled" ? "أُلغي هذا التحديث."
      : n.status === "failed" ? "فشلت محاولة الإرسال السابقة."
      : n.status === "sending" ? "طلب الإرسال قيد التنفيذ."
      : "أُرسل طلب هذا التحديث سابقًا؛ راجع سجل الإرسال لمعرفة النتيجة.";
    return describe(n.status, decision, input, prefs.version, note);
  }
  const { decision, input, prefsVersion } = await saveDecision(supabase, n.student_id, n.demo_event_id, event, student, "update", n.id);
  return describe(decision.status, decision, input, prefsVersion);
}

function describe(status: string, decision: Decision, input: ContentInput, prefsVersion: string | null, note?: string) {
  return {
    status,
    method: decision.method,
    reason: decision.reason,
    dueLabel: decision.dueAt ? arabicMoment(decision.dueAt) : null,
    window: decision.window && { start: arabicDay(decision.window.start), end: arabicDay(decision.window.end) },
    message: decision.status === "suppressed" ? null : messageText(input),
    callOpening: decision.status === "suppressed" ? null : callOpening(input),
    facts: factLines(input),
    prefsVersion,
    note: note ?? null,
  };
}

// ---------- running (demo) ----------

type DispatchResult = {
  provider: "mock" | "twilio";
  status: "accepted" | "failed";
  provider_sid?: string | null;
  provider_status?: string | null;
  to_masked?: string | null;
  error?: string | null;
};

async function callBackend(path: string, body: Record<string, unknown>): Promise<DispatchResult> {
  const secret = process.env.TAMMENI_DISPATCH_SECRET;
  if (!secret) throw new OperatorError(503, "سر الإرسال غير مضبوط على الخادم (TAMMENI_DISPATCH_SECRET).");
  const base = process.env.TAMMENI_BACKEND_URL || "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(new URL(path, base), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tammeni-Dispatch-Secret": secret },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new OperatorError(503, "تعذّر الوصول إلى خادم طمّني (Python). تأكد من تشغيله.");
  }
  const data = (await response.json().catch(() => null)) as (DispatchResult & { detail?: unknown }) | null;
  if (!response.ok || !data) {
    const detail = data && typeof data.detail === "string" ? data.detail : null;
    throw new OperatorError(502, detail ?? `رفض خادم طمّني الطلب (HTTP ${response.status}).`);
  }
  return data;
}

/**
 * «تشغيل التحديث الآن — للديمو». Skips only the waiting time (the original time is recorded). It never
 * skips a topic that is off, a cancelled update, access rules, or a preference change since the preview.
 */
export async function runNotification(
  supabase: SupabaseClient,
  notificationId: string,
  opts: { idempotencyKey: unknown; prefsVersion: unknown; resendOf?: unknown; forceMock?: boolean },
) {
  const key = checkKey(opts.idempotencyKey);
  const { n, event, student } = await loadNotification(supabase, notificationId);

  // The same click or a retried request returns the same attempt.
  const same = await supabase.from("dispatch_attempts").select("id, status, provider, provider_status, destination_masked, error_message").eq("idempotency_key", key).maybeSingle();
  if (same.error) dbFail("التحقق من المحاولة");
  if (same.data) return { duplicate: true, attempt: same.data };

  const resendOf = typeof opts.resendOf === "string" && /^[0-9a-f-]{36}$/.test(opts.resendOf) ? opts.resendOf : null;
  if (n.status === "cancelled") throw new OperatorError(409, "أُلغي هذا التحديث، فلا يُرسل.");
  if (!resendOf && ["sending", "accepted", "delivered"].includes(n.status)) {
    throw new OperatorError(409, "أُرسل هذا التحديث سابقًا. لإعادة الإرسال استخدم «إعادة إرسال مقصودة».");
  }
  if (!resendOf && n.status === "failed") {
    throw new OperatorError(409, "فشلت المحاولة السابقة. استخدم «إعادة المحاولة» بجانبها في سجل المحاولات.");
  }
  if (resendOf) {
    const prev = await supabase.from("dispatch_attempts").select("id").eq("id", resendOf).eq("notification_id", n.id).maybeSingle();
    if (prev.error || !prev.data) throw new OperatorError(400, "لا توجد محاولة سابقة لإعادة إرسالها.");
  }

  // Always the latest saved preferences. A change since the preview means: look again first.
  const { decision, input, prefsVersion } = await saveDecision(supabase, n.student_id, n.demo_event_id, event, student, "update", n.id);
  if ((opts.prefsVersion ?? null) !== prefsVersion) {
    throw new OperatorError(409, "تغيّرت تفضيلات ولي الأمر بعد المعاينة. راجع المعاينة الجديدة ثم شغّل مرة أخرى.", {
      changed: true,
      preview: describe(decision.status, decision, input, prefsVersion),
    });
  }
  if (decision.status === "suppressed") throw new OperatorError(422, `لن يُرسل: ${decision.reason}`);

  return deliver(supabase, { n, student, decision, input, key, resendOf, ranEarly: decision.status === "waiting", triggeredBy: "operator", forceMock: Boolean(opts.forceMock) });
}

/** Records one attempt, then hands it to the provider. The unique indexes make a second send impossible. */
async function deliver(
  supabase: SupabaseClient,
  { n, student, decision, input, key, resendOf, ranEarly, triggeredBy, forceMock, backendMock = false }: {
    n: { id: string; student_id: string };
    student: Awaited<ReturnType<typeof loadStudent>>;
    decision: Decision;
    input: ContentInput;
    key: string;
    resendOf: string | null;
    ranEarly: boolean;
    triggeredBy: "operator" | "scheduler";
    forceMock: boolean;
    /** Go through the backend but make it answer as the mock provider. It can never reach Twilio. */
    backendMock?: boolean;
  },
) {
  const content = decision.method === "call" ? callOpening(input) : messageText(input);
  // Load before creating an attempt: a data outage must not start a call with stale facts.
  let conversationData = null;
  if (decision.method === "call") {
    try {
      conversationData = await callStudentData(supabase, n.student_id, riyadhDay(new Date()));
    } catch {
      throw new OperatorError(503, "تعذّر تحميل بيانات الطالب للمكالمة. أعد المحاولة.");
    }
  }
  const attempt = await supabase
    .from("dispatch_attempts")
    .insert({
      notification_id: n.id,
      student_id: n.student_id,
      idempotency_key: key,
      kind: resendOf ? "resend" : "send",
      resend_of: resendOf,
      // Corrected below to the provider the backend actually used.
      provider: "mock",
      method: decision.method,
      status: "sending",
      triggered_by: triggeredBy,
      ran_early: ranEarly,
      original_due_at: decision.dueAt,
      content,
    })
    .select("id")
    .single();
  if (attempt.error) {
    if (attempt.error.code === "23505") throw new OperatorError(409, "أُرسل هذا التحديث سابقًا.");
    dbFail("تسجيل المحاولة");
  }
  const attemptId = attempt.data!.id as string;
  await supabase.from("notifications").update({ status: "sending" }).eq("id", n.id);

  // The opening stays about the event; calls also carry current records for follow-up questions.
  const token = randomBytes(32).toString("base64url");
  const context = {
    version: 1,
    persona: "lulwa",
    student: { id: n.student_id, key: student.demo_key, first_name: student.first_name, full_name: student.full_name },
    topic: decision.topic,
    allowed_topics: [decision.topic],
    method: decision.method,
    facts: factLines(input),
    message: messageText(input),
    opening: callOpening(input),
    ...(conversationData ? { conversation_data: conversationData } : {}),
    retry_unanswered_call: decision.method === "call" ? Boolean((await loadPreferences(supabase, n.student_id)).preferences?.retryUnansweredCall) : false,
    attempt_id: attemptId,
  };
  const stored = await supabase.from("call_contexts").insert({
    token_hash: createHash("sha256").update(token).digest("hex"),
    attempt_id: attemptId,
    context,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (stored.error) {
    await supabase.from("dispatch_attempts").update({ status: "failed", error_message: "تعذّر حفظ سياق التحديث." }).eq("id", attemptId);
    await supabase.from("notifications").update({ status: "failed" }).eq("id", n.id);
    dbFail("حفظ سياق التحديث");
  }

  let result: DispatchResult;
  try {
    // Shared-demo sessions never reach the provider. The mock result is built here so a tunnel
    // visitor cannot cause Twilio even if the Python process is set to twilio.
    result = forceMock
      ? {
          provider: "mock",
          status: "accepted",
          provider_sid: `MOCK-${randomBytes(12).toString("hex")}`,
          provider_status: "mock-accepted",
          to_masked: null,
          error: null,
        }
      : await callBackend("/api/notify/dispatch", { token, method: decision.method, idempotency_key: key, force_mock: backendMock });
  } catch (e) {
    const message = e instanceof Error ? e.message : "فشل الإرسال.";
    await supabase.from("dispatch_attempts").update({ status: "failed", error_message: message }).eq("id", attemptId);
    await supabase.from("notifications").update({ status: "failed" }).eq("id", n.id);
    throw e;
  }
  const status = result.status === "accepted" ? "accepted" : "failed";
  await supabase
    .from("dispatch_attempts")
    .update({
      status,
      provider: result.provider === "twilio" ? "twilio" : "mock",
      provider_sid: result.provider_sid ?? null,
      provider_status: result.provider_status ?? null,
      destination_masked: result.to_masked ?? null,
      error_message: result.error ?? null,
    })
    .eq("id", attemptId);
  await supabase.from("notifications").update({ status }).eq("id", n.id);
  return {
    duplicate: false,
    attempt: { id: attemptId, status, provider: result.provider, provider_status: result.provider_status ?? null, destination_masked: result.to_masked ?? null, error_message: result.error ?? null },
    ranEarly,
    originalDue: decision.dueAt ? arabicMoment(decision.dueAt) : null,
  };
}

/** Asks the provider for the latest status. "Delivered" is shown only when the provider reports it. */
export async function refreshAttempt(supabase: SupabaseClient, attemptId: string) {
  if (!/^[0-9a-f-]{36}$/.test(attemptId)) throw new OperatorError(400, "محاولة غير معروفة.");
  const a = await supabase.from("dispatch_attempts").select("id, notification_id, provider, method, provider_sid, status").eq("id", attemptId).maybeSingle();
  if (a.error) dbFail("تحميل المحاولة");
  if (!a.data) throw new OperatorError(404, "هذه المحاولة غير موجودة.");
  if (!a.data.provider_sid) throw new OperatorError(409, "لا يوجد رقم مرجعي لدى المزود لهذه المحاولة.");
  const result = (await callBackend("/api/notify/status", { provider_sid: a.data.provider_sid, method: a.data.method })) as DispatchResult & { status: string };
  const status = ["accepted", "delivered", "failed"].includes(result.status) ? result.status : a.data.status;
  await supabase.from("dispatch_attempts").update({ status, provider_status: result.provider_status ?? null, error_message: result.error ?? null }).eq("id", attemptId);
  await supabase.from("notifications").update({ status }).eq("id", a.data.notification_id);
  return { status, provider_status: result.provider_status ?? null };
}

// ---------- automatic dispatch ----------

type DueRow = { id: string; student_id: string; demo_event_id: string; topic: string; status: string; method: string | null; due_at: string | null };
type Loaded = { student: Awaited<ReturnType<typeof loadStudent>>; prefs: Awaited<ReturnType<typeof loadPreferences>> };
type Report = { sent: number; failed: number; rescheduled: number; suppressed: number; tooLate: number; deferred: number; released: number; providers: string[] };

const CLAIM_EXPIRES_MS = 5 * 60 * 1000;
const sameInstant = (a: string | null, b: string | null) => (a && b ? Date.parse(a) === Date.parse(b) : a === b);

/**
 * One scheduler run: sends every update that is due under the parent's latest saved preferences.
 * Safe to run repeatedly or concurrently. Each update is claimed atomically before anything is sent,
 * and the database allows one send per update. A failed send is never retried automatically: a call
 * may already have rung, so only an operator can send it again.
 */
export async function runDueNotifications(
  supabase: SupabaseClient,
  opts: { real: boolean; maxLateMs: number; maxBatches: number; budgetMs: number },
) {
  const started = Date.now();
  const now = new Date();
  const report: Report = { sent: 0, failed: 0, rescheduled: 0, suppressed: 0, tooLate: 0, deferred: 0, released: await releaseAbandonedClaims(supabase, now), providers: [] };

  const pending = await supabase.from("notifications").select("id, student_id, demo_event_id, topic, status, method, due_at").in("status", PENDING).order("evaluated_at", { ascending: false }).limit(200);
  if (pending.error) dbFail("تحميل التحديثات المستحقة");
  const rows = (pending.data ?? []) as DueRow[];
  if (rows.length === 0) return report;
  const events = await supabase.from("demo_events").select("id, kind, event_date, payload, archived_at, created_at").in("id", rows.map((r) => r.demo_event_id));
  if (events.error) dbFail("تحميل الأحداث");
  const eventById = new Map((events.data ?? []).map((e) => [e.id as string, e]));

  const loaded = new Map<string, Loaded>();
  for (const studentId of new Set(rows.map((r) => r.student_id))) {
    loaded.set(studentId, { student: await loadStudent(supabase, studentId), prefs: await loadPreferences(supabase, studentId) });
  }

  const due: (DueItem & { row: DueRow; event: SchoolEvent })[] = [];
  for (const row of rows) {
    const e = eventById.get(row.demo_event_id);
    if (!e || e.archived_at) continue;
    const { student, prefs } = loaded.get(row.student_id)!;
    const event = toSchoolEvent(e.kind, e.event_date, e.payload);
    // Always the latest saved preferences, never the decision stored when the event was recorded.
    const decision = evaluate(event, prefs.preferences, now);
    const moved = decision.status !== row.status || decision.method !== row.method || !sameInstant(decision.dueAt, row.due_at);
    if (decision.status !== "ready") {
      if (moved) {
        await saveDecision(supabase, row.student_id, row.demo_event_id, event, student, "update", row.id, true);
        if (decision.status === "suppressed") report.suppressed += 1;
        else report.rescheduled += 1;
      }
      continue;
    }
    if (tooLate(decision, Date.parse(e.created_at), now, opts.maxLateMs)) {
      report.tooLate += 1;
      continue;
    }
    if (row.status === "suppressed") await saveDecision(supabase, row.student_id, row.demo_event_id, event, student, "update", row.id, true);
    due.push({ id: row.id, studentId: row.student_id, topic: decision.topic, eventDate: e.event_date, decision, prefsVersion: prefs.version, row, event });
  }

  const batches = planBatches(due);
  report.deferred += Math.max(0, batches.length - opts.maxBatches);
  for (const batch of batches.slice(0, opts.maxBatches)) {
    if (Date.now() - started > opts.budgetMs) {
      report.deferred += 1;
      continue;
    }
    await sendBatch(supabase, batch.primary, batch.members, loaded.get(batch.primary.studentId)!, opts.real, report);
  }
  return report;
}

async function sendBatch(
  supabase: SupabaseClient,
  primary: DueItem & { row: DueRow; event: SchoolEvent },
  members: (DueItem & { row: DueRow; event: SchoolEvent })[],
  { student }: Loaded,
  real: boolean,
  report: Report,
) {
  const claimedAt = new Date().toISOString();
  const release = async (ids: string[]) => {
    await supabase.from("notifications").update({ status: "ready", auto_claimed_at: null, covered_by: null }).in("id", ids).eq("status", "sending");
  };

  // Whoever flips the status first owns this update; every other run gets no row back and moves on.
  const claim = await supabase.from("notifications").update({ status: "sending", auto_claimed_at: claimedAt }).eq("id", primary.id).in("status", ["waiting", "ready"]).select("id");
  if (claim.error) dbFail("حجز التحديث");
  if ((claim.data ?? []).length === 0) return;

  // Last look: a parent who saved in the last moments is honoured on the next run.
  const latest = await loadPreferences(supabase, primary.studentId);
  if (latest.version !== primary.prefsVersion) {
    await release([primary.id]);
    report.deferred += 1;
    return;
  }

  let covered: typeof members = [];
  if (members.length > 0) {
    const m = await supabase.from("notifications").update({ status: "sending", auto_claimed_at: claimedAt, covered_by: primary.id }).in("id", members.map((x) => x.id)).in("status", ["waiting", "ready"]).select("id");
    if (m.error) {
      await release([primary.id]);
      dbFail("حجز الملخص");
    }
    const ids = new Set((m.data ?? []).map((x) => x.id));
    covered = members.filter((x) => ids.has(x.id));
  }
  const group = [primary.id, ...covered.map((x) => x.id)];
  const coveredIds = group.slice(1);

  try {
    const input = await contentFor(supabase, primary.studentId, { full_name: student.full_name, first_name: student.first_name }, primary.event, primary.decision);
    if (primary.event.kind === "attendance" && covered.length > 0) {
      input.attendanceDays = [primary, ...covered]
        .map((x) => x.event as Extract<SchoolEvent, { kind: "attendance" }>)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((x) => ({ date: x.date, status: x.status }));
    }
    const { decision } = primary;
    await supabase.from("notifications").update({
      method: decision.method,
      due_at: decision.dueAt,
      reason: decision.reason,
      content: decision.method === "call" ? callOpening(input) : messageText(input),
      window_start: decision.window?.start ?? null,
      window_end: decision.window?.end ?? null,
      prefs_version: primary.prefsVersion,
      evaluated_at: new Date().toISOString(),
    }).eq("id", primary.id);

    const result = await deliver(supabase, {
      n: { id: primary.id, student_id: primary.studentId },
      student,
      decision,
      input,
      key: `auto:${primary.id}`,
      resendOf: null,
      ranEarly: false,
      triggeredBy: "scheduler",
      forceMock: false,
      backendMock: !real,
    });
    if (coveredIds.length > 0) {
      await supabase.from("notifications").update({ status: result.attempt.status, reason: "أُرسل ضمن ملخص واحد مع تحديثات نفس الموعد." }).in("id", coveredIds);
    }
    if (result.attempt.status === "failed") report.failed += 1;
    else report.sent += 1;
    if (result.attempt.provider && !report.providers.includes(result.attempt.provider)) report.providers.push(result.attempt.provider);
  } catch (error) {
    const attempt = await supabase.from("dispatch_attempts").select("status").eq("notification_id", primary.id).eq("kind", "send").maybeSingle();
    if (attempt.data) {
      // It reached the attempt stage, so the outcome stands and the group is not sent again.
      await supabase.from("notifications").update({ status: attempt.data.status }).in("id", group);
      if (attempt.data.status === "failed") report.failed += 1;
    } else if (attempt.error) {
      throw error;
    } else {
      await release(group);
      report.deferred += 1;
    }
  }
}

/** A run that died after claiming but before recording an attempt sent nothing, so its claim can go back. */
async function releaseAbandonedClaims(supabase: SupabaseClient, now: Date) {
  const cutoff = new Date(now.getTime() - CLAIM_EXPIRES_MS).toISOString();
  const stale = await supabase.from("notifications").select("id, covered_by").eq("status", "sending").lt("auto_claimed_at", cutoff);
  if (stale.error) dbFail("مراجعة الحجوزات");
  const rows = stale.data ?? [];
  if (rows.length === 0) return 0;
  const attempts = await supabase.from("dispatch_attempts").select("notification_id").eq("kind", "send").in("notification_id", rows.map((r) => (r.covered_by ?? r.id) as string));
  if (attempts.error) dbFail("مراجعة المحاولات");
  const attempted = new Set((attempts.data ?? []).map((a) => a.notification_id));
  const ids = rows.filter((r) => !attempted.has(r.covered_by ?? r.id)).map((r) => r.id as string);
  if (ids.length === 0) return 0;
  const r = await supabase.from("notifications").update({ status: "ready", auto_claimed_at: null, covered_by: null }).in("id", ids).eq("status", "sending");
  if (r.error) dbFail("تحرير الحجوزات");
  return ids.length;
}

// ---------- resets ----------

/** Puts this one student's preferences back to the defaults. Other children and records are untouched. */
export async function resetPreferences(supabase: SupabaseClient, studentId: string) {
  await loadStudent(supabase, studentId);
  const r = await supabase.from("assistant_preferences").update(DEFAULT_ROW).eq("student_id", studentId).select("id");
  if (r.error) dbFail("إعادة ضبط التفضيلات");
  return { reset: (r.data ?? []).length };
}

/**
 * Clears this student's simulated events: they are archived (kept for the record), their school rows
 * leave the dashboard, unsent updates are cancelled and imported exams cancelled by the demo come back.
 * Attempts already handed to a provider stay in the log; clearing does not recall a sent SMS or call.
 */
export async function clearSimulation(supabase: SupabaseClient, studentId: string, eventId?: string) {
  await loadStudent(supabase, studentId);
  if (eventId && !/^[0-9a-f-]{36}$/.test(eventId)) throw new OperatorError(400, "رقم الحدث غير صالح.");
  try {
    return await archiveDemoEvents(supabase, studentId, eventId);
  } catch {
    throw new OperatorError(503, "تعذّر حذف الحدث بالكامل. أعد المحاولة.");
  }
}

export const todayInRiyadh = () => riyadhDay(new Date());
