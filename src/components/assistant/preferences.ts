"use client";

import { useMemo, useSyncExternalStore } from "react";
import { AFTER_SCHOOL_TIME } from "./config";

// Preferences live in this browser only (demo). Nothing is sent anywhere and no contact is scheduled.
// Intended delivery rules (not implemented) are documented in docs/assistant-preferences.md.

export type Topic = "attendance" | "exams" | "grades";
export const topics: Topic[] = ["attendance", "exams", "grades"];

export const topicLabels: Record<Topic, string> = {
  attendance: "الحضور والغياب",
  exams: "تذكير الاختبار",
  grades: "ملخص الدرجات",
};

export const attendanceTimingOptions = [
  { value: "immediate", label: "مباشرة", hint: "عند تسجيل الحضور أو الغياب أو التأخر" },
  { value: "end-of-day", label: "بعد نهاية اليوم", hint: `ملخص واحد كل يوم الساعة ${AFTER_SCHOOL_TIME.label}` },
  { value: "custom", label: "موعد آخر", hint: "تختار الوقت بنفسك" },
] as const;

export const attendanceCustomOptions = [
  { value: "daily", label: "ملخص يومي بوقت مختلف", hint: "كل يوم، في الوقت الذي تختاره" },
  { value: "weekly", label: "ملخص أسبوعي", hint: "مرة في الأسبوع، في اليوم والوقت الذي تختارهما" },
] as const;

export const examTimingOptions = [
  { value: "day-before", label: "قبل الاختبار بيوم", hint: "تذكير لكل اختبار قادم" },
  { value: "week-before", label: "قبل الاختبار بأسبوع", hint: "تذكير لكل اختبار قادم" },
  { value: "custom", label: "موعد آخر", hint: "تختار عدد الأيام قبل الاختبار" },
] as const;

/** Any whole number of days from 1 to 30 before the exam. */
export const EXAM_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const isExamDays = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 30;

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
/** "يوم واحد" / "يومان" / "٣ أيام" … "١١ يومًا", with the correct Arabic number agreement. */
export function examDaysName(n: number) {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  return n <= 10 ? `${toArabicDigits(n)} أيام` : `${toArabicDigits(n)} يومًا`;
}
/** Select option text. It starts with the plain number so typing "14" on a keyboard jumps to it. */
export function examDaysOptionLabel(n: number) {
  const unit = n === 1 ? "يوم" : n === 2 ? "يومين" : n <= 10 ? "أيام" : "يومًا";
  return `${n} ${unit} قبل الاختبار`;
}
/** The same count after «بـ»: "بيوم واحد" / "بيومين" / "بـ٣ أيام" … "بـ١٤ يومًا". */
export function examDaysPhrase(n: number) {
  if (n === 1) return "بيوم واحد";
  if (n === 2) return "بيومين";
  return `بـ${examDaysName(n)}`;
}

export const gradesTimingOptions = [
  { value: "immediate", label: "مباشرة أول ما تطلع درجة كل مادة", hint: "تحديث مستقل لكل مادة عند نشر درجتها" },
  { value: "monthly", label: "كل شهر — جميع المواد معًا", hint: "ملخص واحد في اليوم الذي تختاره من الشهر" },
] as const;

/** "message" is deliberately generic: no SMS or WhatsApp channel is chosen yet. */
export const methodOptions = [
  { value: "call", label: "اتصال", hint: "مكالمة هاتفية" },
  { value: "message", label: "رسالة", hint: "رسالة مكتوبة" },
] as const;

export const dayOptions = [
  { value: "sun", label: "الأحد" },
  { value: "mon", label: "الاثنين" },
  { value: "tue", label: "الثلاثاء" },
  { value: "wed", label: "الأربعاء" },
  { value: "thu", label: "الخميس" },
  { value: "fri", label: "الجمعة" },
  { value: "sat", label: "السبت" },
] as const;

/** Quick choices. Any other time of day is entered under «وقت آخر». */
export const presetTimeOptions = [
  { value: "13:00", label: "1:00 ظهرًا" },
  { value: "16:00", label: "4:00 عصرًا" },
  { value: "18:00", label: "6:00 مساءً" },
] as const;

