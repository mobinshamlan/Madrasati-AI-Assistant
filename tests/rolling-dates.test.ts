import assert from "node:assert/strict";
import { test } from "node:test";
import { DATASET_TODAY, datasetDay, hijri, rollExam, shiftDay, shiftDays, shiftTermLabel, shiftText } from "../src/lib/tammeni/rolling-dates.ts";

const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

test("the dataset's dates are read back as the days they were written for", () => {
  assert.equal(hijri(DATASET_TODAY), "17/05/1448");
  assert.equal(datasetDay("21/05/1448"), "2026-11-01");
});

test("on any day for two years, the dataset's today is the latest Wednesday and exams are ahead", () => {
  const exams = ["21/05/1448", "23/05/1448", "25/05/1448", "29/05/1448"].map((d) => datasetDay(d)!);
  for (let n = 0; n < 730; n++) {
    const today = shiftDay(DATASET_TODAY, n);
    const days = shiftDays(today);
    const anchor = shiftDay(DATASET_TODAY, days);
    assert.equal(days % 7, 0);
    assert.equal(weekday(anchor), 3);
    assert.ok(anchor <= today && shiftDay(anchor, 7) > today, today);
    // سما has the 21st, 23rd and 29th; أحمد the 23rd and 25th. Each always has an exam still to come.
    for (const mine of [[exams[0], exams[1], exams[3]], [exams[1], exams[2]]]) {
      assert.ok(mine.some((d) => shiftDay(d, days) >= today), today);
    }
  }
});

test("an imported exam ignores a date changed by hand; a demo record keeps its own", () => {
  const days = shiftDays("2026-11-28");
  const imported = { exam_date: "2027-03-01", origin: "import", source_ref: "exam:21/05/1448:الرياضيات" };
  assert.equal(rollExam(imported, days).exam_date, "2026-11-29");
  const added = { exam_date: "2026-12-10", origin: "demo", source_ref: null };
  assert.equal(rollExam(added, days).exam_date, "2026-12-10");
});

test("dates inside notices and the term's year move too", () => {
  assert.equal(shiftText("لقاء يوم الخميس 18/05/1448 هـ", 28), `لقاء يوم الخميس ${hijri("2026-11-26")} هـ`);
  assert.equal(shiftTermLabel("الفصل الدراسي الأول 1448 هـ", 0), "الفصل الدراسي الأول 1448 هـ");
  assert.match(shiftTermLabel("الفصل الدراسي الأول 1448 هـ", 364), /1449 هـ/);
});
