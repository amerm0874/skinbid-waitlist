-- SkinBid product schema. Run in the Supabase SQL editor.
-- Waitlist is public insert. Product tables use Auth.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Waitlist (public form on /waitlist only)
-- ---------------------------------------------------------------------------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  social text,
  instagram text,
  extra text,
  role text default 'athlete' check (role is null or role in ('athlete', 'brand')),
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.waitlist add column if not exists fields jsonb not null default '{}'::jsonb;
alter table public.waitlist add column if not exists name text;
alter table public.waitlist add column if not exists social text;
alter table public.waitlist add column if not exists instagram text;
alter table public.waitlist add column if not exists extra text;
alter table public.waitlist alter column role drop not null;
alter table public.waitlist alter column role set default 'athlete';

alter table public.waitlist enable row level security;

-- Keep the newest row per email, then lock the table to one row each.
delete from public.waitlist as older
using public.waitlist as newer
where older.email = newer.email
  and (
    older.created_at < newer.created_at
    or (older.created_at = newer.created_at and older.id < newer.id)
  );

create unique index if not exists waitlist_email_idx on public.waitlist (email);

grant insert on table public.waitlist to anon, authenticated;

drop policy if exists "waitlist_insert_public" on public.waitlist;
create policy "waitlist_insert_public"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('athlete', 'brand')),
  name text,
  country text,
  social text,
  brand_category text,
  website text,
  logo_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  date timestamptz not null,
  city text,
  sport text,
  slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'live', 'closed', 'done', 'cancelled')),
  likeness_opt_in boolean not null default false,
  appearance_price_cents int,
  created_at timestamptz not null default now()
);

create index if not exists events_status_date_idx on public.events (status, date);
create index if not exists events_athlete_idx on public.events (athlete_id);

alter table public.events enable row level security;

drop policy if exists "events_select_public" on public.events;
create policy "events_select_public"
  on public.events for select
  to anon, authenticated
  using (status <> 'draft' or athlete_id = auth.uid());

drop policy if exists "events_insert_athlete" on public.events;
create policy "events_insert_athlete"
  on public.events for insert
  to authenticated
  with check (athlete_id = auth.uid());

drop policy if exists "events_update_athlete" on public.events;
create policy "events_update_athlete"
  on public.events for update
  to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Zones (12 named parts, no custom names)
-- ---------------------------------------------------------------------------
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (name in (
    'chest_l','chest_r','shoulder_l','shoulder_r',
    'bicep_l','bicep_r','forearm_l','forearm_r',
    'back_l','back_r','thigh_l','thigh_r'
  )),
  status text not null default 'open' check (status in ('open', 'closed')),
  unique (event_id, name)
);

alter table public.zones enable row level security;

drop policy if exists "zones_select" on public.zones;
create policy "zones_select"
  on public.zones for select
  to anon, authenticated
  using (true);

drop policy if exists "zones_write_athlete" on public.zones;
create policy "zones_write_athlete"
  on public.zones for all
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = zones.event_id and e.athlete_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = zones.event_id and e.athlete_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Bids
-- ---------------------------------------------------------------------------
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones (id) on delete cascade,
  brand_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents int not null check (amount_cents >= 10000),
  dodo_payment_id text,
  dodo_checkout_id text,
  status text not null default 'pending'
    check (status in ('pending', 'held', 'refunded', 'won', 'failed')),
  payable boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bids_zone_status_idx on public.bids (zone_id, status);
create index if not exists bids_payment_idx on public.bids (dodo_payment_id);

alter table public.bids enable row level security;

drop policy if exists "bids_select" on public.bids;
create policy "bids_select"
  on public.bids for select
  to anon, authenticated
  using (true);

drop policy if exists "bids_insert_brand" on public.bids;
create policy "bids_insert_brand"
  on public.bids for insert
  to authenticated
  with check (brand_id = auth.uid());

-- Updates (held / refunded / won) go through the service role in webhooks.

-- ---------------------------------------------------------------------------
-- Captures / avatars / proofs / ledger
-- ---------------------------------------------------------------------------
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  paths text[] not null default '{}',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.captures enable row level security;

drop policy if exists "captures_own" on public.captures;
create policy "captures_own"
  on public.captures for all
  to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null unique references public.profiles (id) on delete cascade,
  glb_url text,
  ready boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.avatars enable row level security;

drop policy if exists "avatars_select" on public.avatars;
create policy "avatars_select"
  on public.avatars for select
  to anon, authenticated
  using (true);

drop policy if exists "avatars_own_write" on public.avatars;
create policy "avatars_own_write"
  on public.avatars for all
  to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

create table if not exists public.proofs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  files text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.proofs enable row level security;

drop policy if exists "proofs_select_involved" on public.proofs;
create policy "proofs_select_involved"
  on public.proofs for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = proofs.event_id
        and (e.athlete_id = auth.uid())
    )
  );

drop policy if exists "proofs_insert_athlete" on public.proofs;
create policy "proofs_insert_athlete"
  on public.proofs for insert
  to authenticated
  with check (
    exists (
      select 1 from public.events e
      where e.id = proofs.event_id and e.athlete_id = auth.uid()
    )
  );

create table if not exists public.ledger (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid references public.proofs (id) on delete set null,
  bid_id uuid references public.bids (id) on delete set null,
  athlete_cents int not null,
  platform_cents int not null,
  created_at timestamptz not null default now()
);

alter table public.ledger enable row level security;

-- Ledger is written by the service role from /admin.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('captures', 'captures', false),
  ('avatars', 'avatars', true),
  ('logos', 'logos', true),
  ('proofs', 'proofs', false)
on conflict (id) do nothing;

drop policy if exists "storage_own_write" on storage.objects;
create policy "storage_own_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('captures', 'avatars', 'logos', 'proofs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_public_read_avatars_logos" on storage.objects;
create policy "storage_public_read_avatars_logos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('avatars', 'logos'));

drop policy if exists "storage_own_read_private" on storage.objects;
create policy "storage_own_read_private"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('captures', 'proofs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
