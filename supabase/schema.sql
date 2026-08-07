create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create table if not exists public.site_content (
  id text primary key default 'main',
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id text primary key default 'main',
  business_name text not null default 'Auto Export',
  whatsapp text not null default '',
  email text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id text primary key,
  data jsonb not null,
  published boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null default '',
  email text not null default '',
  whatsapp text not null default '',
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;
alter table public.site_settings enable row level security;
alter table public.vehicles enable row level security;
alter table public.inquiries enable row level security;

drop policy if exists "public read site content" on public.site_content;
create policy "public read site content" on public.site_content for select using (true);
drop policy if exists "admin manage site content" on public.site_content;
create policy "admin manage site content" on public.site_content for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings for select using (true);
drop policy if exists "admin manage settings" on public.site_settings;
create policy "admin manage settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read published vehicles" on public.vehicles;
create policy "public read published vehicles" on public.vehicles for select using (published = true or public.is_admin());
drop policy if exists "admin manage vehicles" on public.vehicles;
create policy "admin manage vehicles" on public.vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public create inquiries" on public.inquiries;
create policy "public create inquiries" on public.inquiries for insert to anon, authenticated with check (true);
drop policy if exists "admin manage inquiries" on public.inquiries;
create policy "admin manage inquiries" on public.inquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-images', 'vehicle-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read vehicle images" on storage.objects;
create policy "public read vehicle images" on storage.objects for select using (bucket_id = 'vehicle-images');
drop policy if exists "admin upload vehicle images" on storage.objects;
create policy "admin upload vehicle images" on storage.objects for insert to authenticated with check (bucket_id = 'vehicle-images' and public.is_admin());
drop policy if exists "admin update vehicle images" on storage.objects;
create policy "admin update vehicle images" on storage.objects for update to authenticated using (bucket_id = 'vehicle-images' and public.is_admin()) with check (bucket_id = 'vehicle-images' and public.is_admin());
drop policy if exists "admin delete vehicle images" on storage.objects;
create policy "admin delete vehicle images" on storage.objects for delete to authenticated using (bucket_id = 'vehicle-images' and public.is_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_content') then
    alter publication supabase_realtime add table public.site_content;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_settings') then
    alter publication supabase_realtime add table public.site_settings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vehicles') then
    alter publication supabase_realtime add table public.vehicles;
  end if;
end
$$;
