import { test } from "node:test";
import assert from "node:assert/strict";
import { autoDispatchEnabled, autoRealAllowed, dispatchSecretValid, maxLateMs, planBatches, tooLate, type DueItem } from "../src/lib/tammeni/auto-dispatch.ts";
import type { Decision } from "../src/lib/tammeni/evaluate.ts";

const decision = (over: Partial<Decision>): Decision => ({ topic: "attendance", status: "ready", method: "message", dueAt: null, reason: "", window: null, ...over });
const item = (id: string, eventDate: string, d: Partial<Decision>, studentId = "s1"): DueItem => ({ id, studentId, topic: d.topic ?? "attendance", eventDate, decision: decision(d), prefsVersion: "v1" });

test("the scheduler secret fails closed", () => {
  assert.equal(dispatchSecretValid({}, "anything"), false);
  assert.equal(dispatchSecretValid({ TAMMENI_DISPATCH_SECRET: "" }, ""), false);
  assert.equal(dispatchSecretValid({ TAMMENI_DISPATCH_SECRET: "right" }, null), false);
  assert.equal(dispatchSecretValid({ TAMMENI_DISPATCH_SECRET: "right" }, "wrong"), false);
  assert.equal(dispatchSecretValid({ TAMMENI_DISPATCH_SECRET: "right" }, "right"), true);
});

test("nothing runs unless explicitly enabled", () => {
  assert.equal(autoDispatchEnabled({}), false);
  assert.equal(autoDispatchEnabled({ TAMMENI_AUTO_DISPATCH: "true" }), false);
  assert.equal(autoDispatchEnabled({ TAMMENI_AUTO_DISPATCH: "1" }), true);
});

test("real sending needs both switches", () => {
  assert.equal(autoRealAllowed({ TAMMENI_AUTO_DISPATCH: "1" }), false);
  assert.equal(autoRealAllowed({ TAMMENI_AUTO_DISPATCH_REAL: "1" }), false);
  assert.equal(autoRealAllowed({ TAMMENI_DEMO_REAL_DISPATCH: "1" }), false);
  assert.equal(autoRealAllowed({ TAMMENI_AUTO_DISPATCH_REAL: "1", TAMMENI_DEMO_REAL_DISPATCH: "1" }), true);
});

test("the lateness limit falls back to two hours on a bad value", () => {
  assert.equal(maxLateMs({}), 7_200_000);
  assert.equal(maxLateMs({ TAMMENI_AUTO_DISPATCH_MAX_LATE_MINUTES: "abc" }), 7_200_000);
  assert.equal(maxLateMs({ TAMMENI_AUTO_DISPATCH_MAX_LATE_MINUTES: "30" }), 1_800_000);
});

test("an old update is left for the operator; immediate updates age from when they were recorded", () => {
  const now = new Date("2026-03-01T12:00:00Z");
  const limit = 3_600_000;
  assert.equal(tooLate(decision({ dueAt: "2026-03-01T11:30:00.000Z" }), 0, now, limit), false);
  assert.equal(tooLate(decision({ dueAt: "2026-03-01T10:30:00.000Z" }), 0, now, limit), true);
  assert.equal(tooLate(decision({}), Date.parse("2026-03-01T11:30:00Z"), now, limit), false);
  assert.equal(tooLate(decision({}), Date.parse("2026-03-01T10:30:00Z"), now, limit), true);
});

test("attendance days sharing one summary time become one message", () => {
  const due = "2026-03-03T16:37:00.000Z";
  const [batch, ...rest] = planBatches([item("b", "2026-03-02", { dueAt: due }), item("a", "2026-03-01", { dueAt: due })]);
  assert.equal(rest.length, 0);
  assert.equal(batch.primary.id, "a");
  assert.deepEqual(batch.members.map((m) => m.id), ["b"]);
});

test("a month of grades becomes one summary; children and immediate updates stay separate", () => {
  const window = { start: "2026-02-01", end: "2026-02-28" };
  const grades = planBatches([
    item("g1", "2026-02-02", { topic: "grades", dueAt: "2026-03-01T15:00:00.000Z", window }),
    item("g2", "2026-02-20", { topic: "grades", dueAt: "2026-03-01T15:00:00.000Z", window }),
    item("g3", "2026-02-20", { topic: "grades", dueAt: "2026-03-01T15:00:00.000Z", window }, "s2"),
  ]);
  assert.equal(grades.length, 2);
  assert.equal(planBatches([item("i1", "2026-03-01", {}), item("i2", "2026-03-02", {})]).length, 2);
  assert.equal(planBatches([item("e1", "2026-03-01", { topic: "exams", dueAt: "2026-03-03T15:00:00.000Z" }), item("e2", "2026-03-01", { topic: "exams", dueAt: "2026-03-03T15:00:00.000Z" })]).length, 2);
});
