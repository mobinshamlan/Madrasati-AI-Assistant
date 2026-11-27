-- طمّنـــي: إعداد قاعدة بيانات جديدة وفارغة. شغّليه مرة واحدة في Supabase → SQL Editor (اختاري Run without RLS: الجداول المقصودة مؤقتة).
-- Built from supabase/migrations (in order) and supabase/seed/demo-dataset-import.sql. Fictional data only.


-- ===== migrations/20261028163712_parents_and_students.sql =====
-- Parents, students and the links between them.
-- Students and links are school records: only an administrator (service role / SQL editor) writes them.
-- Parents read their own profile, their own links and the students they are linked to. Nothing else.

create table public.parent_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  -- Stable key matching the prototype's student ids ("reem", "faisal"), used by seeds and admin scripts.
  demo_key text not null unique check (demo_key ~ '^[a-z0-9-]{1,40}$'),
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  grade_label text not null check (length(trim(grade_label)) between 1 and 100),
  school_name text not null check (length(trim(school_name)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.parent_students (
  parent_id uuid not null references public.parent_profiles (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create index parent_students_student_id_idx on public.parent_students (student_id);

alter table public.parent_profiles enable row level security;
alter table public.students enable row level security;
alter table public.parent_students enable row level security;

-- Read-only for signed-in parents; no access at all for anonymous visitors.
revoke all on public.parent_profiles, public.students, public.parent_students from anon, authenticated;
grant select on public.parent_profiles, public.students, public.parent_students to authenticated;

create policy "Parents read their own profile"
  on public.parent_profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Parents read their own student links"
  on public.parent_students for select to authenticated
  using (parent_id = (select auth.uid()));

-- Reads parent_students, whose policy only compares parent_id with auth.uid(): no recursion.
create policy "Parents read students linked to them"
  on public.students for select to authenticated
  using (
    exists (
      select 1 from public.parent_students ps
      where ps.student_id = students.id
        and ps.parent_id = (select auth.uid())
    )
  );


-- ===== migrations/20261028163738_assistant_preferences.sql =====
-- One assistant preferences record per parent–student pair.
-- Mirrors the v4 record in src/components/assistant/preferences.ts and docs/assistant-preferences.md.
-- Like the app, every field is always stored and valid, even for a topic that is off, so settings
-- come back when the topic is turned on again. All times are Saudi time (Asia/Riyadh), 24-hour,
-- whole minutes only (00:00–23:59).
--
-- "end-of-day" attendance has no time column: it uses the fixed prototype after-school time
-- AFTER_SCHOOL_TIME (14:00) in src/components/assistant/config.ts, which stays the single source.

create table public.assistant_preferences (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null default auth.uid(),
  student_id uuid not null,

  attendance_timing text not null default 'end-of-day'
    check (attendance_timing in ('immediate', 'end-of-day', 'custom', 'off')),
  attendance_method text not null default 'call' check (attendance_method in ('call', 'message')),
  attendance_custom_kind text not null default 'daily' check (attendance_custom_kind in ('daily', 'weekly')),
  attendance_custom_day text not null default 'thu'
    check (attendance_custom_day in ('sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat')),
  attendance_custom_time time not null default '18:00'
    check (attendance_custom_time < '24:00' and extract(second from attendance_custom_time) = 0),

  exams_timing text not null default 'day-before'
    check (exams_timing in ('day-before', 'week-before', 'custom', 'off')),
  exams_method text not null default 'call' check (exams_method in ('call', 'message')),
  exams_custom_days smallint not null default 2 check (exams_custom_days between 1 and 30),
  exams_time time not null default '18:00'
    check (exams_time < '24:00' and extract(second from exams_time) = 0),

  grades_timing text not null default 'monthly' check (grades_timing in ('immediate', 'monthly', 'off')),
  grades_method text not null default 'call' check (grades_method in ('call', 'message')),
  grades_day_of_month smallint not null default 1 check (grades_day_of_month between 1 and 28),
  grades_time time not null default '18:00'
    check (grades_time < '24:00' and extract(second from grades_time) = 0),

  -- One retry, 5 minutes later, for unanswered calls only. Stored only; nothing calls yet.
  retry_unanswered_call boolean not null default false,

  time_zone text not null default 'Asia/Riyadh' check (time_zone = 'Asia/Riyadh'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Same rule as canSave(): at least one topic must be on.
  constraint assistant_preferences_one_topic_on
    check (attendance_timing <> 'off' or exams_timing <> 'off' or grades_timing <> 'off'),
  constraint assistant_preferences_one_per_pair unique (parent_id, student_id),
  -- A record can only exist for a real link; removing the link removes the preferences.
  constraint assistant_preferences_link_fkey foreign key (parent_id, student_id)
    references public.parent_students (parent_id, student_id) on delete cascade
);

comment on column public.assistant_preferences.attendance_timing is
  'end-of-day uses AFTER_SCHOOL_TIME (14:00, prototype assumption) from src/components/assistant/config.ts';

create function public.assistant_preferences_touch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger assistant_preferences_touch
  before update on public.assistant_preferences
  for each row execute function public.assistant_preferences_touch();

alter table public.assistant_preferences enable row level security;

-- Parents may write the settings columns only. id, created_at, updated_at and time_zone are set by
-- the database; parent_id and student_id can be set on insert but never changed afterwards.
revoke all on public.assistant_preferences from anon, authenticated;
grant select, delete on public.assistant_preferences to authenticated;
grant insert (
  parent_id, student_id,
  attendance_timing, attendance_method, attendance_custom_kind, attendance_custom_day, attendance_custom_time,
  exams_timing, exams_method, exams_custom_days, exams_time,
  grades_timing, grades_method, grades_day_of_month, grades_time,
  retry_unanswered_call
) on public.assistant_preferences to authenticated;
grant update (
  attendance_timing, attendance_method, attendance_custom_kind, attendance_custom_day, attendance_custom_time,
  exams_timing, exams_method, exams_custom_days, exams_time,
  grades_timing, grades_method, grades_day_of_month, grades_time,
  retry_unanswered_call
) on public.assistant_preferences to authenticated;

-- parent_id is always compared with the signed-in user (auth.uid()), never trusted from the browser.
-- The link check reads parent_students, whose own policy does not read this table: no recursion.
create policy "Parents read their own preferences"
  on public.assistant_preferences for select to authenticated
  using (parent_id = (select auth.uid()));

create policy "Parents add preferences for their linked students"
  on public.assistant_preferences for insert to authenticated
  with check (
    parent_id = (select auth.uid())
    and exists (
      select 1 from public.parent_students ps
      where ps.parent_id = (select auth.uid())
        and ps.student_id = assistant_preferences.student_id
    )
  );

create policy "Parents update their own preferences"
  on public.assistant_preferences for update to authenticated
  using (parent_id = (select auth.uid()))
  with check (parent_id = (select auth.uid()));

create policy "Parents delete their own preferences"
  on public.assistant_preferences for delete to authenticated
  using (parent_id = (select auth.uid()));


-- ===== migrations/20261029101954_demo_school_records.sql =====
-- Demo school records, simulated events, update decisions and delivery attempts.
-- Additive only: nothing existing is dropped or rewritten. All data here is fictional demo data.
--
-- Roles (both are real Supabase Auth users; the browser never decides them):
--   parent   - linked to students through parent_students; reads only its students' records.
--   operator - app_metadata.tammeni_role = 'demo_operator' (settable only by an administrator, never
--              by the user). Records simulated events and runs the demo, for demo students only.

-- Students: the extra fields the dashboard shows, and a demo marker (first: the helpers read it).
alter table public.students
  add column stage_label text,
  add column classroom_label text,
  add column is_demo boolean not null default true,
  add column data_source text;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

create function public.is_demo_operator()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'tammeni_role') = 'demo_operator', false)
$$;

-- Reads parent_students, whose own policy only compares parent_id with auth.uid(): no recursion.
create function public.is_my_student(p_student_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.parent_students ps
    where ps.student_id = p_student_id and ps.parent_id = (select auth.uid())
  )
$$;

create function public.is_demo_student(p_student_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.students s where s.id = p_student_id and s.is_demo)
$$;

-- ---------------------------------------------------------------------------------------------
-- Operator read access to people, links and preferences (demo students only)
-- ---------------------------------------------------------------------------------------------

create policy "Demo operator reads demo students"
  on public.students for select to authenticated
  using ((select public.is_demo_operator()) and is_demo);

create policy "Demo operator reads parent profiles"
  on public.parent_profiles for select to authenticated
  using ((select public.is_demo_operator()));

create policy "Demo operator reads student links"
  on public.parent_students for select to authenticated
  using ((select public.is_demo_operator()));

-- The operator may read preferences and reset them to the defaults, for demo students only.
create policy "Demo operator reads demo preferences"
  on public.assistant_preferences for select to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id));

create policy "Demo operator resets demo preferences"
  on public.assistant_preferences for update to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id))
  with check ((select public.is_demo_operator()) and public.is_demo_student(student_id));

