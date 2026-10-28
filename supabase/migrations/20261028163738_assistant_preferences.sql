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
