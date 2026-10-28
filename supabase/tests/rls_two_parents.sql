-- Cross-parent access test. LOCAL OR BRANCH DATABASE ONLY — never the production project.
-- Run after the migrations and supabase/seed.sql, as the database owner, e.g.
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_two_parents.sql
-- It creates two throwaway Auth users inside one transaction and ROLLS BACK everything at the end.
-- Any failed expectation raises an error and stops the script.
--
-- Parent A is linked to Reem only. Parent B is linked to Faisal only.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'parent-a@test.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'parent-b@test.invalid');
insert into public.parent_profiles (id, full_name) values
  ('00000000-0000-4000-8000-00000000000a', 'ولي أمر (أ)'),
  ('00000000-0000-4000-8000-00000000000b', 'ولي أمر (ب)');
insert into public.parent_students (parent_id, student_id)
  select '00000000-0000-4000-8000-00000000000a'::uuid, id from public.students where demo_key = 'reem'
  union all
  select '00000000-0000-4000-8000-00000000000b'::uuid, id from public.students where demo_key = 'faisal';

-- Fails the test unless `sql` raises an error.
create function pg_temp.expect_error(label text, sql text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL: % (statement succeeded)', label;
exception
  when raise_exception then raise;
  when others then raise notice 'ok: % (%)', label, sqlerrm;
end $$;

-- Fails the test unless `sql` returns `expected`.
create function pg_temp.expect(label text, sql text, expected bigint) returns void language plpgsql as $$
declare got bigint;
begin
  execute sql into got;
  if got is distinct from expected then
    raise exception 'FAIL: % (expected %, got %)', label, expected, got;
  end if;
  raise notice 'ok: %', label;
end $$;

-- Real student ids, captured as admin, so the tests target students the parent is NOT linked to.
select set_config('test.reem_id', (select id::text from public.students where demo_key = 'reem'), true),
       set_config('test.faisal_id', (select id::text from public.students where demo_key = 'faisal'), true);

grant execute on function pg_temp.expect_error(text, text), pg_temp.expect(text, text, bigint) to anon, authenticated;

-- ---------- Parent A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select pg_temp.expect('A sees only own profile', 'select count(*) from public.parent_profiles', 1);
select pg_temp.expect('A sees only own link', 'select count(*) from public.parent_students', 1);
select pg_temp.expect('A sees only Reem', $q$select count(*) from public.students where demo_key = 'reem'$q$, 1);
select pg_temp.expect('A cannot see Faisal', $q$select count(*) from public.students where demo_key = 'faisal'$q$, 0);

select pg_temp.expect('A saves preferences for Reem (defaults)', $q$
  with r as (
    insert into public.assistant_preferences (student_id)
    select id from public.students where demo_key = 'reem' returning 1
  ) select count(*) from r $q$, 1);

select pg_temp.expect('A updates own preferences', $q$
  with r as (
    update public.assistant_preferences
       set exams_timing = 'custom', exams_custom_days = 14, attendance_custom_time = '00:00',
           grades_day_of_month = 28, retry_unanswered_call = true
    returning 1
  ) select count(*) from r $q$, 1);

select pg_temp.expect_error('A cannot add preferences for Faisal (not linked)', $q$
  insert into public.assistant_preferences (student_id)
  values (current_setting('test.faisal_id')::uuid) $q$);
select pg_temp.expect_error('A cannot write as parent B', $q$
  insert into public.assistant_preferences (parent_id, student_id)
  select '00000000-0000-4000-8000-00000000000b', id from public.students where demo_key = 'reem' $q$);
select pg_temp.expect_error('A cannot change ownership', $q$
  update public.assistant_preferences set parent_id = '00000000-0000-4000-8000-00000000000b' $q$);
select pg_temp.expect_error('A cannot move preferences to another student', $q$
  update public.assistant_preferences set student_id = current_setting('test.faisal_id')::uuid $q$);
select pg_temp.expect_error('A cannot link a student', $q$
  insert into public.parent_students (parent_id, student_id) values ('00000000-0000-4000-8000-00000000000a', current_setting('test.faisal_id')::uuid) $q$);
select pg_temp.expect_error('A cannot edit students', $q$update public.students set full_name = 'x'$q$);
select pg_temp.expect_error('A cannot add students', $q$
  insert into public.students (demo_key, full_name, first_name, grade_label, school_name)
  values ('x', 'x', 'x', 'x', 'x') $q$);
select pg_temp.expect_error('A cannot edit own profile', $q$update public.parent_profiles set full_name = 'x'$q$);
select pg_temp.expect_error('A cannot set time_zone', $q$update public.assistant_preferences set time_zone = 'UTC'$q$);

-- Constraints that mirror the app's validation.
select pg_temp.expect_error('exam days 31 rejected', $q$update public.assistant_preferences set exams_custom_days = 31$q$);
select pg_temp.expect_error('exam days 0 rejected', $q$update public.assistant_preferences set exams_custom_days = 0$q$);
select pg_temp.expect_error('day of month 29 rejected', $q$update public.assistant_preferences set grades_day_of_month = 29$q$);
select pg_temp.expect_error('time 24:00 rejected', $q$update public.assistant_preferences set exams_time = '24:00'$q$);
select pg_temp.expect_error('time with seconds rejected', $q$update public.assistant_preferences set grades_time = '18:00:30'$q$);
select pg_temp.expect_error('unknown timing rejected', $q$update public.assistant_preferences set grades_timing = 'weekly'$q$);
select pg_temp.expect_error('unknown method rejected', $q$update public.assistant_preferences set exams_method = 'sms'$q$);
select pg_temp.expect_error('unknown day rejected', $q$update public.assistant_preferences set attendance_custom_day = 'friday'$q$);
select pg_temp.expect_error('all topics off rejected', $q$
  update public.assistant_preferences set attendance_timing = 'off', exams_timing = 'off', grades_timing = 'off' $q$);

-- ---------- Parent B ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

select pg_temp.expect('B sees only own profile', 'select count(*) from public.parent_profiles', 1);
select pg_temp.expect('B sees only Faisal', 'select count(*) from public.students', 1);
select pg_temp.expect('B cannot see A''s preferences', 'select count(*) from public.assistant_preferences', 0);
select pg_temp.expect('B cannot update A''s preferences', $q$
  with r as (update public.assistant_preferences set retry_unanswered_call = false returning 1)
  select count(*) from r $q$, 0);
select pg_temp.expect('B cannot delete A''s preferences', $q$
  with r as (delete from public.assistant_preferences returning 1) select count(*) from r $q$, 0);
select pg_temp.expect_error('B cannot add preferences for Reem', $q$
  insert into public.assistant_preferences (student_id)
  values (current_setting('test.reem_id')::uuid) $q$);

-- ---------- Anonymous visitor ----------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.expect_error('anon cannot read students', 'select count(*) from public.students');
select pg_temp.expect_error('anon cannot read preferences', 'select count(*) from public.assistant_preferences');

-- ---------- Back to admin: A's record is intact and unlinking removes it ----------
reset role;
select pg_temp.expect('A''s preferences unchanged by B', $q$
  select count(*) from public.assistant_preferences
  where parent_id = '00000000-0000-4000-8000-00000000000a'
    and exams_custom_days = 14 and retry_unanswered_call and attendance_custom_time = '00:00' $q$, 1);
delete from public.parent_students where parent_id = '00000000-0000-4000-8000-00000000000a';
select pg_temp.expect('unlinking removes the pair''s preferences', 'select count(*) from public.assistant_preferences', 0);

rollback;