-- ---------------------------------------------------------------------------------------------
-- Raw source, kept apart from the model the website reads. Administrator only (no policies).
-- ---------------------------------------------------------------------------------------------

create table public.demo_source_records (
  source text not null,
  source_key text not null,
  payload jsonb not null,
  imported_at timestamptz not null default now(),
  primary key (source, source_key)
);
alter table public.demo_source_records enable row level security;
revoke all on public.demo_source_records from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Simulated events (created from the demo control page)
-- ---------------------------------------------------------------------------------------------

create table public.demo_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  kind text not null check (kind in ('attendance', 'grade_published', 'exam_added', 'exam_cancelled', 'excuse_accepted')),
  -- The school day the event belongs to, Asia/Riyadh.
  event_date date not null,
  payload jsonb not null default '{}'::jsonb,
  summary text not null check (length(summary) between 1 and 300),
  -- One key per submit intent: a double click or a retried request cannot create a second event.
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 100),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index demo_events_student_idx on public.demo_events (student_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- School records. origin 'import' = from the dataset file; 'demo' = written by a simulated event.
-- Dates are real dates (Asia/Riyadh school days); the original display text is kept beside them.
-- ---------------------------------------------------------------------------------------------

create table public.attendance_terms (
  student_id uuid not null references public.students (id) on delete cascade,
  term_label text not null,
  school_days int not null check (school_days >= 0),
  present int not null check (present >= 0),
  absent int not null check (absent >= 0),
  late int not null check (late >= 0),
  excused int not null check (excused >= 0),
  -- The imported counts must add up; they are never incremented by simulated events.
  check (present + absent + late + excused = school_days),
  source_ref text not null,
  primary key (student_id, term_label)
);

-- School-day attendance only. Online-lesson attendance is a separate record (online_lessons).
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  day date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  note text,
  display_day text,
  hijri_text text,
  origin text not null check (origin in ('import', 'demo')),
  source_ref text,
  demo_event_id uuid references public.demo_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((origin = 'import') = (source_ref is not null)),
  check ((origin = 'demo') = (demo_event_id is not null))
);
create unique index attendance_records_import_key on public.attendance_records (student_id, source_ref) where origin = 'import';
-- At most one active simulated record per student and day.
create unique index attendance_records_demo_day on public.attendance_records (student_id, day) where origin = 'demo' and archived_at is null;

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject text not null,
  kind text not null,
  exam_date date not null,
  start_time time,
  period_label text,
  display_date text,
  hijri_text text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  origin text not null check (origin in ('import', 'demo')),
  source_ref text,
  demo_event_id uuid references public.demo_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((origin = 'import') = (source_ref is not null))
);
create unique index exams_import_key on public.exams (student_id, source_ref) where origin = 'import';

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject text not null,
  assessment text not null,
  score numeric(6, 2) not null,
  out_of numeric(6, 2) not null check (out_of > 0),
  published_on date not null,
  hijri_text text,
  origin text not null check (origin in ('import', 'demo')),
  source_ref text,
  demo_event_id uuid references public.demo_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (score >= 0 and score <= out_of),
  check ((origin = 'import') = (source_ref is not null)),
  check ((origin = 'demo') = (demo_event_id is not null))
);
create unique index grades_import_key on public.grades (student_id, source_ref) where origin = 'import';

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  title text not null,
  body text not null,
  tag text,
  published_on date,
  display_date text,
  source_ref text not null,
  unique (student_id, source_ref)
);

