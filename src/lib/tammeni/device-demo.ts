import { students, type Student } from "@/components/dashboard/data";
import type { Preferences } from "@/components/assistant/preferences";
import type { DashboardStudent, LinkedStudent, SavedPreferences } from "./parent-data";
import { riyadhDay } from "./evaluate";
import { datasetDay, hijri, shiftDay, shiftDays, shiftTermLabel, shiftText } from "./rolling-dates";

/**
 * The public demo runs on the visitor's own device: the fictional family ships with the site, and what a
 * visitor chooses is kept in that browser only. So every visitor starts fresh, sees only their own choices
 * (kept for their next visit), and the tour opens at once with no sign-in and no database to wait for.
 *
 * Building with NEXT_PUBLIC_TAMMENI_SERVER_DEMO=1 brings back the shared Supabase demo parent instead.
 */
export const DEVICE_DEMO = process.env.NEXT_PUBLIC_TAMMENI_SERVER_DEMO !== "1";

const sessionKey = "tammeni-demo:v1:entered";
const prefsKey = (id: string) => `tammeni-demo:v1:prefs:${id}`;

// Used when the browser refuses storage (some private windows): choices then last until the tab closes.
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string | null) {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Kept in memory above.
  }
}

export const deviceEntered = () => read(sessionKey) === "1";
export const setDeviceEntered = (on: boolean) => write(sessionKey, on ? "1" : null);

export const deviceLinkedStudents = (): LinkedStudent[] =>
  students.map((s) => ({
    dbId: s.id,
    id: s.id,
    name: s.name,
    firstName: s.firstName,
    grade: s.grade,
    stage: s.stage,
    classroom: s.classroom,
    school: s.school,
  }));

const arabic = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: "UTC", ...options }).format(new Date(`${day}T00:00:00Z`));

/** One child's records, with the school calendar moved up to this week (see rolling-dates). */
export function deviceDashboardStudent(id: string, today = riyadhDay(new Date())): DashboardStudent {
  const s: Student | undefined = students.find((x) => x.id === id);
  if (!s) throw new Error("هذا الطالب غير موجود في البيانات التجريبية.");
  const moved = shiftDays(today);
  const year = s.attendance.termLabel.match(/14\d{2}(?= هـ)/)?.[0] ?? "";
  const movedShort = (short: string) => {
    const day = datasetDay(`${short}/${year}`);
    return day ? hijri(shiftDay(day, moved)).slice(0, 5) : short;
  };
  const exams = s.exams
    .map((exam) => ({ exam, iso: shiftDay(datasetDay(exam.hijri)!, moved) }))
    .sort((a, b) => a.iso.localeCompare(b.iso));
  return {
    ...s,
    attendance: {
      ...s.attendance,
      termLabel: shiftTermLabel(s.attendance.termLabel, moved),
      // «اليوم» was the dataset's own today, so it is not carried over.
      week: s.attendance.week.map((w) => ({ ...w, date: movedShort(w.date), note: w.note === "اليوم" ? undefined : w.note })),
    },
    exams: exams.map(({ exam, iso }) => ({ ...exam, day: arabic(iso, { weekday: "long" }), date: arabic(iso, { day: "numeric", month: "long" }), hijri: hijri(iso) })),
    grades: s.grades.map((g) => ({ ...g, date: shiftText(g.date, moved) })),
    announcements: s.announcements.map((n) => ({ ...n, body: shiftText(n.body, moved), date: shiftText(n.date, moved) })),
    simulated: { attendanceDays: 0, exams: 0, grades: 0 },
    examDates: exams.map(({ exam, iso }) => ({ subject: exam.subject, kind: exam.kind, examDate: iso, startTime: null, cancelled: false })),
  };
}

export function deviceReadPreferences(id: string): SavedPreferences {
  try {
    const raw = read(prefsKey(id));
    if (!raw) return { exists: false };
    const preferences = JSON.parse(raw) as Preferences;
    return { exists: true, preferences, updatedAt: preferences.savedAt ?? "" };
  } catch {
    return { exists: false };
  }
}

export function deviceSavePreferences(id: string, preferences: Preferences) {
  write(prefsKey(id), JSON.stringify({ ...preferences, savedAt: new Date().toISOString() }));
}

export const deviceResetPreferences = (id: string) => write(prefsKey(id), null);
