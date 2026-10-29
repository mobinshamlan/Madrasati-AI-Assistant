// The one place that decides what a school event means for a parent, from their saved preferences.
// Pure: no database, no clock of its own (the caller passes `now`), so the demo page, the preview, the
// message text and the call context all get the same answer, and tests can pin any moment.
//
// Times are Asia/Riyadh. Riyadh keeps UTC+3 all year (no daylight saving), so a fixed offset is exact.
import type { Preferences } from "../../components/assistant/preferences";

export type Topic = "attendance" | "exams" | "grades";
export type Method = "call" | "message";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type SchoolEvent =
  | { kind: "attendance"; date: string; status: AttendanceStatus }
  | { kind: "grade_published"; date: string; subject: string; assessment: string; score: number; outOf: number }
  | { kind: "exam_added"; date: string; examDate: string; startTime: string | null; subject: string; examKind: string }
  | { kind: "exam_cancelled"; date: string; examDate: string; subject: string; examKind: string };

export type Decision = {
  topic: Topic;
  status: "suppressed" | "waiting" | "ready";
  method: Method | null;
  /** When the update is due, as an ISO instant. Null for immediate updates and suppressed ones. */
  dueAt: string | null;
  /** Plain Arabic, shown to the operator as the reason for the status. */
  reason: string;
  /** Monthly grades summary: the month of grades it covers. */
  window: { start: string; end: string } | null;
};

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const AFTER_SCHOOL = "14:00"; // Same prototype constant as src/components/assistant/config.ts.

// ---------- dates (YYYY-MM-DD are Riyadh calendar days) ----------

