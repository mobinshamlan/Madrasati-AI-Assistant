"use client";

import { useMemo, useSyncExternalStore } from "react";

// Preferences live in this browser only (demo). Nothing is sent anywhere and no call is scheduled.

export const topicOptions = [
  { value: "attendance", label: "الحضور والغياب" },
  { value: "exams", label: "الاختبارات" },
  { value: "grades", label: "الدرجات" },
] as const;

export const frequencyOptions = [
  { value: "daily", label: "يوميًا", hint: "كل يوم دراسي، من الأحد إلى الخميس" },
  { value: "weekly", label: "أسبوعيًا", hint: "مرة واحدة في الأسبوع" },
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

export type Topic = (typeof topicOptions)[number]["value"];
export type Frequency = (typeof frequencyOptions)[number]["value"];
export type Day = (typeof dayOptions)[number]["value"];
export type CallTime = (typeof timeOptions)[number]["value"];

export type Preferences = {
  topics: Topic[];
  frequency: Frequency;
  day: Day;
  time: CallTime;
  savedAt?: string;
};

export const defaultPreferences: Preferences = {
  topics: ["attendance", "exams", "grades"],
  frequency: "weekly",
  day: "thu",
  time: "18:00",
};

const STORAGE_PREFIX = "madrasati-demo:assistant-preferences:v1:";
const CHANGE_EVENT = "madrasati-demo:assistant-preferences-change";

export type SavedState =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "saved"; preferences: Preferences };

const isOneOf = <T extends string>(options: readonly { value: T }[], value: unknown): value is T =>
  typeof value === "string" && options.some((o) => o.value === value);

export function parsePreferences(raw: string | null): SavedState {
  if (raw === null) return { status: "none" };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return { status: "invalid" };
    const d = data as Record<string, unknown>;
    if (!Array.isArray(d.topics)) return { status: "invalid" };
    // Keep the canonical order and drop duplicates or unknown values.
    const topics = topicOptions.map((o) => o.value).filter((v) => (d.topics as unknown[]).includes(v));
    if (topics.length === 0) return { status: "invalid" };
    if (!isOneOf(frequencyOptions, d.frequency)) return { status: "invalid" };
    if (!isOneOf(timeOptions, d.time)) return { status: "invalid" };
    const day = isOneOf(dayOptions, d.day) ? d.day : null;
    if (d.frequency === "weekly" && day === null) return { status: "invalid" };
    const savedAt = typeof d.savedAt === "string" && !Number.isNaN(Date.parse(d.savedAt)) ? d.savedAt : undefined;
    return {
      status: "saved",
      preferences: { topics, frequency: d.frequency, day: day ?? defaultPreferences.day, time: d.time, savedAt },
    };
  } catch {
    return { status: "invalid" };
  }
}

function readRaw(studentId: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + studentId);
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
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(studentId),
    () => null,
  );
  return useMemo(() => parsePreferences(raw), [raw]);
}

/** Returns false when the browser blocks storage (e.g. private mode or full quota). */
export function savePreferences(studentId: string, preferences: Preferences): boolean {
  try {
    const record: Preferences = { ...preferences, savedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_PREFIX + studentId, JSON.stringify(record));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

const labelOf = <T extends string>(options: readonly { value: T; label: string }[], value: T) =>
  options.find((o) => o.value === value)?.label ?? "";

export function topicsText(topics: Topic[]) {
  const labels = topicOptions.filter((o) => topics.includes(o.value)).map((o) => o.label);
  return labels.map((l, i) => (i === 0 ? l : `و${l}`)).join("، ");
}

export function scheduleText(p: Preferences) {
  const when =
    p.frequency === "daily"
      ? "كل يوم دراسي (من الأحد إلى الخميس)"
      : `كل أسبوع يوم ${labelOf(dayOptions, p.day)}`;
  return `${when} الساعة ${labelOf(timeOptions, p.time)} بتوقيت السعودية`;
}

export function frequencyText(p: Preferences) {
  return p.frequency === "daily"
    ? "يوميًا (من الأحد إلى الخميس)"
    : `أسبوعيًا، يوم ${labelOf(dayOptions, p.day)}`;
}

export function timeText(p: Preferences) {
  return `${labelOf(timeOptions, p.time)} بتوقيت السعودية`;
}

export function summarySentence(p: Preferences, studentFirstName: string) {
  return `عند تفعيل الخدمة، ستصلك مكالمة ${scheduleText(p)}، يخبرك فيها المساعد الذكي عن ${topicsText(p.topics)} الخاصة بـ${studentFirstName}.`;
}