-- Kept from the dataset; no notifications are built from these two yet.
create table public.online_lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  source_ref text not null,
  subject text not null,
  lesson_date date not null,
  lesson_no int,
  scheduled_start time,
  scheduled_end time,
  status text not null,
  duration_minutes int,
  scheduled_duration_minutes int,
  unique (student_id, source_ref)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  source_ref text not null,
  subject text not null,
  title text not null,
  assigned_on date,
  due_on date,
  status text not null,
  unique (student_id, source_ref)
);

-- ---------------------------------------------------------------------------------------------
-- Update decisions and delivery attempts
-- ---------------------------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  demo_event_id uuid not null unique references public.demo_events (id) on delete cascade,
  topic text not null check (topic in ('attendance', 'exams', 'grades')),
  status text not null check (status in ('suppressed', 'waiting', 'ready', 'sending', 'accepted', 'delivered', 'failed', 'cancelled')),
  method text check (method in ('call', 'message')),
  due_at timestamptz,
  reason text not null,
  content text,
  -- The data window of a monthly summary.
  window_start date,
  window_end date,
  -- assistant_preferences.updated_at used for this decision; a newer save forces a fresh preview.
  prefs_version timestamptz,
  evaluated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_student_idx on public.notifications (student_id, evaluated_at desc);

create table public.dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete cascade,
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 100),
  kind text not null check (kind in ('send', 'resend')),
  resend_of uuid references public.dispatch_attempts (id),
  provider text not null check (provider in ('mock', 'twilio')),
  method text not null check (method in ('call', 'message')),
  destination_masked text,
  status text not null check (status in ('sending', 'accepted', 'delivered', 'failed')),
  provider_sid text,
  provider_status text,
  error_message text,
  -- «تشغيل الآن»: the scheduled time was skipped for the demo; the original time is kept.
  ran_early boolean not null default false,
  original_due_at timestamptz,
  content text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'resend') = (resend_of is not null))
);
-- A notification is sent once; a deliberate resend is a separate, explicit attempt.
create unique index dispatch_attempts_one_send on public.dispatch_attempts (notification_id) where kind = 'send';

-- The facts a call or message may use, behind a random token. Only its SHA-256 is stored.
create table public.call_contexts (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  attempt_id uuid not null references public.dispatch_attempts (id) on delete cascade,
  context jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '2 hours')
);

-- Returns the context for a valid, unexpired token and nothing else. The token is never stored.
create function public.get_call_context(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select c.context
  from public.call_contexts c
  where length(p_token) between 32 and 200
    and c.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and c.expires_at > now()
$$;
revoke all on function public.get_call_context(text) from public;
grant execute on function public.get_call_context(text) to anon, authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger notifications_touch before update on public.notifications
  for each row execute function public.touch_updated_at();
create trigger dispatch_attempts_touch before update on public.dispatch_attempts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- RLS: on for every table. Parents read their students' active records; the operator writes
-- simulated data for demo students. Nobody can delete; clearing archives instead.
-- ---------------------------------------------------------------------------------------------

alter table public.demo_events enable row level security;
alter table public.attendance_terms enable row level security;
alter table public.attendance_records enable row level security;
alter table public.exams enable row level security;
alter table public.grades enable row level security;
alter table public.announcements enable row level security;
alter table public.online_lessons enable row level security;
alter table public.assignments enable row level security;
alter table public.notifications enable row level security;
alter table public.dispatch_attempts enable row level security;
alter table public.call_contexts enable row level security;

revoke all on public.demo_events, public.attendance_terms, public.attendance_records, public.exams, public.grades,
  public.announcements, public.online_lessons, public.assignments, public.notifications, public.dispatch_attempts,
  public.call_contexts from anon, authenticated;

grant select on public.attendance_terms, public.announcements, public.online_lessons, public.assignments to authenticated;
grant select, insert, update on public.demo_events, public.attendance_records, public.exams, public.grades,
  public.notifications, public.dispatch_attempts to authenticated;
grant insert on public.call_contexts to authenticated;

-- Parent: read only, own students, active rows.
create policy "Parents read their students' terms" on public.attendance_terms for select to authenticated
  using (public.is_my_student(student_id));
create policy "Parents read their students' attendance" on public.attendance_records for select to authenticated
  using (archived_at is null and public.is_my_student(student_id));
create policy "Parents read their students' exams" on public.exams for select to authenticated
  using (archived_at is null and public.is_my_student(student_id));
create policy "Parents read their students' grades" on public.grades for select to authenticated
  using (archived_at is null and public.is_my_student(student_id));
create policy "Parents read their students' announcements" on public.announcements for select to authenticated
  using (public.is_my_student(student_id));
create policy "Parents read their students' online lessons" on public.online_lessons for select to authenticated
  using (public.is_my_student(student_id));
create policy "Parents read their students' assignments" on public.assignments for select to authenticated
  using (public.is_my_student(student_id));

-- Operator: demo students only.
create policy "Operator reads demo terms" on public.attendance_terms for select to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id));
create policy "Operator reads demo announcements" on public.announcements for select to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id));

create policy "Operator reads demo events" on public.demo_events for select to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id));
create policy "Operator records demo events" on public.demo_events for insert to authenticated
  with check ((select public.is_demo_operator()) and public.is_demo_student(student_id) and created_by = (select auth.uid()));
create policy "Operator archives demo events" on public.demo_events for update to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id))
  with check ((select public.is_demo_operator()) and public.is_demo_student(student_id));

-- Imported rows are readable but never writable from the website.
create policy "Operator reads demo attendance" on public.attendance_records for select to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id));
create policy "Operator writes simulated attendance" on public.attendance_records for insert to authenticated
  with check ((select public.is_demo_operator()) and origin = 'demo' and public.is_demo_student(student_id));
