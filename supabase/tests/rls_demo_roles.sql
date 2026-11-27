-- Parent / operator / outsider access test for the demo records. LOCAL OR BRANCH DATABASE ONLY.
-- Run after all migrations, supabase/seed.sql and supabase/seed/demo-dataset-import.sql, as the owner.
-- Creates throwaway users inside one transaction and ROLLS BACK everything at the end.

begin;

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'parent@test.invalid', '{}'),
  ('00000000-0000-4000-8000-0000000000b2', 'outsider@test.invalid', '{}'),
  ('00000000-0000-4000-8000-0000000000c3', 'operator@test.invalid', '{"tammeni_role":"demo_operator"}');
insert into public.parent_profiles (id, full_name) values
  ('00000000-0000-4000-8000-0000000000a1', 'ولي أمر'),
  ('00000000-0000-4000-8000-0000000000b2', 'آخر');
insert into public.parent_students (parent_id, student_id)
  select '00000000-0000-4000-8000-0000000000a1'::uuid, id from public.students where demo_key in ('sama', 'ahmad');

select set_config('test.sama', (select id::text from public.students where demo_key = 'sama'), true),
       set_config('test.faisal', (select id::text from public.students where demo_key = 'faisal'), true);

create function pg_temp.expect_error(label text, sql text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL: % (statement succeeded)', label;
exception
  when raise_exception then raise;
  when others then raise notice 'ok: % (%)', label, sqlerrm;
end $$;
create function pg_temp.expect(label text, sql text, expected bigint) returns void language plpgsql as $$
declare got bigint;
begin
  execute sql into got;
  if got is distinct from expected then raise exception 'FAIL: % (expected %, got %)', label, expected, got; end if;
  raise notice 'ok: %', label;
end $$;
grant execute on function pg_temp.expect_error(text, text), pg_temp.expect(text, text, bigint) to anon, authenticated;

-- ---------- Operator ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated","app_metadata":{"tammeni_role":"demo_operator"}}', true);

select pg_temp.expect('operator sees the 4 demo students', 'select count(*) from public.students', 4);
select pg_temp.expect('operator records an event', $q$
  with r as (insert into public.demo_events (student_id, kind, event_date, summary, idempotency_key)
             values (current_setting('test.sama')::uuid, 'attendance', '2026-10-29', 'غياب', 'key-0000001') returning 1)
  select count(*) from r $q$, 1);
select pg_temp.expect_error('same idempotency key cannot create a second event', $q$
  insert into public.demo_events (student_id, kind, event_date, summary, idempotency_key)
  values (current_setting('test.sama')::uuid, 'attendance', '2026-10-29', 'غياب', 'key-0000001') $q$);
select pg_temp.expect('operator writes simulated attendance', $q$
  with r as (insert into public.attendance_records (student_id, day, status, origin, demo_event_id)
             select student_id, '2026-10-29', 'absent', 'demo', id from public.demo_events where idempotency_key = 'key-0000001' returning 1)
  select count(*) from r $q$, 1);
select pg_temp.expect_error('operator cannot write "imported" rows', $q$
  insert into public.attendance_records (student_id, day, status, origin, source_ref)
  values (current_setting('test.sama')::uuid, '2026-10-30', 'absent', 'import', 'att:x') $q$);
select pg_temp.expect('imported attendance cannot be changed by the operator', $q$
  with r as (update public.attendance_records set status = 'excused' where origin = 'import' returning 1) select count(*) from r $q$, 0);
select pg_temp.expect_error('grade above the full mark rejected', $q$
  insert into public.grades (student_id, subject, assessment, score, out_of, published_on, origin, demo_event_id)
  select student_id, 'x', 'y', 11, 10, '2026-10-29', 'demo', id from public.demo_events where idempotency_key = 'key-0000001' $q$);
select pg_temp.expect('imported exam can be cancelled (status only)', $q$
  with r as (update public.exams set status = 'cancelled' where student_id = current_setting('test.sama')::uuid and origin = 'import'
             and exam_date = '2026-11-01' returning 1) select count(*) from r $q$, 1);
select pg_temp.expect_error('imported exam cannot be archived', $q$
  update public.exams set archived_at = now() where origin = 'import' and student_id = current_setting('test.sama')::uuid $q$);
select pg_temp.expect_error('operator cannot read raw source rows', 'select count(*) from public.demo_source_records');
select pg_temp.expect_error('operator cannot delete events', 'delete from public.demo_events');

-- ---------- Parent (linked to سما and أحمد) ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","app_metadata":{}}', true);
select pg_temp.expect('parent sees only سما and أحمد', 'select count(*) from public.students', 2);
select pg_temp.expect('parent cannot see فيصل''s grades', $q$select count(*) from public.grades where student_id = current_setting('test.faisal')::uuid$q$, 0);
select pg_temp.expect('parent sees سما''s simulated absence', $q$select count(*) from public.attendance_records where origin = 'demo'$q$, 1);
select pg_temp.expect('parent sees no notifications or attempts', 'select count(*) from public.notifications', 0);
select pg_temp.expect_error('parent cannot record an event (operator action)', $q$
  insert into public.demo_events (student_id, kind, event_date, summary, idempotency_key)
  values (current_setting('test.sama')::uuid, 'attendance', '2026-10-29', 'x', 'key-0000002') $q$);
select pg_temp.expect_error('parent cannot write attendance', $q$
  insert into public.attendance_records (student_id, day, status, origin, demo_event_id)
  values (current_setting('test.sama')::uuid, '2026-10-30', 'absent', 'demo', gen_random_uuid()) $q$);
select pg_temp.expect('parent saves preferences for سما', $q$
  with r as (insert into public.assistant_preferences (student_id) values (current_setting('test.sama')::uuid) returning 1) select count(*) from r $q$, 1);
select pg_temp.expect_error('parent cannot save preferences for فيصل (not linked)', $q$
  insert into public.assistant_preferences (student_id) values (current_setting('test.faisal')::uuid) $q$);
select pg_temp.expect('parent cannot read a call context without its token', $q$select count(*) from (select public.get_call_context(repeat('x', 40)) c) t where c is not null$q$, 0);

-- ---------- Operator resets سما's preferences; cannot touch anything else ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated","app_metadata":{"tammeni_role":"demo_operator"}}', true);
select pg_temp.expect('operator reads سما''s preferences', 'select count(*) from public.assistant_preferences', 1);
select pg_temp.expect('operator resets them', $q$
  with r as (update public.assistant_preferences set exams_timing = 'day-before' returning 1) select count(*) from r $q$, 1);
select pg_temp.expect_error('operator cannot move preferences to another parent', $q$
  update public.assistant_preferences set parent_id = '00000000-0000-4000-8000-0000000000b2' $q$);

-- ---------- Signed-in outsider (no links, no role) ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","app_metadata":{}}', true);
select pg_temp.expect('outsider sees no students', 'select count(*) from public.students', 0);
select pg_temp.expect('outsider sees no records', 'select count(*) from public.grades', 0);
select pg_temp.expect('outsider sees no preferences', 'select count(*) from public.assistant_preferences', 0);
select pg_temp.expect_error('outsider cannot record events', $q$
  insert into public.demo_events (student_id, kind, event_date, summary, idempotency_key)
  values (current_setting('test.sama')::uuid, 'attendance', '2026-10-29', 'x', 'key-0000003') $q$);

-- ---------- Anonymous ----------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.expect_error('anon cannot read grades', 'select count(*) from public.grades');
select pg_temp.expect_error('anon cannot read events', 'select count(*) from public.demo_events');

rollback;
