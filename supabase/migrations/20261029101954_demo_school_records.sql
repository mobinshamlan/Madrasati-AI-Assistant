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
