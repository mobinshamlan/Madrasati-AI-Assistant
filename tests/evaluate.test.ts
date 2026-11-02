// node --test tests/   (Node 24 runs TypeScript directly by stripping types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, messageText, callOpening, riyadhInstant, riyadhDay, type SchoolEvent } from "../src/lib/tammeni/evaluate.ts";
import type { Preferences } from "../src/components/assistant/preferences.ts";

const base: Preferences = {
  attendance: { timing: "immediate", method: "call", custom: { kind: "daily", day: "thu", time: "18:00" } },
  exams: { timing: "day-before", method: "message", customDays: 2, time: "18:00" },
  grades: { timing: "immediate", method: "message", dayOfMonth: 1, time: "18:00" },
  retryUnansweredCall: false,
};
const prefs = (patch: (p: Preferences) => void) => { const p = structuredClone(base); patch(p); return p; };
const now = new Date("2026-10-29T09:00:00Z"); // 12:00 in Riyadh, Thursday 29 October
const absence: SchoolEvent = { kind: "attendance", date: "2026-10-29", status: "absent" };

test("Riyadh time is UTC+3 and calendar days follow Riyadh", () => {
  assert.equal(riyadhInstant("2026-10-29", "14:00").toISOString(), "2026-10-29T11:00:00.000Z");
  assert.equal(riyadhDay(new Date("2026-10-29T22:30:00Z")), "2026-10-30"); // 01:30 next day in Riyadh
});

test("absence with immediate attendance → ready now, by the saved method", () => {
  const d = evaluate(absence, base, now);
  assert.deepEqual([d.status, d.method, d.dueAt], ["ready", "call", null]);
});

test("a topic that is off is suppressed whatever the event", () => {
  const d = evaluate(absence, prefs((p) => (p.attendance.timing = "off")), now);
  assert.equal(d.status, "suppressed");
  assert.match(d.reason, /متوقف حسب تفضيلات ولي الأمر/);
});

test("no saved preferences → nothing is sent", () => {
  assert.equal(evaluate(absence, null, now).status, "suppressed");
});

test("an excused absence never produces an absence update", () => {
  assert.equal(evaluate({ ...absence, status: "excused" }, base, now).status, "suppressed");
});

test("end of day → waits until 2:00 PM Riyadh, then is ready", () => {
  const p = prefs((x) => (x.attendance.timing = "end-of-day"));
  const before = evaluate(absence, p, now);
  assert.deepEqual([before.status, before.dueAt], ["waiting", "2026-10-29T11:00:00.000Z"]);
  assert.equal(evaluate(absence, p, new Date("2026-10-29T11:00:00Z")).status, "ready");
});

test("weekly summary → next chosen weekday at the chosen time", () => {
  const p = prefs((x) => { x.attendance.timing = "custom"; x.attendance.custom = { kind: "weekly", day: "tue", time: "19:30" }; });
  const d = evaluate(absence, p, now); // Thu 29 Oct → Tue 3 Nov 19:30 Riyadh
  assert.deepEqual([d.status, d.dueAt], ["waiting", "2026-11-03T16:30:00.000Z"]);
});

test("exam reminder respects the day count and time, across a UTC date change", () => {
  const exam: SchoolEvent = { kind: "exam_added", date: "2026-10-29", examDate: "2026-11-01", startTime: null, subject: "الرياضيات", examKind: "اختبار قصير" };
  // 1 day before at 01:00 Riyadh = 31 Oct 01:00 Riyadh = 30 Oct 22:00 UTC (a different UTC day).
  const d = evaluate(exam, prefs((x) => (x.exams.time = "01:00")), now);
  assert.deepEqual([d.status, d.dueAt], ["waiting", "2026-10-30T22:00:00.000Z"]);
  const custom = evaluate({ ...exam, examDate: "2026-11-20" }, prefs((x) => { x.exams.timing = "custom"; x.exams.customDays = 14; }), now);
  assert.equal(custom.dueAt, "2026-11-06T15:00:00.000Z");
  assert.match(custom.reason, /بـ14 يومًا/);
});

test("a reminder whose time has passed for a coming exam is ready; a past exam is not", () => {
  const exam: SchoolEvent = { kind: "exam_added", date: "2026-10-29", examDate: "2026-10-30", startTime: null, subject: "العلوم", examKind: "عملي" };
  assert.equal(evaluate(exam, prefs((x) => (x.exams.time = "08:00")), now).status, "ready"); // due 29 Oct 08:00
  assert.equal(evaluate({ ...exam, examDate: "2026-10-28" }, base, now).status, "suppressed");
});

test("exam cancellation goes out directly while exams are on; not when off", () => {
  const c: SchoolEvent = { kind: "exam_cancelled", date: "2026-10-29", examDate: "2026-11-01", subject: "الرياضيات", examKind: "قصير" };
  assert.equal(evaluate(c, base, now).status, "ready");
  assert.equal(evaluate(c, prefs((x) => (x.exams.timing = "off")), now).status, "suppressed");
});

test("grades: immediate is ready; monthly waits for day D of next month and covers this month only", () => {
  const g: SchoolEvent = { kind: "grade_published", date: "2026-10-29", subject: "العلوم", assessment: "مشروع", score: 18, outOf: 20 };
  assert.equal(evaluate(g, base, now).status, "ready");
  const m = evaluate(g, prefs((x) => { x.grades.timing = "monthly"; x.grades.dayOfMonth = 5; }), now);
  assert.deepEqual([m.status, m.dueAt, m.window], ["waiting", "2026-11-05T15:00:00.000Z", { start: "2026-10-01", end: "2026-10-31" }]);
});

test("message and call words carry only this update's facts", () => {
  const d = evaluate(absence, base, now);
  const input = { student: { fullName: "ريم عبدالرحمن الشهري", firstName: "ريم" }, event: absence, decision: d };
  assert.equal(messageText(input), "طمّني | ريم عبدالرحمن الشهري\nتحديث حضور ريم:\nالحضور يوم الخميس 29 أكتوبر: غياب.");
  assert.match(callOpening(input), /^مرحبا، معك لولوة من طمّني\./);
  assert.doesNotMatch(callOpening(input), /درجة|اختبار/);
});

test("exam calls and messages name the subject without saying oral or short", () => {
  const exam: SchoolEvent = { kind: "exam_added", date: "2026-10-29", examDate: "2026-11-01", startTime: "10:00", subject: "الرياضيات", examKind: "اختبار شفهي" };
  for (const event of [exam, { ...exam, kind: "exam_cancelled" as const }]) {
    const input = { student: { fullName: "نواف عبدالرحمن الشهري", firstName: "نواف" }, event, decision: evaluate(event, base, now) };
    assert.match(callOpening(input), /الرياضيات/);
    assert.doesNotMatch(callOpening(input), /شفهي|قصير/);
    assert.doesNotMatch(messageText(input), /شفهي|قصير/);
  }
});
