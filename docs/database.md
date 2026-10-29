# Database structure

> **Update 2026-10-29:** two more migrations (`20261029101954_demo_school_records`, `20261029103638_attempt_provider_update`) add the imported school records, simulated events, update decisions and the operator role. See `docs/demo-control.md`.

**Applied on 2026-10-28** to the Supabase project `nbbegxzicokiblvbszor` ("Madrasati AI
Assistant."), starting with the two fictional students from `seed.sql`. Later migrations and the
demo import (see `docs/demo-control.md`) add school records, demo Auth roles, preferences storage,
events and dispatch tables. The website reads and writes preferences through Supabase with the
signed-in demo parent; older browser `localStorage` preferences may still be offered as a one-time
import into the review. Automatic scheduling and real SMS/calls are not on by default (mock provider).

| File | What it does |
| --- | --- |
| `supabase/migrations/20261028163712_parents_and_students.sql` | `parent_profiles`, `students`, `parent_students` and their RLS |
| `supabase/migrations/20261028163738_assistant_preferences.sql` | `assistant_preferences` and its RLS |
| `supabase/seed.sql` | The two fictional students only (ريم، فيصل). No users, no links |
| `supabase/admin/link-test-parent.sql` | Admin script: link one existing Auth test user to one student |
| `supabase/tests/rls_two_parents.sql` | Two-parent access test. Local or branch databases only; rolls back |

## Structure

```
auth.users ──1:1── parent_profiles ──< parent_students >── students
                                            │
                                            └──1:1── assistant_preferences
```

- **`parent_profiles`**: one row per parent; `id` is the Supabase Auth user id.
- **`students`**: school records. `demo_key` (`reem`, `faisal`) matches the prototype's student ids.
- **`parent_students`**: which parent may see which student. Primary key `(parent_id, student_id)`.
- **`assistant_preferences`**: one flat row per parent–student pair (`unique (parent_id, student_id)`).
  Its foreign key points at the link itself, so a record can only exist for a real link and is
  deleted when the link is removed.

One flat row was chosen over a JSON column or a row per topic: each setting gets its own
`check` constraint, and the row maps one-to-one onto the app's `Preferences` type.

## Preferences columns ↔ app fields

| App field (`Preferences`) | Column | Allowed values (same as the app) |
| --- | --- | --- |
| `attendance.timing` | `attendance_timing` | `immediate`, `end-of-day`, `custom`, `off` |
| `attendance.method` | `attendance_method` | `call`, `message` |
| `attendance.custom.kind` | `attendance_custom_kind` | `daily`, `weekly` |
| `attendance.custom.day` | `attendance_custom_day` | `sun` … `sat` |
| `attendance.custom.time` | `attendance_custom_time` | `time`, 00:00–23:59, whole minutes |
| `exams.timing` | `exams_timing` | `day-before`, `week-before`, `custom`, `off` |
| `exams.method` | `exams_method` | `call`, `message` |
| `exams.customDays` | `exams_custom_days` | 1–30 |
| `exams.time` | `exams_time` | as above |
| `grades.timing` | `grades_timing` | `immediate`, `monthly`, `off` |
| `grades.method` | `grades_method` | `call`, `message` |
| `grades.dayOfMonth` | `grades_day_of_month` | 1–28 |
| `grades.time` | `grades_time` | as above |
| `retryUnansweredCall` | `retry_unanswered_call` | boolean (one retry after 5 minutes, calls only) |
| `savedAt` | `updated_at` | set by the database |
| — | `time_zone` | always `Asia/Riyadh` |

As in the app, every field is always stored and valid, even for a topic that is off, so its settings
return when it is turned on again; at least one topic must be on. Defaults equal
`defaultPreferences`. The `null` "needs review" timing exists only in drafts converted from older
browser records and is never saved, so the columns are `not null`.

**After-school time:** `end-of-day` has no time column. It keeps using the single prototype
constant `AFTER_SCHOOL_TIME` (14:00) in `src/components/assistant/config.ts`.

## Access rules (RLS on every table)

Identity always comes from `auth.uid()` (the signed-in user's token), never from a parent id sent
by the browser.

| Table | Signed-in parent | Anonymous |
| --- | --- | --- |
| `parent_profiles` | read own row | nothing |
| `parent_students` | read own links | nothing |
| `students` | read students linked to them | nothing |
| `assistant_preferences` | read, add, change and delete own rows, for linked students only | nothing |

- Parents have no insert/update/delete rights on profiles, students or links, so they cannot grant
  themselves access or change school records. Those are written by an administrator.
- On `assistant_preferences`, `parent_id`, `student_id`, `time_zone` and timestamps cannot be
  updated (column privileges), so ownership cannot change.
- Policies are not recursive: `students` and `assistant_preferences` read `parent_students`, whose
  policy only compares `parent_id` with `auth.uid()`.

## Linking a test account (administrator)

Students are never linked to signed-in users automatically.

1. Dashboard → Authentication → Users → add a test user with an email you control.
2. Copy the user's UID.
3. Open `supabase/admin/link-test-parent.sql`, replace the placeholder UID, set the name and the
   student key (`reem` or `faisal`), and run it in the SQL editor. It stops if the placeholder is
   left, the user does not exist, or the student key is unknown.
4. Repeat for each link. The removal statement is at the bottom of the same file.

## Verification

Migration file names match the versions Supabase recorded (`20261028163712`, `20261028163738`).

### Run on the Supabase project (2026-10-28, after applying)

Safe checks only: catalog reads, privilege lookups, and read-only role simulation in a read-only
transaction. `rls_two_parents.sql` was **not** run here.

- Both migrations recorded; RLS on all four tables; 2 students, 0 profiles, links, preferences, Auth users.
- All 31 constraints and 7 policies present as written; every policy is for `authenticated` and
  compares with `auth.uid()`.
- `anon` has no privileges on any of the four tables, and reading them is denied.
- A signed-in user who is not linked to anyone sees 0 students, profiles, links and preferences.
- `authenticated` cannot write students, links or profiles, and cannot update `parent_id`,
  `student_id` or `time_zone`.
- Security advisors: no findings for our tables. Two warnings for `public.rls_auto_enable()`, a
  Supabase-managed function behind the project's automatic-RLS event trigger (`ensure_rls`), not
  part of these migrations. It returns `event_trigger`, so it cannot be run by calling it directly;
  low risk, left unchanged (see decisions). Performance: one INFO, `parent_students_student_id_idx`
  unused — expected while the table is empty.

### Run locally (2026-10-28, before applying)

Against a throwaway in-memory Postgres (PGlite, Postgres 17) with a small stand-in for Supabase's
`auth.users`, `auth.uid()`, the `anon` / `authenticated` roles and Supabase's default table grants.
**Not** against Supabase.

- Both migrations and the seed apply cleanly; the seed is safe to run twice.
- RLS is enabled on all four tables.
- `supabase/tests/rls_two_parents.sql` passes all 34 expectations, each failing for the intended
  reason (RLS violation, permission denied, or the named check constraint). Parent A is linked to
  Reem, parent B to Faisal:
  - each parent sees only their own profile, link and student;
  - A cannot add preferences for Faisal, write as B, change `parent_id`/`student_id`/`time_zone`,
    link a student, or edit students or their own profile;
  - B cannot see, update or delete A's preferences, or add any for Reem;
  - anonymous visitors cannot read students or preferences;
  - invalid values are rejected (exam days 0/31, day 29, `24:00`, seconds, unknown timing, method or
    day, all topics off); midnight `00:00`, 14 days and day 28 are accepted;
  - removing a link deletes that pair's preferences; everything is rolled back afterwards.
- Negative control: replacing the preferences read policy with `using (true)` makes the test fail
  ("B cannot see A's preferences").

### Still pending

1. **Two-parent isolation on Supabase.** Not yet proven there: it needs either a Supabase branch or
   local stack to run `supabase/tests/rls_two_parents.sql`, or two test accounts on this project.
2. End-to-end through the API: two test accounts signed in with the publishable key, linked with the
   admin script, confirming each sees and saves only their own student's preferences over REST.
3. Decide whether to revoke `EXECUTE` on `public.rls_auto_enable()` from `anon`/`authenticated`.
