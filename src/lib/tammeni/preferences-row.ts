// public.assistant_preferences row ↔ the website's Preferences. Every detailed choice is kept as it is.
import type { Preferences } from "../../components/assistant/preferences";

export type PreferencesRow = {
  attendance_timing: string;
  attendance_method: string;
  attendance_custom_kind: string;
  attendance_custom_day: string;
  attendance_custom_time: string;
  exams_timing: string;
  exams_method: string;
  exams_custom_days: number;
  exams_time: string;
  grades_timing: string;
  grades_method: string;
  grades_day_of_month: number;
  grades_time: string;
  retry_unanswered_call: boolean;
  updated_at?: string;
};

export const PREFERENCE_COLUMNS =
  "attendance_timing, attendance_method, attendance_custom_kind, attendance_custom_day, attendance_custom_time, " +
  "exams_timing, exams_method, exams_custom_days, exams_time, grades_timing, grades_method, grades_day_of_month, grades_time, " +
  "retry_unanswered_call, updated_at";

/** Postgres returns "18:00:00"; the website keeps "18:00". */
const hhmm = (t: string) => t.slice(0, 5);

// The database checks every value, so a row read back is always a complete, valid choice.
export function rowToPreferences(row: PreferencesRow): Preferences {
  return {
    attendance: {
      timing: row.attendance_timing as Preferences["attendance"]["timing"],
      method: row.attendance_method as Preferences["attendance"]["method"],
      custom: {
        kind: row.attendance_custom_kind as Preferences["attendance"]["custom"]["kind"],
        day: row.attendance_custom_day as Preferences["attendance"]["custom"]["day"],
        time: hhmm(row.attendance_custom_time),
      },
    },
    exams: {
      timing: row.exams_timing as Preferences["exams"]["timing"],
      method: row.exams_method as Preferences["exams"]["method"],
      customDays: row.exams_custom_days,
      time: hhmm(row.exams_time),
    },
    grades: {
      timing: row.grades_timing as Preferences["grades"]["timing"],
      method: row.grades_method as Preferences["grades"]["method"],
      dayOfMonth: row.grades_day_of_month,
      time: hhmm(row.grades_time),
    },
    retryUnansweredCall: row.retry_unanswered_call,
    savedAt: row.updated_at,
  };
}

/** Only for complete choices (the wizard saves only after its own validation passes). */
export function preferencesToRow(p: Preferences): Omit<PreferencesRow, "updated_at"> {
  if (p.attendance.timing === null || p.exams.timing === null || p.grades.timing === null) {
    throw new Error("Preferences still need a choice.");
  }
  return {
    attendance_timing: p.attendance.timing,
    attendance_method: p.attendance.method,
    attendance_custom_kind: p.attendance.custom.kind,
    attendance_custom_day: p.attendance.custom.day,
    attendance_custom_time: p.attendance.custom.time,
    exams_timing: p.exams.timing,
    exams_method: p.exams.method,
    exams_custom_days: p.exams.customDays,
    exams_time: p.exams.time,
    grades_timing: p.grades.timing,
    grades_method: p.grades.method,
    grades_day_of_month: p.grades.dayOfMonth,
    grades_time: p.grades.time,
    retry_unanswered_call: p.retryUnansweredCall,
  };
}

/** The column defaults in the database, which equal the website's defaultPreferences. */
export const DEFAULT_ROW: Omit<PreferencesRow, "updated_at"> = {
  attendance_timing: "end-of-day",
  attendance_method: "call",
  attendance_custom_kind: "daily",
  attendance_custom_day: "thu",
  attendance_custom_time: "18:00",
  exams_timing: "day-before",
  exams_method: "call",
  exams_custom_days: 2,
  exams_time: "18:00",
  grades_timing: "monthly",
  grades_method: "call",
  grades_day_of_month: 1,
  grades_time: "18:00",
  retry_unanswered_call: false,
};
