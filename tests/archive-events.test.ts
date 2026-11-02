import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveDemoEvents } from "../src/lib/tammeni/archive-events.ts";

type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>) {
  return { from(table: string) {
    const filters: ((row: Row) => boolean)[] = [];
    let patch: Row | null = null;
    const query = {
      select() { return query; },
      update(value: Row) { patch = value; return query; },
      eq(key: string, value: unknown) { filters.push(r => r[key] === value); return query; },
      is(key: string, value: null) { filters.push(r => (r[key] ?? null) === value); return query; },
      in(key: string, values: unknown[]) { filters.push(r => values.includes(r[key])); return query; },
      then(resolve: (result: { data: Row[]; error: null }) => unknown) {
        const rows = (tables[table] ?? []).filter(r => filters.every(fn => fn(r)));
        if (patch) rows.forEach(r => Object.assign(r, patch));
        return Promise.resolve(resolve({ data: rows.map(r => ({ ...r })), error: null }));
      },
    };
    return query;
  } } as unknown as SupabaseClient;
}

test("deleting one event archives only its records and keeps previous deliveries", async () => {
  const events = [
    { id: "a", student_id: "reem", kind: "attendance", payload: {}, archived_at: null },
    { id: "b", student_id: "reem", kind: "grade_published", payload: {}, archived_at: null },
    { id: "c", student_id: "nawaf", kind: "attendance", payload: {}, archived_at: null },
  ];
  const tables = { demo_events: events, attendance_records: [
    { student_id: "reem", demo_event_id: "a", archived_at: null },
    { student_id: "nawaf", demo_event_id: "c", archived_at: null },
    { student_id: "reem", demo_event_id: null, origin: "import", archived_at: null },
  ], notifications: [
    { id: "n1", student_id: "reem", demo_event_id: "a", status: "ready" },
    { id: "n2", student_id: "reem", demo_event_id: "a", status: "delivered" },
    { id: "n3", student_id: "reem", demo_event_id: "b", status: "ready" },
  ], dispatch_attempts: [{ id: "attempt", notification_id: "n2", status: "delivered" }] };
  const result = await archiveDemoEvents(database(tables), "reem", "a");
  assert.deepEqual(result, { cleared: 1, cancelled: 1, alreadySent: 1 });
  assert.ok(events[0].archived_at);
  assert.equal(events[1].archived_at, null);
  assert.equal(events[2].archived_at, null);
  assert.ok(tables.attendance_records[0].archived_at);
  assert.equal(tables.attendance_records[1].archived_at, null);
  assert.equal(tables.attendance_records[2].archived_at, null);
  assert.equal(tables.notifications[0].status, "cancelled");
  assert.equal(tables.notifications[1].status, "delivered");
  assert.equal(tables.notifications[2].status, "ready");
  assert.equal(tables.dispatch_attempts.length, 1);
  assert.equal((await archiveDemoEvents(database(tables), "reem", "a")).cleared, 0);
  assert.equal((await archiveDemoEvents(database(tables), "reem", "c")).cleared, 0);
});

test("deleting a cancellation or excuse restores the linked record without reviving alerts", async () => {
  const tables = {
    demo_events: [
      { id: "absent", student_id: "reem", kind: "attendance", payload: { status: "late" }, archived_at: null },
      { id: "excuse", student_id: "reem", kind: "excuse_accepted", payload: { attendanceEventId: "absent" }, archived_at: null },
      { id: "cancel", student_id: "reem", kind: "exam_cancelled", payload: { examId: "exam" }, archived_at: null },
    ],
    attendance_records: [{ student_id: "reem", demo_event_id: "absent", origin: "demo", status: "excused", archived_at: null }],
    exams: [{ id: "exam", student_id: "reem", status: "cancelled", archived_at: null }],
    notifications: [{ id: "n", student_id: "reem", demo_event_id: "absent", status: "cancelled" }],
  };
  const db = database(tables);
  await archiveDemoEvents(db, "reem", "excuse");
  assert.equal(tables.attendance_records[0].status, "late");
  assert.equal(tables.notifications[0].status, "cancelled");
  await archiveDemoEvents(db, "reem", "cancel");
  assert.equal(tables.exams[0].status, "scheduled");
});
