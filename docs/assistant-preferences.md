# Assistant preferences (prototype)

The `/assistant` page only **records** a parent's preferences, per student, in the browser's
`localStorage`. Nothing is sent, scheduled, called or stored in Supabase. The rules below describe
the intended behaviour for a future delivery service; none of it is implemented.

All times are Saudi time (Asia/Riyadh).

## Stored record (`madrasati-demo:assistant-preferences:v4:<studentId>`)

| Field | Values |
| --- | --- |
| `attendance.timing` | `immediate` · `end-of-day` · `custom` · `off` |
| `attendance.custom` | `{ kind: "daily" \| "weekly", day: sun…sat, time }` — used only when timing is `custom` (`day` only matters for `weekly`) |
| `exams.timing` | `day-before` · `week-before` · `custom` · `off` |
| `exams.customDays` | any whole number 1–30 — used only when timing is `custom` (chosen from a native dropdown) |
| `exams.time` | a time of day, for every enabled exam option |
| `grades.timing` | `immediate` · `monthly` · `off` (no custom option) |
| `grades.dayOfMonth` | integer 1–28 (29–31 do not exist in every month); used for `monthly`; chosen from a compact number select and shown as «يوم ٥ من كل شهر» |
| `grades.time` | a time of day; used for `monthly` |
| `<topic>.method` | `call` · `message` (generic — no SMS/WhatsApp channel chosen yet) |
| `retryUnansweredCall` | boolean |

### Times

Every time field (`attendance.custom.time`, `exams.time`, `grades.time`) is a 24-hour `"HH:MM"`
string in Saudi time, hour `00`–`23` and minute `00`–`59`. The UI offers three quick choices —
`13:00` (1:00 ظهرًا), `16:00` (4:00 عصرًا) and `18:00` (6:00 مساءً) — and «وقت آخر», which opens three
labelled native selects: الساعة (1–12), الدقيقة (00–59) and الفترة (صباحًا / مساءً). The 12-hour
display does not depend on the browser locale. Conversion is exact: 12 صباحًا = `00:00`,
12 مساءً = `12:00`, 1 مساءً = `13:00`, 11:59 مساءً = `23:59`. A saved time that is not a quick choice
(for example the earlier `20:00`) loads with «وقت آخر» selected and shows as 8 مساءً. Summaries show
Arabic text such as `8:00 مساءً`; `00:00` is `12:00 صباحًا (منتصف الليل)` and `12:00` is
`12:00 مساءً (الظهر)`. A stored time that is not a valid `HH:MM` is rejected as damaged data. `end-of-day` attendance does not use these
fields; it uses the fixed after-school time below.

At least one topic must be enabled, and every day, number and time that applies to an enabled
option must be valid. Turning a topic off keeps its other settings so they return
when it is turned back on. There is no shared contact time any more.

Defaults: attendance `end-of-day`, exams `day-before`, grades `monthly` on day 1; every method
`call`; every time `18:00`; custom attendance daily; custom exam days 2; custom weekly day Thursday.

## Prototype assumption: the after-school time

`end-of-day` uses one fixed time for everyone, **2:00 مساءً** (`14:00`), defined once in
`src/components/assistant/config.ts` (`AFTER_SCHOOL_TIME`). It is a prototype assumption, not an
official school dismissal time, and every screen says so. Change the constant to change it
everywhere. Parents who want another time choose `custom`.

## Intended delivery rules (not implemented)

**Attendance**
- `immediate`: contact the parent whenever an attendance, absence or lateness record is entered —
  not only for absences — using the topic's method. There is no time of day.
- `end-of-day`: one summary each school day at the fixed after-school time.
- `custom`: a daily summary at the chosen time, or a weekly summary on the chosen day and time.
- An approved excused absence never triggers contact. If the excuse is approved while a
  notification about that absence is still pending, cancel that notification.

**Exams**
- Remind the parent 1 day, 7 days, or a chosen number of days (1–30) before each exam, at the topic's time.
- While exam notifications are enabled, an exam cancellation is also sent through the same method.

**Grades**
- `immediate`: a separate update for each subject when its grade is published. No time of day.
- `monthly`: on the chosen day of the month and time, one combined summary of all subjects' grades
  newly published during the previous full month. Send nothing if there are no new grades.

**Combining and retries**
- Scheduled updates are combined into one contact only when they are for the same student **and**
  have the same date, time and communication method. Immediate updates are never delayed to be
  combined.
- `retryUnansweredCall`: if a **call** goes unanswered, call once more after 5 minutes. One retry
  only, and never for messages.

## Older records

Earlier versions stored `v1` (one daily/weekly setting for everything), `v2` (per-topic daily/weekly
and one shared time) and `v3` (shared time, free-text «أخرى»). They are read only when no `v4`
record exists, and converted where there is an exact equivalent:

| Older setting | Becomes |
| --- | --- |
| attendance `immediate` (v3) | `immediate` |
| attendance `end-of-day` (v3) or daily (v1/v2) | `end-of-day`, now at the fixed prototype time — the parent is told |
| attendance weekly (v1/v2) | `custom` weekly on the same day at the old shared time |
| exams `day-before` / `week-before` (v3), implicit day-before (v2) | same option at the old shared time |
| grades `immediate` (v3) | `immediate` |
| grades `monthly` (v3) | `monthly`, day 1, at the old shared time — the parent is told |
| unselected topics, methods, retry | unchanged (v1/v2 methods are `call`) |

Anything else has no structured equivalent and is **not** guessed: weekly/daily exams and
weekly/daily grades from v1/v2, and any free-text «أخرى» request from v3. The topic is left
unchosen, the old value (or the parent's written request, shown as a previous request and never
interpreted) is displayed, and the parent must choose a replacement before saving. Older records
are removed only after the new record saves successfully.
