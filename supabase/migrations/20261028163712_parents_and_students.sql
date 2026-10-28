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
