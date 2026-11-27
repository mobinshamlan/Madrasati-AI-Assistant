-- Renames أحمد's fictional school in a database that was set up before the new name.
-- Run it once in the Supabase SQL Editor. Running it again changes nothing.
update public.students
set school_name = 'مدرسة ابن خلدون الابتدائية للبنين'
where demo_key = 'ahmad';

-- Check
select first_name, school_name from public.students where demo_key in ('sama', 'ahmad');
