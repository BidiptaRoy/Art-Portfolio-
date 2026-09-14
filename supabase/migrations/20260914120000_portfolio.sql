-- =============================================================================
-- Educational design portfolio: database, image storage, and access rules.
--
-- How to run: Supabase Dashboard -> SQL Editor -> New query -> paste this whole
-- file -> Run. It is safe to run again; it will not delete your designs.
--
-- Access model
--   * Visitors (not signed in) can read PUBLISHED designs only.
--   * Only accounts listed in public.admins can create, edit, delete, reorder,
--     or upload. Signing up alone never grants access.
--   * Every uploaded image lives in the PRIVATE bucket "design-uploads".
--     When a design is published, the app copies its images into the PUBLIC
--     bucket "published-designs"; unpublishing or deleting removes the copies.
--     Draft images therefore never exist in the public bucket.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Owner / admin accounts
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- No policies on purpose: nobody can read or change this table through the
-- public API. Manage it from the SQL Editor (see README, "Create your owner account").
revoke all on table public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Designs
-- -----------------------------------------------------------------------------
create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subject text not null,
  description text not null default '',
  alt_text text not null,
  -- Free text so future products (mug, rug, ...) need no schema change.
  product_type text not null default 'T-shirt',
  status text not null default 'draft',
  sort_order integer not null default 0,
  image_path text not null,
  image_width integer,
  image_height integer,
  mockup_path text,
  mockup_alt_text text,
  mockup_width integer,
  mockup_height integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint designs_status_check
    check (status in ('draft', 'published')),
  constraint designs_slug_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint designs_title_check
    check (char_length(btrim(title)) between 1 and 120),
  constraint designs_subject_check
    check (char_length(btrim(subject)) between 1 and 60),
  constraint designs_description_check
    check (char_length(description) <= 1000),
  constraint designs_alt_text_check
    check (char_length(btrim(alt_text)) between 1 and 300),
  constraint designs_mockup_alt_text_check
    check (mockup_alt_text is null or char_length(mockup_alt_text) <= 300),
  constraint designs_product_type_check
    check (char_length(btrim(product_type)) between 1 and 40),
  -- Image paths must sit in this design's own folder: "<design id>/design-<uuid>.png"
  constraint designs_image_path_check
    check (
      image_path ~ '^[0-9a-f-]{36}/design-[0-9a-f-]{36}\.(png|jpg|webp)$'
      and split_part(image_path, '/', 1) = id::text
    ),
  constraint designs_mockup_path_check
    check (
      mockup_path is null or (
        mockup_path ~ '^[0-9a-f-]{36}/mockup-[0-9a-f-]{36}\.(png|jpg|webp)$'
        and split_part(mockup_path, '/', 1) = id::text
      )
    ),
  constraint designs_image_size_check
    check (
      (image_width is null or image_width between 1 and 30000)
      and (image_height is null or image_height between 1 and 30000)
      and (mockup_width is null or mockup_width between 1 and 30000)
      and (mockup_height is null or mockup_height between 1 and 30000)
    )
);

create index if not exists designs_gallery_order_idx
  on public.designs (status, sort_order, created_at desc);

-- Keep updated_at fresh and remember when a design was first published.
create or replace function public.designs_set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create or replace trigger designs_set_timestamps
  before insert or update on public.designs
  for each row execute function public.designs_set_timestamps();

alter table public.designs enable row level security;

-- Table privileges (row level security below narrows these further).
revoke all on table public.designs from anon;
grant select on table public.designs to anon;
grant select, insert, update, delete on table public.designs to authenticated;

drop policy if exists "Anyone can view published designs" on public.designs;
create policy "Anyone can view published designs"
  on public.designs for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Admins can view all designs" on public.designs;
create policy "Admins can view all designs"
  on public.designs for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can add designs" on public.designs;
create policy "Admins can add designs"
  on public.designs for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admins can edit designs" on public.designs;
create policy "Admins can edit designs"
  on public.designs for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admins can delete designs" on public.designs;
create policy "Admins can delete designs"
  on public.designs for delete
  to authenticated
  using ((select public.is_admin()));

-- Save a new display order in one step: position in the array = sort order.
create or replace function public.reorder_designs(ordered_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.designs as d
     set sort_order = o.ord::integer
    from unnest(ordered_ids) with ordinality as o(id, ord)
   where d.id = o.id;
end;
$$;

revoke all on function public.reorder_designs(uuid[]) from public, anon;
grant execute on function public.reorder_designs(uuid[]) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Image storage
-- -----------------------------------------------------------------------------
-- Both buckets accept only PNG, JPEG, and WebP files up to 10 MB. Supabase
-- enforces these limits on its servers for every upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('design-uploads', 'design-uploads', false, 10485760,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('published-designs', 'published-designs', true, 10485760,
    array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only admins may list, upload, copy, replace, or delete files in either
-- bucket. Visitors get published images through public URLs of the
-- "published-designs" bucket, which cannot be listed or modified.
drop policy if exists "Admins manage design images" on storage.objects;
create policy "Admins manage design images"
  on storage.objects for all
  to authenticated
  using (
    bucket_id in ('design-uploads', 'published-designs')
    and (select public.is_admin())
  )
  with check (
    bucket_id in ('design-uploads', 'published-designs')
    and (select public.is_admin())
  );