create policy "Operator updates simulated attendance" on public.attendance_records for update to authenticated
  using ((select public.is_demo_operator()) and origin = 'demo' and public.is_demo_student(student_id))
  with check ((select public.is_demo_operator()) and origin = 'demo' and public.is_demo_student(student_id));

create policy "Operator reads demo exams" on public.exams for select to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id));
create policy "Operator writes simulated exams" on public.exams for insert to authenticated
  with check ((select public.is_demo_operator()) and origin = 'demo' and public.is_demo_student(student_id));
-- Cancelling an exam is allowed for imported exams too (status only; see column grants below),
-- but only simulated exams can be archived, so imported records always stay.
create policy "Operator updates exams" on public.exams for update to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id))
  with check ((select public.is_demo_operator()) and public.is_demo_student(student_id) and (origin = 'demo' or archived_at is null));

create policy "Operator reads demo grades" on public.grades for select to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id));
create policy "Operator writes simulated grades" on public.grades for insert to authenticated
  with check ((select public.is_demo_operator()) and origin = 'demo' and public.is_demo_student(student_id));
create policy "Operator archives simulated grades" on public.grades for update to authenticated
  using ((select public.is_demo_operator()) and origin = 'demo' and public.is_demo_student(student_id))
  with check ((select public.is_demo_operator()) and origin = 'demo' and public.is_demo_student(student_id));

create policy "Operator reads notifications" on public.notifications for select to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id));
create policy "Operator writes notifications" on public.notifications for insert to authenticated
  with check ((select public.is_demo_operator()) and public.is_demo_student(student_id));
create policy "Operator updates notifications" on public.notifications for update to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id))
  with check ((select public.is_demo_operator()) and public.is_demo_student(student_id));

create policy "Operator reads attempts" on public.dispatch_attempts for select to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id));
create policy "Operator writes attempts" on public.dispatch_attempts for insert to authenticated
  with check ((select public.is_demo_operator()) and public.is_demo_student(student_id) and created_by = (select auth.uid()));
create policy "Operator updates attempts" on public.dispatch_attempts for update to authenticated
  using ((select public.is_demo_operator()) and public.is_demo_student(student_id))
  with check ((select public.is_demo_operator()) and public.is_demo_student(student_id));

create policy "Operator stores call contexts" on public.call_contexts for insert to authenticated
  with check (
    (select public.is_demo_operator())
    and exists (select 1 from public.dispatch_attempts a where a.id = attempt_id and public.is_demo_student(a.student_id))
  );

-- Column limits for the operator's updates: only state fields change, never what was recorded.
revoke update on public.demo_events, public.attendance_records, public.exams, public.grades,
  public.notifications, public.dispatch_attempts from authenticated;
grant update (archived_at) on public.demo_events to authenticated;
grant update (status, archived_at) on public.attendance_records to authenticated;
grant update (status, archived_at) on public.exams to authenticated;
grant update (archived_at) on public.grades to authenticated;
grant update (status, method, due_at, reason, content, window_start, window_end, prefs_version, evaluated_at)
  on public.notifications to authenticated;
grant update (status, provider_sid, provider_status, error_message, destination_masked)
  on public.dispatch_attempts to authenticated;


-- ===== migrations/20261029103638_attempt_provider_update.sql =====
-- The provider that actually handled an attempt is known only after the Python backend answers.
-- Let the operator record it (column privilege only; the row policies are unchanged).
grant update (provider) on public.dispatch_attempts to authenticated;


-- ===== migrations/20261029170000_direct_demo_server_access.sql =====
-- Direct local demo uses a server-only service-role key, without operator Auth sessions.
-- No anon/authenticated grants or RLS policies are changed. No rows are modified.
begin;
grant usage on schema public to service_role;
grant select on public.parent_profiles, public.parent_students, public.students,
  public.attendance_terms, public.announcements, public.online_lessons, public.assignments,
  public.assistant_preferences, public.demo_events, public.attendance_records,
  public.exams, public.grades, public.notifications, public.dispatch_attempts,
  public.call_contexts to service_role;
grant insert, update on public.demo_events, public.attendance_records, public.exams,
  public.grades, public.notifications, public.dispatch_attempts to service_role;
grant update on public.assistant_preferences to service_role;
grant insert on public.call_contexts to service_role;
commit;


-- ===== migrations/20261108224209_automatic_dispatch.sql =====
-- Automatic dispatch of saved schedules. Additive: nothing reads these columns until the scheduler is switched on.
alter table public.notifications
  -- Set when the scheduler claims an update; a claim that never produced an attempt can be released safely.
  add column auto_claimed_at timestamptz,
  -- This update went out inside another update's summary, so it has no attempt of its own.
  add column covered_by uuid references public.notifications (id);

alter table public.dispatch_attempts
  add column triggered_by text not null default 'operator' check (triggered_by in ('operator', 'scheduler'));

create index notifications_pending_idx on public.notifications (status, due_at) where status in ('waiting', 'ready', 'suppressed');


