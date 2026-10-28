"use client";

import { useMemo, useSyncExternalStore } from "react";

// Preferences live in this browser only (demo). Nothing is sent anywhere and no call is scheduled.

export const topicOptions = [
  { value: "attendance", label: "الحضور والغياب" },
  { value: "exams", label: "الاختبارات" },
  { value: "grades", label: "الدرجات" },
] as const;

export const attendanceFrequencyOptions = [
  { value: "daily", label: "ملخص يومي بعد المدرسة", hint: "من الأحد إلى الخميس" },
  { value: "weekly", label: "ملخص أسبوعي", hint: "مرة واحدة في الأسبوع، في اليوم الذي تختاره" },
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

export const timeOptions = [
  { value: "13:00", label: "1:00 ظهرًا" },
  { value: "16:00", label: "4:00 عصرًا" },
  { value: "18:00", label: "6:00 مساءً" },
  { value: "20:00", label: "8:00 مساءً" },
] as const;

/** Earliest time we suggest for a daily after-school attendance summary. */
export const AFTER_SCHOOL_FROM = "16:00";

export type Topic = (typeof topicOptions)[number]["value"];
export type AttendanceFrequency = (typeof attendanceFrequencyOptions)[number]["value"];
export type Day = (typeof dayOptions)[number]["value"];
export type CallTime = (typeof timeOptions)[number]["value"];

export type Preferences = {
  topics: Topic[];
  attendance: { frequency: AttendanceFrequency; day: Day };
  grades: { day: Day };
  // Exam reminders are always sent one day before each exam, so they have no setting.
  time: CallTime;
  savedAt?: string;
};

export const defaultPreferences: Preferences = {
  topics: ["attendance", "exams", "grades"],
  attendance: { frequency: "weekly", day: "thu" },
  grades: { day: "thu" },
  time: "18:00",
};

const V1_PREFIX = "madrasati-demo:assistant-preferences:v1:";
const V2_PREFIX = "madrasati-demo:assistant-preferences:v2:";
const CHANGE_EVENT = "madrasati-demo:assistant-preferences-change";

export type SavedState =
  | { status: "none" }
  | { status: "invalid" }
  /** `changes` explains timing that moved when converting choices saved before per-topic timing existed. */
  | { status: "saved"; preferences: Preferences; changes: string[] };

const isOneOf = <T extends string>(options: readonly { value: T }[], value: unknown): value is T =>
  typeof value === "string" && options.some((o) => o.value === value);

const asRecord = (value: unknown) =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

// Keep the canonical order and drop duplicates or unknown values.
const readTopics = (value: unknown): Topic[] =>
  Array.isArray(value) ? topicOptions.map((o) => o.value).filter((v) => value.includes(v)) : [];

const readSavedAt = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : undefined;

function parseV2(raw: string): SavedState {
  try {
    const d = asRecord(JSON.parse(raw));
    if (!d) return { status: "invalid" };
    const topics = readTopics(d.topics);
    const attendance = asRecord(d.attendance);
    const grades = asRecord(d.grades);
    if (
      topics.length === 0 ||
      !attendance ||
      !grades ||
      !isOneOf(attendanceFrequencyOptions, attendance.frequency) ||
      !isOneOf(dayOptions, attendance.day) ||
      !isOneOf(dayOptions, grades.day) ||
      !isOneOf(timeOptions, d.time)
    ) {
      return { status: "invalid" };
    }
    return {
      status: "saved",
      changes: [],
      preferences: {
        topics,
        attendance: { frequency: attendance.frequency, day: attendance.day },
        grades: { day: grades.day },
        time: d.time,
        savedAt: readSavedAt(d.savedAt),
      },
    };
  } catch {
    return { status: "invalid" };
  }
}

/** Converts the earlier single daily/weekly setting into per-topic timing. */
function migrateV1(raw: string): SavedState {
  try {
    const d = asRecord(JSON.parse(raw));
    if (!d) return { status: "invalid" };
    const topics = readTopics(d.topics);
    if (topics.length === 0 || !isOneOf(attendanceFrequencyOptions, d.frequency) || !isOneOf(timeOptions, d.time)) {
      return { status: "invalid" };
    }
    const oldDay = isOneOf(dayOptions, d.day) ? d.day : null;
    if (d.frequency === "weekly" && oldDay === null) return { status: "invalid" };

    const weeklyDay = oldDay ?? defaultPreferences.grades.day;
    const preferences: Preferences = {
      topics,
      attendance: { frequency: d.frequency, day: weeklyDay },
      grades: { day: weeklyDay },
      time: d.time,
      savedAt: readSavedAt(d.savedAt),
    };

    const oldTiming = d.frequency === "daily" ? "يوميًا" : `أسبوعيًا يوم ${dayLabel(weeklyDay)}`;
    const changes: string[] = [];
    if (topics.includes("grades") && d.frequency === "daily") {
      changes.push(
        `الدرجات: أصبحت ملخصًا أسبوعيًا يوم ${dayLabel(weeklyDay)} بدلًا من يوميًا، ويشمل الدرجات الجديدة أو المعدّلة فقط.`,
      );
    }
    if (topics.includes("exams")) {
      changes.push(`الاختبارات: أصبحت تذكيرًا قبل كل اختبار بيوم واحد بدلًا من ${oldTiming}.`);
    }
    return { status: "saved", preferences, changes };
  } catch {
    return { status: "invalid" };
  }
}

export function parseSaved(v2Raw: string | null, v1Raw: string | null): SavedState {
  if (v2Raw !== null) return parseV2(v2Raw);
  if (v1Raw !== null) return migrateV1(v1Raw);
  return { status: "none" };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// A single string snapshot keeps useSyncExternalStore stable between reads.
const SEPARATOR = "\u0000";

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
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const v2 = read(V2_PREFIX + studentId);
      const v1 = read(V1_PREFIX + studentId);
      return v2 === null && v1 === null ? null : `${v2 ?? ""}${SEPARATOR}${v1 ?? ""}`;
    },
    () => null,
  );
  return useMemo(() => {
    if (snapshot === null) return { status: "none" };
    const [v2, v1] = snapshot.split(SEPARATOR);
    return parseSaved(v2 || null, v1 || null);
  }, [snapshot]);
}

