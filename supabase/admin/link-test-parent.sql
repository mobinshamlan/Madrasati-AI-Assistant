-- ADMIN ONLY. Run in the Supabase SQL editor (or as the service role) after review.
-- Links one existing Auth test account to one fictional student. Run once per link.
--
-- 1. Create the test user in Dashboard → Authentication → Users (use a test email you control).
-- 2. Copy that user's UID and replace the placeholder below. Set the name and the student key
--    ('sama' or 'faisal'). The script stops if the placeholder is left, the user does not exist,
--    or the student key is unknown.
do $$
declare
  v_parent_id uuid := 'REPLACE-WITH-AUTH-USER-UID';  -- placeholder: fails until replaced
  v_full_name text := 'ولي أمر تجريبي (أ)';
  v_student_key text := 'sama';
  v_student_id uuid;
begin
  if not exists (select 1 from auth.users where id = v_parent_id) then
    raise exception 'No Auth user with that UID. Create the user first.';
  end if;

  select id into v_student_id from public.students where demo_key = v_student_key;
  if v_student_id is null then
    raise exception 'Unknown student key: %', v_student_key;
  end if;

  insert into public.parent_profiles (id, full_name) values (v_parent_id, v_full_name)
  on conflict (id) do nothing;

  insert into public.parent_students (parent_id, student_id) values (v_parent_id, v_student_id)
  on conflict do nothing;

  raise notice 'Linked % to student %', v_parent_id, v_student_key;
end $$;

-- To remove a link (this also deletes that pair's preferences):
-- delete from public.parent_students
--  where parent_id = '<auth-user-uid>'
--    and student_id = (select id from public.students where demo_key = 'sama');
