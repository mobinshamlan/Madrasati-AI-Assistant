import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callStudentData } from "../src/lib/tammeni/call-student-data.ts";

type Row = Record<string, string | number | null>;
function database(tables: Record<string, Row[]>, fail = false) {
  return { from(table: string) {
    let rows = tables[table] ?? [];
    const query = {
      select() { return query; },
      eq(key: string, value: string) { rows = rows.filter(r => r[key] === value); return query; },
      is(key: string, value: null) { rows = rows.filter(r => (r[key] ?? null) === value); return query; },
      lte(key: string, value: string) { rows = rows.filter(r => String(r[key]) <= value); return query; },
      order() { return query; },
      async range(start: number, end: number) { return { data: rows.slice(start, end + 1), error: fail ? { message: "offline" } : null }; },
    };
    return query;
  } } as unknown as SupabaseClient;
}

test("call questions get current published records for the selected student only", async () => {
  const tables = { grades: [
    { student_id: "sama", score: 9, published_on: "2026-10-29", archived_at: null },
    { student_id: "ahmad", score: 2, published_on: "2026-10-29", archived_at: null },
    { student_id: "sama", score: 1, published_on: "2026-10-20", archived_at: "deleted" },
    { student_id: "sama", score: 3, published_on: "2026-11-01", archived_at: null },
  ] };
  const db = database(tables);
  const first = await callStudentData(db, "sama", "2026-10-29");
  assert.deepEqual(first.records.grades.map(r => r.score), [9]);
  assert.equal(first.student_id, "sama");
  tables.grades.push({ student_id: "sama", score: 10, published_on: "2026-10-29", archived_at: null });
  const second = await callStudentData(db, "sama", "2026-10-29");
  assert.equal(second.records.grades.length, 2);
});

test("call snapshots paginate records and fail instead of using stale data", async () => {
  const rows = Array.from({ length: 501 }, (_, id) => ({ id, student_id: "sama", archived_at: null }));
  const snapshot = await callStudentData(database({ attendance_records: rows }), "sama", "2026-10-29");
  assert.equal(snapshot.records.attendance_records.length, 501);
  await assert.rejects(callStudentData(database({}, true), "sama", "2026-10-29"));
});
