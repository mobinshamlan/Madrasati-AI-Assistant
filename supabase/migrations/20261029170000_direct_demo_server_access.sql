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
