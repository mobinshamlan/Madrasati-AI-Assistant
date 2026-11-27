-- طمّنـــي: ربط ولي الأمر التجريبي بسما وأحمد. شغّليه بعد 1-database.sql.
-- 1) أنشئي المستخدم أولاً: Authentication → Users → Add user → Create new user (فعّلي Auto Confirm User).
-- 2) بدّلي PUT-PARENT-EMAIL-HERE بنفس إيميل المستخدم، ثم شغّلي. لا تكتبين الباسوورد هنا.
do $$
declare
  v_email text := 'PUT-PARENT-EMAIL-HERE';
  v_parent uuid;
  v_count int;
begin
  select id into v_parent from auth.users where lower(email) = lower(v_email);
  if v_parent is null then
    raise exception 'ما لقيت مستخدم بهذا الإيميل. أنشئيه أول من Authentication → Users.';
  end if;

  insert into public.parent_profiles (id, full_name) values (v_parent, 'عبدالرحمن بن سعد الشهري')
  on conflict (id) do nothing;

  insert into public.parent_students (parent_id, student_id)
  select v_parent, s.id from public.students s where s.demo_key in ('sama', 'ahmad')
  on conflict do nothing;

  select count(*) into v_count from public.parent_students where parent_id = v_parent;
  if v_count <> 2 then
    raise exception 'المتوقع ابنين مربوطين، والموجود %', v_count;
  end if;
end $$;

-- النتيجة المتوقعة: سما وأحمد.
select s.demo_key, s.full_name
from public.parent_students ps join public.students s on s.id = ps.student_id
order by s.demo_key desc;
