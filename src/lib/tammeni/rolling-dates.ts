// The fictional school calendar moves with the real one, so the demo never goes stale.
//
// The dataset was written as seen on one day (Wednesday 17/05/1448). Everything imported from it is shown
// moved forward by whole weeks, so that day is always the latest Wednesday: attendance, grades and notices
// are recent and the exams are still ahead. Whole weeks keep every weekday as it was. Nothing is written to
// the database, and records added from the demo control page keep their real dates.

/** The dataset's «today», as a Gregorian day. */
export const DATASET_TODAY = "2026-10-28";

const DAY = 86_400_000;
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);

const hijriFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

/** "2026-11-01" → "21/05/1448" */
export function hijri(day: string) {
  const p = Object.fromEntries(hijriFmt.formatToParts(new Date(toTime(day))).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${parseInt(p.year, 10)}`;
}

/** The Gregorian day of a dataset date such as "21/05/1448", searched around the dataset's own weeks. */
export function datasetDay(text: string): string | null {
  for (let n = -200; n <= 200; n++) {
    const day = toDay(toTime(DATASET_TODAY) + n * DAY);
    if (hijri(day) === text) return day;
  }
  return null;
}

/** How many days (always whole weeks) the calendar has moved by `today`. */
export function shiftDays(today: string) {
  return Math.max(0, Math.floor((toTime(today) - toTime(DATASET_TODAY)) / (7 * DAY)) * 7);
}

export const shiftDay = (day: string, days: number) => toDay(toTime(day) + days * DAY);

/** Moves every dataset date written inside a text ("يوم الخميس 18/05/1448 هـ"). */
export function shiftText(text: string, days: number) {
  return text.replace(/\d{2}\/\d{2}\/14\d{2}/g, (found) => {
    const day = datasetDay(found);
    return day ? hijri(shiftDay(day, days)) : found;
  });
}

/** The term's name carries the Hijri year, which follows the moved calendar. */
export function shiftTermLabel(label: string, days: number) {
  return label.replace(/14\d{2}(?= هـ)/, hijri(shiftDay(DATASET_TODAY, days)).slice(-4));
}

/**
 * An imported exam on the moved calendar. Its own date is read from `source_ref` ("exam:21/05/1448:…"), so
 * it does not matter if the stored `exam_date` was changed by hand.
 */
export function rollExam<T extends { exam_date: string; origin: string; source_ref: string | null; hijri_text?: string | null }>(row: T, days: number): T {
  if (row.origin !== "import") return row;
  const written = row.source_ref?.split(":")[1];
  const original = (written && datasetDay(written)) || row.exam_date;
  return { ...row, exam_date: shiftDay(original, days), hijri_text: null };
}