-- ===== seed/demo-dataset-import.sql =====
-- Generated by scripts/build-demo-import.mjs from madrasati-dataset.json. Fictional demo data only.
-- Repeatable: rows are matched on stable source keys and updated in place. Nothing is deleted.
-- Expected rows: {"students":4,"attendance":16,"exams":12,"grades":21,"announcements":12,"lessons":9,"assignments":8}
begin;
create temporary table _tammeni_src on commit drop as
  select $tammeni_src${"parent":{"name":"عبدالرحمن بن سعد الشهري","shortName":"عبدالرحمن الشهري","role":"ولي أمر","relation":"الأب","email":"abdulrahman.parent@example.com","phone":"05•• ••• 4821","lastLogin":"الأربعاء 17/05/1448 هـ — 08:12 ص"},"today":{"gregorian":"الأربعاء 28 أكتوبر 2026م","hijri":"17 جمادى الأولى 1448 هـ"},"students":[{"id":"sama","name":"سما عبدالرحمن الشهري","firstName":"سما","grade":"الصف الخامس الابتدائي","stage":"المرحلة الابتدائية","classroom":"خامس / 2","school":"مدرسة رياض النخبة الابتدائية للبنات","attendance":{"termLabel":"الفصل الدراسي الأول 1448 هـ","schoolDays":48,"present":46,"absent":1,"late":1,"excused":0,"week":[{"day":"الأحد","date":"14/05","status":"present"},{"day":"الاثنين","date":"15/05","status":"present"},{"day":"الثلاثاء","date":"16/05","status":"late","note":"تأخر 10 دقائق"},{"day":"الأربعاء","date":"17/05","status":"present","note":"اليوم"}]},"exams":[{"subject":"الرياضيات","kind":"اختبار قصير","day":"الأحد","date":"1 نوفمبر","hijri":"21/05/1448","period":"الحصة الثانية"},{"subject":"لغتي","kind":"اختبار قصير","day":"الثلاثاء","date":"3 نوفمبر","hijri":"23/05/1448","period":"الحصة الأولى"},{"subject":"العلوم","kind":"اختبار عملي","day":"الاثنين","date":"9 نوفمبر","hijri":"29/05/1448","period":"الحصة الثالثة"}],"grades":[{"subject":"الرياضيات","assessment":"اختبار قصير (1)","score":9.5,"outOf":10,"date":"10/05/1448"},{"subject":"لغتي","assessment":"مهام أدائية","score":14,"outOf":15,"date":"09/05/1448"},{"subject":"العلوم","assessment":"مشروع: دورة حياة النبات","score":18,"outOf":20,"date":"08/05/1448"},{"subject":"الدراسات الإسلامية","assessment":"تسميع سورة الملك","score":10,"outOf":10,"date":"04/05/1448"},{"subject":"اللغة الإنجليزية","assessment":"Quiz – Unit 3","score":7,"outOf":10,"date":"03/05/1448"}],"announcements":[{"title":"اجتماع أولياء الأمور الأول","body":"تدعوكم إدارة المدرسة لحضور لقاء أولياء الأمور يوم الخميس 18/05/1448 هـ الساعة 6:30 مساءً في مسرح المدرسة.","date":"15/05/1448","tag":"لقاءات"},{"title":"أسبوع القراءة المدرسي","body":"تبدأ فعاليات أسبوع القراءة يوم الأحد القادم، ويُرجى تزويد الطالبة بقصة قصيرة من اختيارها.","date":"12/05/1448","tag":"أنشطة"},{"title":"تحديث موعد الانصراف","body":"يكون انصراف طالبات الصفوف العليا الساعة 12:45 ظهرًا اعتبارًا من الأسبوع القادم.","date":"10/05/1448","tag":"تنظيمي"}],"onlineLessons":[{"id":"sama-lesson-1","studentId":"sama","subject":"الرياضيات","date":"2026-10-26","lesson":1,"scheduledStart":"08:00","scheduledEnd":"08:40","status":"present","durationMinutes":40,"scheduledDurationMinutes":40,"demo":true,"source":"synthetic_demo"},{"id":"sama-lesson-2","studentId":"sama","subject":"العلوم","date":"2026-10-27","lesson":2,"scheduledStart":"08:00","scheduledEnd":"08:40","status":"late","durationMinutes":32,"scheduledDurationMinutes":40,"demo":true,"source":"synthetic_demo"},{"id":"sama-lesson-3","studentId":"sama","subject":"لغتي","date":"2026-10-28","lesson":3,"scheduledStart":"08:00","scheduledEnd":"08:40","status":"absent","durationMinutes":null,"scheduledDurationMinutes":40,"demo":true,"source":"synthetic_demo"}],"assignments":[{"id":"sama-assignment-1","studentId":"sama","subject":"الرياضيات","title":"تدريب الكسور","assignedDate":"2026-10-24","dueDate":"2026-10-29","status":"in_progress","demo":true,"source":"synthetic_demo"},{"id":"sama-assignment-2","studentId":"sama","subject":"العلوم","title":"ملخص دورة الماء","assignedDate":"2026-10-20","dueDate":"2026-10-25","status":"missing","demo":true,"source":"synthetic_demo"}]},{"id":"faisal","name":"فيصل عبدالرحمن الشهري","firstName":"فيصل","grade":"الصف الثاني المتوسط","stage":"المرحلة المتوسطة","classroom":"ثاني متوسط / 4","school":"متوسطة الأندلس النموذجية للبنين","attendance":{"termLabel":"الفصل الدراسي الأول 1448 هـ","schoolDays":48,"present":43,"absent":3,"late":1,"excused":1,"week":[{"day":"الأحد","date":"14/05","status":"present"},{"day":"الاثنين","date":"15/05","status":"absent","note":"غياب بدون عذر"},{"day":"الثلاثاء","date":"16/05","status":"excused","note":"عذر طبي"},{"day":"الأربعاء","date":"17/05","status":"present","note":"اليوم"}]},"exams":[{"subject":"العلوم","kind":"اختبار قصير","day":"الاثنين","date":"2 نوفمبر","hijri":"22/05/1448","period":"الحصة الرابعة"},{"subject":"الرياضيات","kind":"اختبار منتصف الفصل","day":"الأربعاء","date":"4 نوفمبر","hijri":"24/05/1448","period":"الحصة الثانية"},{"subject":"اللغة الإنجليزية","kind":"اختبار شفهي","day":"الأحد","date":"8 نوفمبر","hijri":"28/05/1448","period":"الحصة الخامسة"},{"subject":"الدراسات الاجتماعية","kind":"اختبار قصير","day":"الثلاثاء","date":"10 نوفمبر","hijri":"30/05/1448","period":"الحصة الثالثة"}],"grades":[{"subject":"الرياضيات","assessment":"واجب: المعادلات الخطية","score":8,"outOf":10,"date":"11/05/1448"},{"subject":"العلوم","assessment":"تقرير المختبر","score":13,"outOf":15,"date":"09/05/1448"},{"subject":"لغتي الخالدة","assessment":"اختبار قصير (1)","score":6.5,"outOf":10,"date":"08/05/1448"},{"subject":"المهارات الرقمية","assessment":"مشروع: عرض تقديمي","score":19,"outOf":20,"date":"04/05/1448"},{"subject":"التفكير الناقد","assessment":"مشاركة وتفاعل","score":9,"outOf":10,"date":"03/05/1448"}],"announcements":[{"title":"جدول الاختبارات القصيرة","body":"نُشر جدول الاختبارات القصيرة للأسبوعين القادمين، ويمكن الاطلاع عليه لدى رائد الفصل.","date":"16/05/1448","tag":"اختبارات"},{"title":"رحلة علمية إلى مركز العلوم","body":"رحلة لطلاب الصف الثاني المتوسط يوم الخميس 25/05/1448 هـ، ويلزم توقيع نموذج الموافقة.","date":"13/05/1448","tag":"أنشطة"},{"title":"تذكير بقواعد المواظبة","body":"يُحتسب التأخر الصباحي بعد الساعة 6:45 صباحًا، ونأمل حرص أولياء الأمور على الحضور المبكر.","date":"09/05/1448","tag":"تنظيمي"}],"onlineLessons":[{"id":"faisal-lesson-1","studentId":"faisal","subject":"الرياضيات","date":"2026-10-26","lesson":1,"scheduledStart":"08:00","scheduledEnd":"08:40","status":"present","durationMinutes":40,"scheduledDurationMinutes":40,"demo":true,"source":"synthetic_demo"},{"id":"faisal-lesson-2","studentId":"faisal","subject":"العلوم","date":"2026-10-27","lesson":2,"scheduledStart":"08:00","scheduledEnd":"08:40","status":"left_early","durationMinutes":22,"scheduledDurationMinutes":40,"demo":true,"source":"synthetic_demo"}],"assignments":[{"id":"faisal-assignment-1","studentId":"faisal","subject":"العلوم","title":"ورقة التصنيف","assignedDate":"2026-10-21","dueDate":"2026-10-26","status":"submitted_late","demo":true,"source":"synthetic_demo"},{"id":"faisal-assignment-2","studentId":"faisal","subject":"لغتي","title":"قراءة قصيرة","assignedDate":"2026-10-25","dueDate":"2026-10-30","status":"submitted","demo":true,"source":"synthetic_demo"}]},{"id":"lujain","name":"لجين عبدالرحمن الشهري","firstName":"لجين","grade":"الصف الأول الثانوي","stage":"المرحلة الثانوية","classroom":"أول ثانوي / 1","school":"ثانوية الربيع النموذجية للبنات","attendance":{"termLabel":"الفصل الدراسي الأول 1448 هـ","schoolDays":48,"present":44,"absent":2,"late":1,"excused":1,"week":[{"day":"الأحد","date":"14/05","status":"present"},{"day":"الاثنين","date":"15/05","status":"excused","note":"عذر طبي"},{"day":"الثلاثاء","date":"16/05","status":"present"},{"day":"الأربعاء","date":"17/05","status":"present","note":"اليوم"}]},"exams":[{"subject":"الفيزياء","kind":"اختبار قصير","day":"الاثنين","date":"2 نوفمبر","hijri":"22/05/1448","period":"الحصة الأولى"},{"subject":"الأحياء","kind":"اختبار عملي","day":"الأربعاء","date":"4 نوفمبر","hijri":"24/05/1448","period":"الحصة الثالثة"},{"subject":"اللغة الإنجليزية","kind":"اختبار منتصف الفصل","day":"الخميس","date":"5 نوفمبر","hijri":"25/05/1448","period":"الحصة الثانية"}],"grades":[{"subject":"الفيزياء","assessment":"اختبار قصير (1)","score":8.5,"outOf":10,"date":"11/05/1448"},{"subject":"الكيمياء","assessment":"تقرير المختبر","score":14,"outOf":15,"date":"10/05/1448"},{"subject":"الرياضيات","assessment":"واجب: الدوال","score":9,"outOf":10,"date":"09/05/1448"},{"subject":"لغتي","assessment":"مهام أدائية","score":13,"outOf":15,"date":"07/05/1448"},{"subject":"الدراسات الإسلامية","assessment":"تسميع أحاديث مختارة","score":10,"outOf":10,"date":"05/05/1448"},{"subject":"الأحياء","assessment":"مشروع: بنية الخلية","score":17,"outOf":20,"date":"03/05/1448"}],"announcements":[{"title":"معرض التخصصات الجامعية","body":"تنظّم المدرسة معرضًا للتعريف بالتخصصات الجامعية يوم الأحد 28/05/1448 هـ، ويُدعى أولياء الأمور لحضوره مع الطالبات.","date":"15/05/1448","tag":"أنشطة"},{"title":"تحديث جدول الحصص","body":"عُدّل جدول الحصص الأسبوعي لمادتي الفيزياء والأحياء، وتجدونه الآن لدى رائدة الفصل.","date":"11/05/1448","tag":"تنظيمي"},{"title":"موعد تسليم مشاريع الفصل","body":"آخر موعد لتسليم مشاريع الفصل الدراسي الأول يوم الثلاثاء 30/05/1448 هـ.","date":"08/05/1448","tag":"اختبارات"}],"onlineLessons":[{"id":"lujain-lesson-1","studentId":"lujain","subject":"اللغة الإنجليزية","date":"2026-10-26","lesson":1,"scheduledStart":"08:00","scheduledEnd":"08:40","status":"excused","durationMinutes":null,"scheduledDurationMinutes":40,"demo":true,"source":"synthetic_demo"},{"id":"lujain-lesson-2","studentId":"lujain","subject":"الرياضيات","date":"2026-10-28","lesson":2,"scheduledStart":"08:00","scheduledEnd":"08:40","status":"present","durationMinutes":40,"scheduledDurationMinutes":40,"demo":true,"source":"synthetic_demo"}],"assignments":[{"id":"lujain-assignment-1","studentId":"lujain","subject":"الرياضيات","title":"مسائل القسمة","assignedDate":"2026-10-26","dueDate":"2026-10-31","status":"not_started","demo":true,"source":"synthetic_demo"},{"id":"lujain-assignment-2","studentId":"lujain","subject":"اللغة الإنجليزية","title":"مفردات الوحدة","assignedDate":"2026-10-20","dueDate":"2026-10-25","status":"graded","demo":true,"source":"synthetic_demo"}]},{"id":"ahmad","name":"أحمد عبدالرحمن الشهري","firstName":"أحمد","grade":"الصف الثاني الابتدائي","stage":"المرحلة الابتدائية","classroom":"ثاني / 3","school":"مدرسة ابن خلدون الابتدائية للبنين","attendance":{"termLabel":"الفصل الدراسي الأول 1448 هـ","schoolDays":48,"present":47,"absent":0,"late":1,"excused":0,"week":[{"day":"الأحد","date":"14/05","status":"present"},{"day":"الاثنين","date":"15/05","status":"present"},{"day":"الثلاثاء","date":"16/05","status":"present"},{"day":"الأربعاء","date":"17/05","status":"late","note":"تأخر 5 دقائق"}]},"exams":[{"subject":"الرياضيات","kind":"اختبار شفهي","day":"الثلاثاء","date":"3 نوفمبر","hijri":"23/05/1448","period":"الحصة الأولى"},{"subject":"لغتي","kind":"اختبار قصير","day":"الخميس","date":"5 نوفمبر","hijri":"25/05/1448","period":"الحصة الثانية"}],"grades":[{"subject":"الرياضيات","assessment":"اختبار قصير (1)","score":10,"outOf":10,"date":"10/05/1448"},{"subject":"لغتي","assessment":"قراءة وتهجئة","score":9,"outOf":10,"date":"09/05/1448"},{"subject":"العلوم","assessment":"نشاط: الحواس الخمس","score":4.5,"outOf":5,"date":"08/05/1448"},{"subject":"الدراسات الإسلامية","assessment":"تسميع سورة الإخلاص","score":10,"outOf":10,"date":"04/05/1448"},{"subject":"اللغة الإنجليزية","assessment":"Quiz – Unit 2","score":8,"outOf":10,"date":"03/05/1448"}],"announcements":[{"title":"يوم الأسرة المدرسي","body":"تقيم المدرسة يوم الأسرة يوم الأربعاء 24/05/1448 هـ، ونأمل مشاركة أولياء الأمور في الفعاليات الصباحية.","date":"14/05/1448","tag":"أنشطة"},{"title":"تذكير بالزي المدرسي","body":"يُرجى الالتزام بالزي المدرسي الكامل وحذاء المدرسة الرياضي في حصص التربية البدنية.","date":"11/05/1448","tag":"تنظيمي"},{"title":"نتائج التقويم المستمر","body":"أصبحت نتائج التقويم المستمر للأسبوع الرابع متاحة للاطلاع في صفحة الطالب.","date":"09/05/1448","tag":"اختبارات"}],"onlineLessons":[{"id":"ahmad-lesson-1","studentId":"ahmad","subject":"العلوم","date":"2026-10-27","lesson":1,"scheduledStart":"08:00","scheduledEnd":"08:40","status":"late","durationMinutes":32,"scheduledDurationMinutes":40,"demo":true,"source":"synthetic_demo"},{"id":"ahmad-lesson-2","studentId":"ahmad","subject":"لغتي","date":"2026-10-28","lesson":2,"scheduledStart":"08:00","scheduledEnd":"08:40","status":"present","durationMinutes":40,"scheduledDurationMinutes":40,"demo":true,"source":"synthetic_demo"}],"assignments":[{"id":"ahmad-assignment-1","studentId":"ahmad","subject":"الرياضيات","title":"تدريب القياس","assignedDate":"2026-10-22","dueDate":"2026-10-27","status":"missing","demo":true,"source":"synthetic_demo"},{"id":"ahmad-assignment-2","studentId":"ahmad","subject":"العلوم","title":"أسئلة المراجعة","assignedDate":"2026-10-25","dueDate":"2026-10-30","status":"in_progress","demo":true,"source":"synthetic_demo"}]}]}$tammeni_src$::jsonb as d, $tammeni_src${"17/05/1448":"2026-10-28","14/05/1448":"2026-10-25","15/05/1448":"2026-10-26","16/05/1448":"2026-10-27","21/05/1448":"2026-11-01","23/05/1448":"2026-11-03","29/05/1448":"2026-11-09","10/05/1448":"2026-10-21","09/05/1448":"2026-10-20","08/05/1448":"2026-10-19","04/05/1448":"2026-10-15","03/05/1448":"2026-10-14","12/05/1448":"2026-10-23","22/05/1448":"2026-11-02","24/05/1448":"2026-11-04","28/05/1448":"2026-11-08","30/05/1448":"2026-11-10","11/05/1448":"2026-10-22","13/05/1448":"2026-10-24","25/05/1448":"2026-11-05","07/05/1448":"2026-10-18","05/05/1448":"2026-10-16"}$tammeni_src$::jsonb as hijri;

