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

-- Prevent already-approved players from reposting another photo
drop function if exists public.block_repost_after_approval();

create function public.block_repost_after_approval()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.submissions s
    where s.pseudo = new.pseudo
      and s.status = 'accepté'
  ) then
    raise exception 'Ce compte a déjà été validé et ne peut plus republier de photo';
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_block_repost_after_approval on public.submissions;
create trigger submissions_block_repost_after_approval
before insert on public.submissions
for each row
execute function public.block_repost_after_approval();

-- 2a) Live presence tracking for staff dashboard
create table if not exists public.site_presence (
  pseudo text primary key check (char_length(pseudo) between 1 and 64),
  current_section text not null default 'community',
  last_seen_at timestamptz not null default now(),
  temp_access_until timestamptz
);

alter table public.site_presence enable row level security;

drop policy if exists "site_presence_select_all" on public.site_presence;
drop policy if exists "site_presence_insert_all" on public.site_presence;
drop policy if exists "site_presence_update_all" on public.site_presence;
drop policy if exists "site_presence_delete_all" on public.site_presence;

create policy "site_presence_select_all"
on public.site_presence
for select
to anon
using (true);

create policy "site_presence_insert_all"
on public.site_presence
for insert
to anon
with check (true);

create policy "site_presence_update_all"
on public.site_presence
for update
to anon
using (true)
with check (true);

create policy "site_presence_delete_all"
on public.site_presence
for delete
to anon
using (true);

create index if not exists site_presence_last_seen_idx
on public.site_presence (last_seen_at desc);

-- 2b) Community comments
create table if not exists public.submission_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 1 and 64),
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

alter table public.submission_comments enable row level security;

DROP POLICY IF EXISTS "submission_comments_select_all" ON public.submission_comments;
DROP POLICY IF EXISTS "submission_comments_insert_all" ON public.submission_comments;
DROP POLICY IF EXISTS "submission_comments_delete_all" ON public.submission_comments;

create policy "submission_comments_select_all"
on public.submission_comments
for select
to anon
using (true);

create policy "submission_comments_insert_all"
on public.submission_comments
for insert
to anon
with check (true);

create policy "submission_comments_delete_all"
on public.submission_comments
for delete
to anon
using (true);

create index if not exists submission_comments_submission_created_idx
on public.submission_comments (submission_id, created_at);

-- 2c) Community likes
create table if not exists public.submission_likes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 1 and 64),
  created_at timestamptz not null default now(),
  unique (submission_id, pseudo)
);

alter table public.submission_likes enable row level security;

DROP POLICY IF EXISTS "submission_likes_select_all" ON public.submission_likes;
DROP POLICY IF EXISTS "submission_likes_insert_all" ON public.submission_likes;
DROP POLICY IF EXISTS "submission_likes_delete_all" ON public.submission_likes;

create policy "submission_likes_select_all"
on public.submission_likes
for select
to anon
using (true);

create policy "submission_likes_insert_all"
on public.submission_likes
for insert
to anon
with check (true);

create policy "submission_likes_delete_all"
on public.submission_likes
for delete
to anon
using (true);

create index if not exists submission_likes_submission_created_idx
on public.submission_likes (submission_id, created_at);

-- 2d) Bucket and table for staff videos
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

create table if not exists public.staff_videos (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null default 'staff',
  title text not null check (char_length(title) between 1 and 80),
  video_path text not null,
  profile_photo_path text not null default '',
  duration_seconds integer not null check (duration_seconds between 1 and 300),
  status text not null default 'publiée' check (status in ('en attente', 'publiée', 'refusée')),
  staff_note text default '',
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.staff_videos add column if not exists pseudo text not null default 'staff';
alter table public.staff_videos add column if not exists profile_photo_path text not null default '';
alter table public.staff_videos add column if not exists status text not null default 'publiée';
alter table public.staff_videos add column if not exists staff_note text default '';
alter table public.staff_videos add column if not exists approved_at timestamptz;

alter table public.staff_videos enable row level security;

drop policy if exists "staff_videos_select_all" on public.staff_videos;
drop policy if exists "staff_videos_insert_all" on public.staff_videos;
drop policy if exists "staff_videos_delete_all" on public.staff_videos;

create policy "staff_videos_select_all"
on public.staff_videos
for select
to anon
using (true);

create policy "staff_videos_insert_all"
on public.staff_videos
for insert
to anon
with check (true);

create policy "staff_videos_delete_all"
on public.staff_videos
for delete
to anon
using (true);

create index if not exists staff_videos_created_idx
on public.staff_videos (created_at desc);

-- Storage object policies for this bucket
DROP POLICY IF EXISTS "storage_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "storage_videos_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_videos_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_videos_delete" ON storage.objects;

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

create policy "storage_videos_select"
on storage.objects
for select
to anon
using (bucket_id = 'videos');

create policy "storage_videos_insert"
on storage.objects
for insert
to anon
with check (bucket_id = 'videos');

create policy "storage_videos_delete"
on storage.objects
for delete
to anon
using (bucket_id = 'videos');

-- 3) Staff metric: storage usage (%) for the photos bucket
drop function if exists public.staff_storage_usage(text, bigint);

create function public.staff_storage_usage(
  target_bucket text default 'photos',
  max_quota_bytes bigint default 2147483648
)
returns table (
  used_bytes bigint,
  quota_bytes bigint,
  used_percent numeric(6,2),
  file_count bigint
)
language sql
stable
security definer
set search_path = public, storage
as $$
  with usage_data as (
    select
      coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as used_bytes,
      count(*)::bigint as file_count
    from storage.objects o
    where o.bucket_id = target_bucket
  )
  select
    usage_data.used_bytes,
    greatest(max_quota_bytes, 1)::bigint as quota_bytes,
    round((usage_data.used_bytes::numeric / greatest(max_quota_bytes, 1)::numeric) * 100, 2) as used_percent,
    usage_data.file_count
  from usage_data;
$$;

grant execute on function public.staff_storage_usage(text, bigint) to anon, authenticated;
