import { isEnabled, needsTime, problemsFor, topics, type Preferences, type Topic } from "./preferences";

// Nothing is picked for the parent. A draft still needs a value in every field, so this keeps note of
// which ones the parent has actually pressed: only those show as selected, and only they count.
// Keys look like "exams:method". A saved record counts the fields that apply to what was saved.

export type Field = "enabled" | "method" | "timing" | "kind" | "day" | "time" | "days" | "dayOfMonth";
export const key = (topic: Topic, field: Field) => `${topic}:${field}`;

/** The fields the parent has to answer for one topic, given the answers so far. */
function asked(p: Preferences, topic: Topic, has: (field: Field) => boolean): Field[] {
  const fields: Field[] = ["enabled"];
  if (!has("enabled") || p[topic].timing === "off") return fields;
  fields.push("method", "timing");
  if (!has("timing") || !isEnabled(p, topic)) return fields;
  if (topic === "attendance" && p.attendance.timing === "custom") {
    fields.push("kind");
    if (has("kind") && p.attendance.custom.kind === "weekly") fields.push("day");
  }
  if (topic === "exams" && p.exams.timing === "custom") fields.push("days");
  if (topic === "grades" && p.grades.timing === "monthly") fields.push("dayOfMonth");
  if (needsTime(p, topic)) fields.push("time");
  return fields;
}

/** The first thing the parent has not answered for a topic, or null when it is complete. */
export function firstMissing(p: Preferences, chosen: ReadonlySet<string>, topic: Topic): Field | null {
  const has = (field: Field) => chosen.has(key(topic, field));
  const unanswered = asked(p, topic, has).find((field) => !has(field));
  if (unanswered) return unanswered;
  const problem = problemsFor(p, topic)[0];
  return problem ? (problem.kind === "time" ? "time" : "timing") : null;
}

/** What a saved record already answers. */
export function chosenInSaved(p: Preferences): Set<string> {
  const chosen = new Set<string>();
  for (const topic of topics) for (const field of asked(p, topic, () => true)) chosen.add(key(topic, field));
  return chosen;
}

/** The draft as the parent has filled it: a topic with anything unanswered reads as still to be chosen. */
export function asAnswered(p: Preferences, chosen: ReadonlySet<string>): Preferences {
  let shown = p;
  for (const topic of topics) {
    if (firstMissing(p, chosen, topic)) shown = { ...shown, [topic]: { ...shown[topic], timing: null } } as Preferences;
  }
  return shown;
}

export const missingMessage: Record<Field, string> = {
  enabled: "اختر «نعم» أو «لا» للمتابعة.",
  method: "اختر كيف يوصلك الخبر للمتابعة.",
  timing: "اختر الموعد للمتابعة.",
  kind: "اختر كم مرة تبي الملخص للمتابعة.",
  day: "اختر يوم الملخص للمتابعة.",
  time: "اختر الساعة للمتابعة.",
  days: "اختر قبل الاختبار بكم يوم للمتابعة.",
  dayOfMonth: "اختر يوم الشهر للمتابعة.",
};