-- Raw source, unchanged (the masked phone included as given; it is never used to send anything).
insert into public.demo_source_records (source, source_key, payload)
  select 'madrasati-dataset.json', k, v from _tammeni_src, lateral (values ('parent', d -> 'parent'), ('today', d -> 'today')) x (k, v)
  union all
  select 'madrasati-dataset.json', 'student:' || (s ->> 'id'), s from _tammeni_src, jsonb_array_elements(d -> 'students') s
  on conflict (source, source_key) do update set payload = excluded.payload, imported_at = now();

insert into public.students (demo_key, full_name, first_name, grade_label, school_name, stage_label, classroom_label, is_demo, data_source)
  select s ->> 'id', s ->> 'name', s ->> 'firstName', s ->> 'grade', s ->> 'school', s ->> 'stage', s ->> 'classroom', true, 'madrasati-dataset.json'
  from _tammeni_src, jsonb_array_elements(d -> 'students') s
  on conflict (demo_key) do update set full_name = excluded.full_name, first_name = excluded.first_name, grade_label = excluded.grade_label,
    school_name = excluded.school_name, stage_label = excluded.stage_label, classroom_label = excluded.classroom_label,
    is_demo = true, data_source = excluded.data_source;

create temporary table _tammeni_students on commit drop as
  select st.id as student_id, s
  from _tammeni_src, jsonb_array_elements(d -> 'students') s
  join public.students st on st.demo_key = s ->> 'id';