/** 24-hour "HH:MM", hour 00–23, minute 00–59. Saved times are Saudi time. */
export const isValidTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const isPresetTime = (v: string) => presetTimeOptions.some((o) => o.value === v);

export type Period = "am" | "pm";

/** Splits stored 24-hour "HH:MM" into the 12-hour parts shown to the parent: 00:xx → 12 صباحًا, 12:xx → 12 مساءً. */
export function splitTime(time: string): { hour: number; minute: number; period: Period } {
  const [h, m] = (isValidTime(time) ? time : "18:00").split(":").map(Number);
  return { hour: h % 12 === 0 ? 12 : h % 12, minute: m, period: h < 12 ? "am" : "pm" };
}

/** The reverse: 12 صباحًا → 00, 12 مساءً → 12, 1 مساءً → 13. */
export function joinTime(hour: number, minute: number, period: Period) {
  const h = (hour % 12) + (period === "pm" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "8:00 مساءً", "12:00 صباحًا (منتصف الليل)", "12:00 مساءً (الظهر)", "7:05 صباحًا". */
export function formatTime(time: string) {
  if (!isValidTime(time)) return "";
  const [h, m] = time.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const base = `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "صباحًا" : "مساءً"}`;
  if (h === 0 && m === 0) return `${base} (منتصف الليل)`;
  if (h === 12 && m === 0) return `${base} (الظهر)`;
  return base;
}

/** Days 29–31 do not exist in every month, so a monthly summary can only use 1–28. */
export const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);

type Off = "off";
export type AttendanceTiming = (typeof attendanceTimingOptions)[number]["value"] | Off;
export type AttendanceCustomKind = (typeof attendanceCustomOptions)[number]["value"];
export type ExamTiming = (typeof examTimingOptions)[number]["value"] | Off;
export type GradesTiming = (typeof gradesTimingOptions)[number]["value"] | Off;
export type Method = (typeof methodOptions)[number]["value"];
export type Day = (typeof dayOptions)[number]["value"];
/** "HH:MM" (24-hour). Empty only in a draft while the parent is still typing a custom time. */
export type ContactTime = string;

/**
 * `timing` is null only in a draft converted from an older format that had no exact equivalent;
 * the parent must choose a replacement before saving. Turning a topic off keeps its other settings
 * so they come back when it is turned on again. Every time is Saudi time (Asia/Riyadh).
 */
export type Preferences = {
  attendance: {
    timing: AttendanceTiming | null;
    method: Method;
    /** Used only when timing is "custom". */
    custom: { kind: AttendanceCustomKind; day: Day; time: ContactTime };
  };
  exams: { timing: ExamTiming | null; method: Method; customDays: number; time: ContactTime };
  grades: { timing: GradesTiming | null; method: Method; dayOfMonth: number; time: ContactTime };
  /** One retry, five minutes later, for unanswered calls only. Stored only; not implemented. */
  retryUnansweredCall: boolean;
  savedAt?: string;
};

export const defaultPreferences: Preferences = {
  attendance: { timing: "end-of-day", method: "call", custom: { kind: "daily", day: "thu", time: "18:00" } },
  exams: { timing: "day-before", method: "call", customDays: 2, time: "18:00" },
  grades: { timing: "monthly", method: "call", dayOfMonth: 1, time: "18:00" },
  retryUnansweredCall: false,
};

/** What is left to tell the parent about a record saved in an earlier format. */
export type LegacyInfo = {
  /** Topics with no structured equivalent. `previousRequest` marks free text the parent wrote earlier. */
  needsReview: { topic: Topic; was: string; previousRequest?: boolean }[];
  /** Things that were converted but now behave differently. */
  notes: string[];
};

export type SavedState =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "saved"; preferences: Preferences; legacy: LegacyInfo | null };

const PREFIX = "madrasati-demo:assistant-preferences:";
const KEYS = { v4: `${PREFIX}v4:`, v3: `${PREFIX}v3:`, v2: `${PREFIX}v2:`, v1: `${PREFIX}v1:` } as const;
const CHANGE_EVENT = "madrasati-demo:assistant-preferences-change";
const OLD_TEXT_MAX = 200;

