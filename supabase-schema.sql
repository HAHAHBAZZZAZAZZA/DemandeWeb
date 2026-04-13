-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

-- 1) Bucket for photos (public = true for direct links)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- 2) Main table
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null check (char_length(pseudo) between 1 and 64),
  photo_path text not null,
  status text not null default 'en attente' check (status in ('en attente', 'accepté', 'refusé')),
  staff_note text default '',
  priority boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.submissions enable row level security;

-- Reset policies cleanly
DROP POLICY IF EXISTS "submissions_select_all" ON public.submissions;
DROP POLICY IF EXISTS "submissions_insert_all" ON public.submissions;
DROP POLICY IF EXISTS "submissions_delete_all" ON public.submissions;

create policy "submissions_select_all"
on public.submissions
for select
to anon
using (true);

create policy "submissions_insert_all"
on public.submissions
for insert
to anon
with check (true);

create policy "submissions_delete_all"
on public.submissions
for delete
to anon
using (true);

DROP POLICY IF EXISTS "submissions_update_all" ON public.submissions;
create policy "submissions_update_all"
on public.submissions
for update
to anon
using (true)
with check (true);

-- Storage object policies for this bucket
DROP POLICY IF EXISTS "storage_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_delete" ON storage.objects;

create policy "storage_photos_select"
on storage.objects
for select
to anon
using (bucket_id = 'photos');

create policy "storage_photos_insert"
on storage.objects
for insert
to anon
with check (bucket_id = 'photos');

create policy "storage_photos_delete"
on storage.objects
for delete
to anon
using (bucket_id = 'photos');
