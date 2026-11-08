// A parent's own schedule must survive storage and drive the due time exactly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../src/lib/tammeni/evaluate.ts";
import { preferencesToRow, rowToPreferences } from "../src/lib/tammeni/preferences-row.ts";
import type { Preferences } from "../src/components/assistant/preferences.ts";

const custom: Preferences = {
  attendance: { timing: "custom", method: "message", custom: { kind: "weekly", day: "tue", time: "19:37" } },
  exams: { timing: "custom", method: "call", customDays: 14, time: "07:05" },
  grades: { timing: "monthly", method: "message", dayOfMonth: 17, time: "00:00" },
  retryUnansweredCall: false,
};
// Postgres `time` columns come back with seconds.
const fromDb = () => {
  const row = preferencesToRow(custom);
  const stored = { ...row, attendance_custom_time: `${row.attendance_custom_time}:00`, exams_time: `${row.exams_time}:00`, grades_time: `${row.grades_time}:00` };
  return rowToPreferences(stored);
};
const now = new Date("2026-01-01T00:00:00Z");

test("custom choices are unchanged after a database round trip", () => {
  const read = fromDb();
  delete read.savedAt;
  assert.deepEqual(read, custom);
});

test("a weekly custom time is due on the chosen day at that Saudi time", () => {
  // Sunday 2026-03-01 → next Tuesday 2026-03-03, 19:37 Riyadh = 16:37 UTC.
  const d = evaluate({ kind: "attendance", date: "2026-03-01", status: "absent" }, fromDb(), now);
  assert.equal(d.status, "waiting");
  assert.equal(d.dueAt, "2026-03-03T16:37:00.000Z");
  assert.equal(d.method, "message");
});

test("custom exam days and time set the reminder", () => {
  const d = evaluate({ kind: "exam_added", date: "2026-02-01", examDate: "2026-03-15", startTime: null, subject: "علوم", examKind: "شهري" }, fromDb(), now);
  // 14 days before, 07:05 Riyadh = 04:05 UTC.
  assert.equal(d.dueAt, "2026-03-01T04:05:00.000Z");
});

test("the monthly day and midnight are kept", () => {
  const d = evaluate({ kind: "grade_published", date: "2026-02-10", subject: "علوم", assessment: "واجب", score: 9, outOf: 10 }, fromDb(), now);
  // Day 17 of the next month, 00:00 Riyadh = 21:00 UTC the day before.
  assert.equal(d.dueAt, "2026-03-16T21:00:00.000Z");
});
