// Types only. The records themselves live in the backend (Test_AI_Agent_Upload/Data/madrasati-dataset.json,
// served through backend/store.py) and reach the pages via src/lib/dashboard-data.tsx.
// All people, schools and records are fictional, for an educational prototype only.

import type { UnavailableOptions } from "@/components/assistant/preferences";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

/** Which assistant illustration accompanies this student in the assistant pages. Set explicitly, never inferred from the name. */
export type AssistantCharacter = "girl" | "boy";

export type Student = {
  id: string;
  name: string;
  character: AssistantCharacter;
  /** Assistant timing options this student cannot use. Unset means every option is available. */
  assistantUnavailable?: UnavailableOptions;
  firstName: string;
  gender?: "m" | "f";
  /** Subjects with records for this student; derived by the backend. */
  subjects?: string[];
  grade: string;
  stage: string;
  classroom: string;
  school: string;
  attendance: {
    termLabel: string;
    schoolDays: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    week: { day: string; date: string; status: AttendanceStatus; note?: string }[];
  };
  exams: { subject: string; kind: string; day: string; date: string; hijri: string; period: string }[];
  grades: { subject: string; assessment: string; score: number; outOf: number; date: string }[];
  announcements: { title: string; body: string; date: string; tag: string }[];
  /** Lessons the school (or the demo data) recorded; the school page writes new ones here. */
  onlineLessons?: { subject: string; date: string; status: string }[];
};

export type Parent = {
  name: string;
  shortName: string;
  role: string;
  relation: string;
  email: string;
  phone: string;
  lastLogin: string;
};

export type Today = { gregorian: string; hijri: string };

/** The school-side identity shown in the school header and banner. */
export const school = {
  name: "مدرسة رياض النخبة",
  adminName: "مسؤول المدرسة",
  role: "حساب إدارة المدرسة",
};