insert into public.attendance_terms (student_id, term_label, school_days, present, absent, late, excused, source_ref)
  select student_id, a ->> 'termLabel', (a ->> 'schoolDays')::int, (a ->> 'present')::int, (a ->> 'absent')::int,
    (a ->> 'late')::int, (a ->> 'excused')::int, 'term:' || (a ->> 'termLabel')
  from _tammeni_students, lateral (select s -> 'attendance' a) x
  on conflict (student_id, term_label) do update set school_days = excluded.school_days, present = excluded.present,
    absent = excluded.absent, late = excluded.late, excused = excluded.excused, source_ref = excluded.source_ref;

-- School-day attendance only (the week list). Online lessons go to their own table below.
insert into public.attendance_records (student_id, day, status, note, display_day, hijri_text, origin, source_ref)
  select t.student_id, (h.hijri ->> ((w ->> 'date') || '/' || yr))::date, w ->> 'status',
    nullif(nullif(w ->> 'note', 'اليوم'), ''), w ->> 'day', (w ->> 'date') || '/' || yr, 'import', 'att:' || (w ->> 'date') || '/' || yr
  from _tammeni_students t
  cross join _tammeni_src h
  cross join lateral (select substring(t.s -> 'attendance' ->> 'termLabel' from '([0-9]{4}) هـ') yr) y
  cross join lateral jsonb_array_elements(t.s -> 'attendance' -> 'week') w
  on conflict (student_id, source_ref) where origin = 'import' do update set day = excluded.day, status = excluded.status,
    note = excluded.note, display_day = excluded.display_day, hijri_text = excluded.hijri_text;

