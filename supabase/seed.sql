-- Fictional students only, matching src/components/dashboard/data.ts. Not real people.
-- No parent profiles, Auth users or links: an administrator links test accounts explicitly
-- with supabase/admin/link-test-parent.sql.
insert into public.students (demo_key, full_name, first_name, grade_label, school_name) values
  ('reem', 'ريم عبدالرحمن الشهري', 'ريم', 'الصف الخامس الابتدائي', 'مدرسة رياض النخبة الابتدائية للبنات'),
  ('faisal', 'فيصل عبدالرحمن الشهري', 'فيصل', 'الصف الثاني المتوسط', 'متوسطة الأندلس النموذجية للبنين')
on conflict (demo_key) do nothing;