const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
/** The instant of a Riyadh wall-clock time on a Riyadh calendar day. */
export function riyadhInstant(day: string, hhmm: string): Date {
  const [y, m, d] = parts(day);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - RIYADH_OFFSET_MS);
}
/** The Riyadh calendar day of an instant. */
export function riyadhDay(at: Date): string {
  return new Date(at.getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}
export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: string): number {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
const dayIndex = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const;
export function monthWindow(day: string) {
  const [y, m] = parts(day);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}

// ---------- the decision ----------

const scheduled = (topic: Topic, method: Method, due: Date, now: Date, readyReason: string, waitingReason: string, window: Decision["window"] = null): Decision =>
  due.getTime() <= now.getTime()
    ? { topic, status: "ready", method, dueAt: due.toISOString(), reason: readyReason, window }
    : { topic, status: "waiting", method, dueAt: due.toISOString(), reason: waitingReason, window };

const suppressed = (topic: Topic, reason: string): Decision => ({ topic, status: "suppressed", method: null, dueAt: null, reason, window: null });

export const topicOf = (event: SchoolEvent): Topic =>
  event.kind === "attendance" ? "attendance" : event.kind === "grade_published" ? "grades" : "exams";

export function evaluate(event: SchoolEvent, prefs: Preferences | null, now: Date): Decision {
  const topic = topicOf(event);
  if (!prefs) return suppressed(topic, "لم يحفظ ولي الأمر تفضيلات لهذا الطالب بعد.");
  const p = prefs[topic];
  if (p.timing === null) return suppressed(topic, "تفضيل هذا الموضوع يحتاج إلى اختيار جديد من ولي الأمر.");
  if (p.timing === "off") return suppressed(topic, "متوقف حسب تفضيلات ولي الأمر.");
  const method = p.method;

  if (event.kind === "attendance") {
    const a = prefs.attendance;
    if (event.status === "excused") return suppressed(topic, "غياب بعذر مقبول: لا يُرسل إشعار غياب.");
    if (a.timing === "immediate") return { topic, status: "ready", method, dueAt: null, reason: "تحديث مباشر عند التسجيل.", window: null };
    if (a.timing === "end-of-day") {
      return scheduled(topic, method, riyadhInstant(event.date, AFTER_SCHOOL), now, "حان موعد ملخص نهاية اليوم.", "ضمن ملخص نهاية اليوم.");
    }
    if (a.custom.kind === "daily") {
      return scheduled(topic, method, riyadhInstant(event.date, a.custom.time), now, "حان موعد الملخص اليومي.", "ضمن الملخص اليومي.");
    }
    const ahead = (dayIndex[a.custom.day] - weekday(event.date) + 7) % 7;
    return scheduled(topic, method, riyadhInstant(addDays(event.date, ahead), a.custom.time), now, "حان موعد الملخص الأسبوعي.", "ضمن الملخص الأسبوعي.");
  }

  if (event.kind === "exam_cancelled") {
    if (event.examDate < riyadhDay(now)) return suppressed(topic, "موعد الاختبار الملغى مضى.");
    return { topic, status: "ready", method, dueAt: null, reason: "إلغاء الاختبار يُبلَّغ مباشرة ما دام تذكير الاختبارات مفعّلًا.", window: null };
  }

  if (event.kind === "exam_added") {
    const e = prefs.exams;
    if (event.examDate < riyadhDay(now)) return suppressed(topic, "موعد الاختبار مضى.");
    const days = e.timing === "day-before" ? 1 : e.timing === "week-before" ? 7 : e.customDays;
    const due = riyadhInstant(addDays(event.examDate, -days), e.time);
    return scheduled(topic, method, due, now, "حان موعد التذكير (أو فات وما زال الاختبار قادمًا).", `تذكير قبل الاختبار ${days === 1 ? "بيوم" : days === 2 ? "بيومين" : `بـ${days} ${days <= 10 ? "أيام" : "يومًا"}`}.`);
  }

  // A published grade.
  const g = prefs.grades;
  if (g.timing === "immediate") return { topic, status: "ready", method, dueAt: null, reason: "تحديث مباشر عند نشر الدرجة.", window: null };
  // Monthly: the summary on day D of the next month covers grades published during this whole month.
  const window = monthWindow(event.date);
  const due = riyadhInstant(addDays(addDays(window.end, 1), g.dayOfMonth - 1), g.time);
  return scheduled(topic, method, due, now, "حان موعد الملخص الشهري.", "ضمن ملخص الدرجات الشهري.", window);
}

// ---------- the words ----------

const arabicDigits = (s: string | number) => String(s).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
/** "18:00" → "6:00 مساءً". */
export function arabicTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "صباحًا" : "مساءً"}`;
}
const weekdayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
/** "2026-11-01" → "الأحد 1 نوفمبر". */
export function arabicDay(day: string): string {
  const [, m, d] = parts(day);
  return `${weekdayNames[weekday(day)]} ${d} ${monthNames[m - 1]}`;
}
/** An ISO instant in Riyadh: "الأحد 1 نوفمبر، 6:00 مساءً". */
export function arabicMoment(iso: string): string {
  const at = new Date(iso);
  const day = riyadhDay(at);
  const local = new Date(at.getTime() + RIYADH_OFFSET_MS);
  return `${arabicDay(day)}، ${arabicTime(`${local.getUTCHours()}:${local.getUTCMinutes()}`)}`;
}
const statusWords: Record<AttendanceStatus, string> = { present: "حضور", absent: "غياب", late: "تأخر", excused: "غياب بعذر" };
const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

export type ContentInput = {
  student: { fullName: string; firstName: string };
  event: SchoolEvent;
  decision: Decision;
  /** For a monthly summary: the grades published in its window. */
  monthGrades?: { subject: string; assessment: string; score: number; outOf: number; date: string }[];
};

/** The facts this update may mention, nothing else. Used for the message, the call and the AI context. */
export function factLines(input: ContentInput): string[] {
  const { event, decision } = input;
  if (event.kind === "attendance") return [`الحضور يوم ${arabicDay(event.date)}: ${statusWords[event.status]}.`];
  if (event.kind === "exam_added") {
    const at = event.startTime ? `، الساعة ${arabicTime(event.startTime)}` : "";
    return [`اختبار ${event.subject} (${event.examKind}) يوم ${arabicDay(event.examDate)}${at}.`];
  }
  if (event.kind === "exam_cancelled") return [`أُلغي اختبار ${event.subject} (${event.examKind}) المقرر يوم ${arabicDay(event.examDate)}.`];
  if (decision.window && input.monthGrades) {
    if (input.monthGrades.length === 0) return ["لا توجد درجات جديدة في هذه الفترة."];
    return input.monthGrades.map((g) => `${g.subject}: ${g.assessment} — ${fmtScore(g.score)} من ${fmtScore(g.outOf)}.`);
  }
  return [`${event.subject}: ${event.assessment} — ${fmtScore(event.score)} من ${fmtScore(event.outOf)}.`];
}

export function messageText(input: ContentInput): string {
  const { student, decision } = input;
  const heading =
    decision.window
      ? `ملخص درجات ${student.firstName} من ${arabicDay(decision.window.start)} إلى ${arabicDay(decision.window.end)}:`
      : decision.topic === "attendance"
        ? `تحديث حضور ${student.firstName}:`
        : decision.topic === "exams"
          ? `تحديث اختبارات ${student.firstName}:`
          : `درجة جديدة لـ${student.firstName}:`;
  return [`طمّني | ${student.fullName}`, heading, ...factLines(input)].join("\n");
}

/** The assistant's first sentence on a call (لولوة), in the same style as the phone bridge. */
export function callOpening(input: ContentInput): string {
  const facts = factLines(input).join(" ");
  return `مرحبا، معك لولوة من طمّني. حابين نبلغك بخصوص ${input.student.firstName}: ${facts}`;
}

/** Arabic digits for display where the page uses them. */
export const toArabicDigits = arabicDigits;