/**
 * Writes the current format and removes any earlier-format record for the student.
 * Returns false when the browser blocks storage (e.g. private mode or full quota).
 */
export function savePreferences(
  studentId: string,
  preferences: Preferences,
  { keepSavedAt = false }: { keepSavedAt?: boolean } = {},
): boolean {
  try {
    const savedAt = keepSavedAt && preferences.savedAt ? preferences.savedAt : new Date().toISOString();
    const record = { version: 2, ...preferences, savedAt };
    window.localStorage.setItem(V2_PREFIX + studentId, JSON.stringify(record));
    window.localStorage.removeItem(V1_PREFIX + studentId);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

const labelOf = <T extends string>(options: readonly { value: T; label: string }[], value: T) =>
  options.find((o) => o.value === value)?.label ?? "";

export const dayLabel = (day: Day) => labelOf(dayOptions, day);
export const topicLabel = (topic: Topic) => labelOf(topicOptions, topic);

export function timeText(p: Preferences) {
  return `${labelOf(timeOptions, p.time)} بتوقيت السعودية`;
}

/** Turns one topic on or off, keeping the canonical order. Its timing is kept so turning it back on restores it. */
export function withTopic(p: Preferences, topic: Topic, enabled: boolean): Preferences {
  return {
    ...p,
    topics: topicOptions.map((o) => o.value).filter((v) => (v === topic ? enabled : p.topics.includes(v))),
  };
}

/** Plain-words status of one topic, whether it is on or off. */
export function topicStatus(p: Preferences, topic: Topic) {
  const schedule = topicSchedules({ ...p, topics: [topic] })[0];
  return p.topics.includes(topic)
    ? { enabled: true, label: schedule.label, when: schedule.when, what: schedule.what }
    : { enabled: false, label: schedule.label, when: "متوقف", what: "لن تصلك تحديثات عن هذا النوع." };
}

/** When each selected topic is due, in plain words, in the canonical topic order. */
export function topicSchedules(p: Preferences) {
  const schedules: Record<Topic, { when: string; what: string }> = {
    attendance:
      p.attendance.frequency === "daily"
        ? { when: "كل يوم دراسي بعد المدرسة (من الأحد إلى الخميس)", what: "ملخص الحضور والغياب والتأخر" }
        : { when: `كل أسبوع يوم ${dayLabel(p.attendance.day)}`, what: "ملخص الحضور والغياب والتأخر للأسبوع" },
    grades: {
      when: `كل أسبوع يوم ${dayLabel(p.grades.day)}`,
      what: "الدرجات الجديدة أو المعدّلة فقط، ولا يصلك تحديث إذا لم يتغير شيء",
    },
    exams: { when: "قبل كل اختبار بيوم واحد", what: "تذكير بموعد الاختبار" },
  };
  return topicOptions
    .filter((o) => p.topics.includes(o.value))
    .map((o) => ({ topic: o.value, label: o.label, ...schedules[o.value] }));
}

export function needsAfterSchoolHint(p: Preferences) {
  return p.topics.includes("attendance") && p.attendance.frequency === "daily";
}

export function isBeforeAfterSchool(p: Preferences) {
  return needsAfterSchoolHint(p) && p.time < AFTER_SCHOOL_FROM;
}