insert into public.exams (student_id, subject, kind, exam_date, period_label, display_date, hijri_text, status, origin, source_ref)
  select t.student_id, e ->> 'subject', e ->> 'kind', (h.hijri ->> (e ->> 'hijri'))::date, e ->> 'period',
    (e ->> 'day') || ' ' || (e ->> 'date'), e ->> 'hijri', 'scheduled', 'import', 'exam:' || (e ->> 'hijri') || ':' || (e ->> 'subject')
  from _tammeni_students t cross join _tammeni_src h cross join lateral jsonb_array_elements(t.s -> 'exams') e
  on conflict (student_id, source_ref) where origin = 'import' do update set subject = excluded.subject, kind = excluded.kind,
    exam_date = excluded.exam_date, period_label = excluded.period_label, display_date = excluded.display_date, hijri_text = excluded.hijri_text;

insert into public.grades (student_id, subject, assessment, score, out_of, published_on, hijri_text, origin, source_ref)
  select t.student_id, g ->> 'subject', g ->> 'assessment', (g ->> 'score')::numeric, (g ->> 'outOf')::numeric,
    (h.hijri ->> (g ->> 'date'))::date, g ->> 'date', 'import', 'grade:' || (g ->> 'date') || ':' || (g ->> 'subject') || ':' || (g ->> 'assessment')
  from _tammeni_students t cross join _tammeni_src h cross join lateral jsonb_array_elements(t.s -> 'grades') g
  on conflict (student_id, source_ref) where origin = 'import' do update set score = excluded.score, out_of = excluded.out_of,
    published_on = excluded.published_on, hijri_text = excluded.hijri_text;

insert into public.announcements (student_id, title, body, tag, published_on, display_date, source_ref)
  select t.student_id, n ->> 'title', n ->> 'body', n ->> 'tag', (h.hijri ->> (n ->> 'date'))::date, n ->> 'date',
    'ann:' || (n ->> 'date') || ':' || (n ->> 'title')
  from _tammeni_students t cross join _tammeni_src h cross join lateral jsonb_array_elements(t.s -> 'announcements') n
  on conflict (student_id, source_ref) do update set title = excluded.title, body = excluded.body, tag = excluded.tag,
    published_on = excluded.published_on, display_date = excluded.display_date;

insert into public.online_lessons (student_id, source_ref, subject, lesson_date, lesson_no, scheduled_start, scheduled_end, status,
    duration_minutes, scheduled_duration_minutes)
  select t.student_id, l ->> 'id', l ->> 'subject', (l ->> 'date')::date, (l ->> 'lesson')::int, (l ->> 'scheduledStart')::time,
    (l ->> 'scheduledEnd')::time, l ->> 'status', (l ->> 'durationMinutes')::int, (l ->> 'scheduledDurationMinutes')::int
  from _tammeni_students t cross join lateral jsonb_array_elements(coalesce(t.s -> 'onlineLessons', '[]')) l
  on conflict (student_id, source_ref) do update set subject = excluded.subject, lesson_date = excluded.lesson_date,
    lesson_no = excluded.lesson_no, scheduled_start = excluded.scheduled_start, scheduled_end = excluded.scheduled_end,
    status = excluded.status, duration_minutes = excluded.duration_minutes, scheduled_duration_minutes = excluded.scheduled_duration_minutes;

insert into public.assignments (student_id, source_ref, subject, title, assigned_on, due_on, status)
  select t.student_id, a ->> 'id', a ->> 'subject', a ->> 'title', (a ->> 'assignedDate')::date, (a ->> 'dueDate')::date, a ->> 'status'
  from _tammeni_students t cross join lateral jsonb_array_elements(coalesce(t.s -> 'assignments', '[]')) a
  on conflict (student_id, source_ref) do update set subject = excluded.subject, title = excluded.title,
    assigned_on = excluded.assigned_on, due_on = excluded.due_on, status = excluded.status;
commit;