// ---------- reading ----------

const valuesOf = <T extends string | number>(options: readonly { value: T }[]) => options.map((o) => o.value);
const isOneOf = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  (typeof value === "string" || typeof value === "number") && (values as readonly (string | number)[]).includes(value);
const asRecord = (value: unknown) =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
const readSavedAt = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : undefined;

const attendanceTimings: AttendanceTiming[] = [...valuesOf(attendanceTimingOptions), "off"];
const examTimings: ExamTiming[] = [...valuesOf(examTimingOptions), "off"];
const gradesTimings: GradesTiming[] = [...valuesOf(gradesTimingOptions), "off"];
const customKinds = valuesOf(attendanceCustomOptions);
const methods = valuesOf(methodOptions);
const days = valuesOf(dayOptions);
const isDayOfMonth = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 28;

function parseV4(raw: string): SavedState {
  try {
    const d = asRecord(JSON.parse(raw));
    const a = asRecord(d?.attendance);
    const c = asRecord(a?.custom);
    const e = asRecord(d?.exams);
    const g = asRecord(d?.grades);
    if (!d || !a || !c || !e || !g) return { status: "invalid" };
    if (
      !isOneOf(attendanceTimings, a.timing) ||
      !isOneOf(methods, a.method) ||
      !isOneOf(customKinds, c.kind) ||
      !isOneOf(days, c.day) ||
      !isValidTime(c.time) ||
      !isOneOf(examTimings, e.timing) ||
      !isOneOf(methods, e.method) ||
      !isExamDays(e.customDays) ||
      !isValidTime(e.time) ||
      !isOneOf(gradesTimings, g.timing) ||
      !isOneOf(methods, g.method) ||
      !isDayOfMonth(g.dayOfMonth) ||
      !isValidTime(g.time) ||
      typeof d.retryUnansweredCall !== "boolean"
    ) {
      return { status: "invalid" };
    }
    const preferences: Preferences = {
      attendance: { timing: a.timing, method: a.method, custom: { kind: c.kind, day: c.day, time: c.time } },
      exams: { timing: e.timing, method: e.method, customDays: e.customDays, time: e.time },
      grades: { timing: g.timing, method: g.method, dayOfMonth: g.dayOfMonth, time: g.time },
      retryUnansweredCall: d.retryUnansweredCall,
      savedAt: readSavedAt(d.savedAt),
    };
    return canSave(preferences) ? { status: "saved", preferences, legacy: null } : { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

const legacyDayLabels: Record<string, string> = Object.fromEntries(dayOptions.map((o) => [o.value, o.label]));

/**
 * Builds a draft from an older record. Only exact equivalents are carried over; anything else is left
 * for the parent to choose (timing: null). The single shared contact time of the older formats is
 * used for the topics that now have their own time.
 */
function fromLegacy(input: {
  /** Topics the parent had switched on. */
  selected: Topic[];
  attendance: { timing: "immediate" | "end-of-day" | "daily" | "weekly" | "text"; day?: unknown; text?: string };
  exams: { timing: "day-before" | "week-before" | "text" | "daily" | "weekly"; day?: unknown; text?: string };
  grades: { timing: "immediate" | "monthly" | "daily" | "weekly"; day?: unknown };
  methods: { attendance: Method; exams: Method; grades: Method };
  time: ContactTime;
  retry: boolean;
  savedAt: unknown;
  /** Older records did not have a day of the month for the monthly summary. */
  monthlyGradesWereChosen: boolean;
}): SavedState {
  const on = (t: Topic) => input.selected.includes(t);
  if (input.selected.length === 0) return { status: "invalid" };

  const needsReview: LegacyInfo["needsReview"] = [];
  const notes: string[] = [];
  const carriedTime: Topic[] = [];
  const base = defaultPreferences;
  const timeWas = `${timeLabel(input.time)} بتوقيت السعودية`;
  const describe = (timing: string, day: unknown) => {
    if (timing === "daily") return "يوميًا";
    if (timing === "weekly" && typeof day === "string" && legacyDayLabels[day]) return `أسبوعيًا يوم ${legacyDayLabels[day]}`;
    return "إعداد سابق";
  };

  const attendance: Preferences["attendance"] = {
    timing: "off",
    method: input.methods.attendance,
    custom: { ...base.attendance.custom, time: input.time },
  };
  if (on("attendance")) {
    const a = input.attendance;
    if (a.timing === "immediate" || a.timing === "end-of-day") {
      attendance.timing = a.timing;
      if (a.timing === "end-of-day") {
        notes.push(
          `الحضور والغياب «بعد نهاية اليوم»: يصلك الملخص الآن في وقت ثابت هو ${AFTER_SCHOOL_TIME.label} بتوقيت السعودية، وهو وقت افتراضي للنموذج التجريبي وليس وقت انصراف رسميًا. إذا أردت وقتًا آخر فاختر «موعد آخر».`,
        );
      }
    } else if (a.timing === "daily") {
      attendance.timing = "end-of-day";
      notes.push(
        `الحضور والغياب «يوميًا»: أصبح «بعد نهاية اليوم» ويصلك الملخص في وقت ثابت هو ${AFTER_SCHOOL_TIME.label} بتوقيت السعودية، وهو وقت افتراضي للنموذج التجريبي. إذا أردت وقتك السابق (${timeWas}) فاختر «موعد آخر».`,
      );
    } else if (a.timing === "weekly") {
      const day = isOneOf(days, a.day) ? a.day : null;
      if (day === null) return { status: "invalid" };
      attendance.timing = "custom";
      attendance.custom = { kind: "weekly", day, time: input.time };
      carriedTime.push("attendance");
    } else {
      attendance.timing = null;
      needsReview.push({ topic: "attendance", was: a.text ?? "إعداد سابق", previousRequest: true });
    }
  }

  const exams: Preferences["exams"] = { timing: "off", method: input.methods.exams, customDays: base.exams.customDays, time: input.time };
  if (on("exams")) {
    const e = input.exams;
    if (e.timing === "day-before" || e.timing === "week-before") {
      exams.timing = e.timing;
      carriedTime.push("exams");
    } else {
      exams.timing = null;
      needsReview.push(
        e.timing === "text"
          ? { topic: "exams", was: e.text ?? "إعداد سابق", previousRequest: true }
          : { topic: "exams", was: describe(e.timing, e.day) },
      );
    }
  }

  const grades: Preferences["grades"] = { timing: "off", method: input.methods.grades, dayOfMonth: 1, time: input.time };
  if (on("grades")) {
    const g = input.grades;
    if (g.timing === "immediate" || g.timing === "monthly") {
      grades.timing = g.timing;
      if (g.timing === "monthly") {
        carriedTime.push("grades");
        if (input.monthlyGradesWereChosen) {
          notes.push("ملخص الدرجات الشهري: لم يكن لك يوم محدد من الشهر، فاخترنا يوم 1. يمكنك تغييره من 1 إلى 28.");
        }
      }
    } else {
      grades.timing = null;
      needsReview.push({ topic: "grades", was: describe(g.timing, g.day) });
    }
  }

  if (carriedTime.length > 0) {
    notes.push(
      `استخدمنا وقت التواصل الذي اخترته سابقًا (${timeWas}) في: ${carriedTime.map((t) => topicLabels[t]).join("، ")}. أصبح لكل نوع وقته الخاص.`,
    );
  }

  return {
    status: "saved",
    legacy: { needsReview, notes },
    preferences: { attendance, exams, grades, retryUnansweredCall: input.retry, savedAt: readSavedAt(input.savedAt) },
  };
}

function readTopics(value: unknown): Topic[] {
  return Array.isArray(value) ? topics.filter((t) => value.includes(t)) : [];
}

function parseV3(raw: string): SavedState {
  try {
    const d = asRecord(JSON.parse(raw));
    const a = asRecord(d?.attendance);
    const e = asRecord(d?.exams);
    const g = asRecord(d?.grades);
    if (!d || !a || !e || !g) return { status: "invalid" };
    const text = (v: unknown) => (typeof v === "string" && v.length <= OLD_TEXT_MAX ? v.trim() : null);
    const aText = text(a.customText);
    const eText = text(e.customText);
    if (
      !isOneOf([...valuesOf(attendanceTimingOptions.filter((o) => o.value !== "custom")), "other", "off"], a.timing) ||
      !isOneOf([...valuesOf(examTimingOptions.filter((o) => o.value !== "custom")), "other", "off"], e.timing) ||
      !isOneOf(gradesTimings, g.timing) ||
      !isOneOf(methods, a.method) ||
      !isOneOf(methods, e.method) ||
      !isOneOf(methods, g.method) ||
      aText === null ||
      eText === null ||
      !isValidTime(d.time) ||
      typeof d.retryUnansweredCall !== "boolean"
    ) {
      return { status: "invalid" };
    }
    // A record could only be saved with a written request when «أخرى» was chosen, so empty means damaged.
    if ((a.timing === "other" && aText === "") || (e.timing === "other" && eText === "")) return { status: "invalid" };
    const enabled = (t: unknown) => t !== "off";
    const selected = topics.filter((t) => enabled({ attendance: a, exams: e, grades: g }[t].timing));
    if (selected.length === 0) return { status: "invalid" };
    return fromLegacy({
      selected,
      attendance: a.timing === "other" ? { timing: "text", text: aText } : { timing: a.timing as "immediate" | "end-of-day" },
      exams: e.timing === "other" ? { timing: "text", text: eText } : { timing: e.timing as "day-before" | "week-before" },
      grades: { timing: g.timing === "immediate" ? "immediate" : "monthly" },
      methods: { attendance: a.method, exams: e.method, grades: g.method },
      time: d.time,
      retry: d.retryUnansweredCall,
      savedAt: d.savedAt,
      monthlyGradesWereChosen: true,
    });
  } catch {
    return { status: "invalid" };
  }
}

function parseV2(raw: string): SavedState {
  try {
    const d = asRecord(JSON.parse(raw));
    const a = asRecord(d?.attendance);
    const g = asRecord(d?.grades);
    if (!d || !a || !g || !isValidTime(d.time)) return { status: "invalid" };
    if (a.frequency !== "daily" && a.frequency !== "weekly") return { status: "invalid" };
    return fromLegacy({
      selected: readTopics(d.topics),
      attendance: { timing: a.frequency, day: a.day },
      exams: { timing: "day-before" },
      grades: { timing: "weekly", day: g.day },
      methods: { attendance: "call", exams: "call", grades: "call" },
      time: d.time,
      retry: false,
      savedAt: d.savedAt,
      monthlyGradesWereChosen: false,
    });
  } catch {
    return { status: "invalid" };
  }
}

function parseV1(raw: string): SavedState {
  try {
    const d = asRecord(JSON.parse(raw));
    if (!d || !isValidTime(d.time)) return { status: "invalid" };
    if (d.frequency !== "daily" && d.frequency !== "weekly") return { status: "invalid" };
    const f = d.frequency;
    return fromLegacy({
      selected: readTopics(d.topics),
      attendance: { timing: f, day: d.day },
      exams: { timing: f, day: d.day },
      grades: { timing: f, day: d.day },
      methods: { attendance: "call", exams: "call", grades: "call" },
      time: d.time,
      retry: false,
      savedAt: d.savedAt,
      monthlyGradesWereChosen: false,
    });
  } catch {
    return { status: "invalid" };
  }
}

export function parseSaved(raw: Record<"v4" | "v3" | "v2" | "v1", string | null>): SavedState {
  if (raw.v4 !== null) return parseV4(raw.v4);
  if (raw.v3 !== null) return parseV3(raw.v3);
  if (raw.v2 !== null) return parseV2(raw.v2);
  if (raw.v1 !== null) return parseV1(raw.v1);
  return { status: "none" };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Saved preferences for one student; "none" during server rendering. */
export function useSavedPreferences(studentId: string): SavedState {
  // A single JSON string snapshot keeps useSyncExternalStore stable between reads.
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const raw = {
        v4: read(KEYS.v4 + studentId),
        v3: read(KEYS.v3 + studentId),
        v2: read(KEYS.v2 + studentId),
        v1: read(KEYS.v1 + studentId),
      };
      return Object.values(raw).every((v) => v === null) ? null : JSON.stringify(raw);
    },
    () => null,
  );
  return useMemo(() => (snapshot === null ? { status: "none" } : parseSaved(JSON.parse(snapshot))), [snapshot]);
}

/**
 * Writes the current format, then removes older-format records for the student. Older records are
 * only removed after the new one is stored. Returns false when the choices are not valid or the
 * browser blocks storage.
 */
export function savePreferences(studentId: string, preferences: Preferences): boolean {
  if (!canSave(preferences)) return false;
  try {
    const record = { version: 4, ...preferences, savedAt: new Date().toISOString() };
    window.localStorage.setItem(KEYS.v4 + studentId, JSON.stringify(record));
  } catch {
    return false;
  }
  try {
    for (const key of [KEYS.v3, KEYS.v2, KEYS.v1]) window.localStorage.removeItem(key + studentId);
  } catch {
    // The new record is saved and read first, so a leftover older record is harmless.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

// ---------- validation ----------

export const isEnabled = (p: Preferences, topic: Topic) => {
  const timing = p[topic].timing;
  return timing !== null && timing !== "off";
};
export const enabledTopics = (p: Preferences) => topics.filter((t) => isEnabled(p, t));

/** Whether this topic's current option needs a time of day. Immediate updates follow the event instead. */
export function needsTime(p: Preferences, topic: Topic) {
  switch (topic) {
    case "attendance":
      return p.attendance.timing === "custom";
    case "exams":
      return isEnabled(p, "exams");
    case "grades":
      return p.grades.timing === "monthly";
  }
}

export const getTime = (p: Preferences, topic: Topic): ContactTime =>
  topic === "attendance" ? p.attendance.custom.time : p[topic].time;

/** Every day, number and time that applies to the current option must be a value we accept. */
export type Problem = { topic: Topic; kind: "choose" | "time" };

export function problemsFor(p: Preferences, topic: Topic): Problem[] {
  if (p[topic].timing === null) return [{ topic, kind: "choose" }];
  if (!isEnabled(p, topic)) return [];
  if (needsTime(p, topic) && !isValidTime(getTime(p, topic))) return [{ topic, kind: "time" }];
  if (topic === "attendance" && p.attendance.timing === "custom") {
    const { kind, day } = p.attendance.custom;
    if (!isOneOf(customKinds, kind) || (kind === "weekly" && !isOneOf(days, day))) return [{ topic, kind: "choose" }];
  }
  if (topic === "exams" && p.exams.timing === "custom" && !isExamDays(p.exams.customDays)) return [{ topic, kind: "choose" }];
  if (topic === "grades" && p.grades.timing === "monthly" && !isDayOfMonth(p.grades.dayOfMonth)) return [{ topic, kind: "choose" }];
  return [];
}

export const allProblems = (p: Preferences) => topics.flatMap((t) => problemsFor(p, t));

// ---------- options a particular student cannot use ----------

/** Timing values (never "off") that are not offered for a student, per topic. */
export type UnavailableOptions = Partial<Record<Topic, readonly string[]>>;
/** A choice cleared because the student it now applies to cannot use it; `was` is its plain name. */
export type ClearedChoice = { topic: Topic; was: string };

export const isTimingAvailable = (unavailable: UnavailableOptions | undefined, topic: Topic, timing: string) =>
  timing === "off" || !unavailable?.[topic]?.includes(timing);

/**
 * Keeps every choice the student can use and clears only the timings they cannot, so the parent picks
 * a replacement for those (the existing "choose" check blocks saving until then).
 */
export function adaptToStudent(p: Preferences, unavailable: UnavailableOptions | undefined) {
  const cleared: ClearedChoice[] = [];
  let preferences = p;
  for (const topic of topics) {
    const timing = p[topic].timing;
    if (timing === null || isTimingAvailable(unavailable, topic, timing)) continue;
    cleared.push({ topic, was: topicSummary(p, topic).timing });
    preferences = { ...preferences, [topic]: { ...preferences[topic], timing: null } } as Preferences;
  }
  return { preferences, cleared };
}
export const canSave = (p: Preferences) => allProblems(p).length === 0 && enabledTopics(p).length > 0;

// ---------- plain-language descriptions ----------

const labelOf = <T extends string | number>(options: readonly { value: T; label: string }[], value: T) =>
  options.find((o) => o.value === value)?.label ?? "";

export const methodLabel = (method: Method) => labelOf(methodOptions, method);
export const timeLabel = (time: ContactTime) =>
  labelOf(presetTimeOptions, time as (typeof presetTimeOptions)[number]["value"]) || formatTime(time) || "وقت غير محدد";
const saudi = (label: string) => `${label} بتوقيت السعودية`;

export const usesCalls = (p: Preferences) => enabledTopics(p).some((t) => p[t].method === "call");

export type TopicSummary = {
  topic: Topic;
  label: string;
  status: "on" | "off" | "choose";
  /** Name of the chosen option. */
  timing: string;
  /** One short line for tight spaces, including the time when there is one. */
  short: string;
  method?: string;
  /** The full timing in plain words, including Saudi time. */
  when?: string;
  note?: string;
};

export function topicSummary(p: Preferences, topic: Topic): TopicSummary {
  const label = topicLabels[topic];
  const timing = p[topic].timing;
  if (timing === null) return { topic, label, status: "choose", timing: "يحتاج إلى اختيار جديد", short: "يحتاج إلى اختيار جديد" };
  if (timing === "off") return { topic, label, status: "off", timing: "متوقف", short: "متوقف" };

  const on = (timingName: string, short: string, when: string, note?: string): TopicSummary => ({
    topic,
    label,
    status: "on",
    timing: timingName,
    short,
    method: methodLabel(p[topic].method),
    when,
    note,
  });

  if (topic === "attendance") {
    const summaryNote = "ملخص الحضور والغياب والتأخر.";
    if (timing === "immediate") {
      return on("مباشرة", "مباشرة عند التسجيل", "فور تسجيل الحضور أو الغياب أو التأخر، دون وقت محدد", "لا يصلك شيء عن غياب بعذر مقبول.");
    }
    if (timing === "end-of-day") {
      return on(
        "بعد نهاية اليوم",
        `بعد نهاية اليوم (${AFTER_SCHOOL_TIME.label})`,
        `كل يوم دراسي الساعة ${saudi(AFTER_SCHOOL_TIME.label)}`,
        `${summaryNote} وقت ثابت افتراضي للنموذج التجريبي، وليس وقت انصراف رسميًا.`,
      );
    }
    const { kind, day, time } = p.attendance.custom;
    const t = timeLabel(time);
    return kind === "daily"
      ? on("موعد آخر: ملخص يومي", `كل يوم ${t}`, `كل يوم الساعة ${saudi(t)}`, summaryNote)
      : on("موعد آخر: ملخص أسبوعي", `كل ${labelOf(dayOptions, day)} ${t}`, `كل أسبوع يوم ${labelOf(dayOptions, day)} الساعة ${saudi(t)}`, summaryNote);
  }

  if (topic === "exams") {
    const t = timeLabel(p.exams.time);
    const phrase =
      timing === "day-before" ? "بيوم واحد" : timing === "week-before" ? "بأسبوع" : examDaysPhrase(p.exams.customDays);
    const name = timing === "custom" ? `موعد آخر: ${examDaysName(p.exams.customDays)} قبل الاختبار` : labelOf(examTimingOptions, timing);
    return on(name, `قبل الاختبار ${phrase} (${t})`, `قبل كل اختبار ${phrase}، الساعة ${saudi(t)}`, "ونبلغك أيضًا إذا أُلغي اختبار.");
  }

  if (timing === "immediate") {
    return on("مباشرة لكل مادة", "مباشرة لكل مادة", "فور نشر درجة كل مادة، دون وقت محدد");
  }
  const t = timeLabel(p.grades.time);
  return on(
    "كل شهر — جميع المواد معًا",
    `يوم ${toArabicDigits(p.grades.dayOfMonth)} من كل شهر (${t})`,
    `يوم ${toArabicDigits(p.grades.dayOfMonth)} من كل شهر، الساعة ${saudi(t)}`,
    "يشمل الدرجات الجديدة المنشورة في الشهر السابق كاملًا، ولا يصلك شيء إذا لم توجد درجات جديدة.",
  );
}
