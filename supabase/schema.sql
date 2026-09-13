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
alter table public.waitlist add column if not exists sport text;
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
  dob date,
  age integer,
  sport text,
  sport_detail text,
  social text,
  socials jsonb,
  brand_category text,
  website text,
  logo_url text, -- public PNG in the logos bucket; occupied zone overlays read this
  photo_url text, -- square athlete photo in the photos bucket; public /a/[handle] only
  payout_rail text,
  payout_account text,
  created_at timestamptz not null default now()
);

-- Athlete date of birth. Age is legacy; form writes dob and may omit age.
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists dob date;
alter table public.profiles add column if not exists sport text;
alter table public.profiles add column if not exists sport_detail text;
alter table public.profiles add column if not exists socials jsonb;
alter table public.profiles add column if not exists photo_url text;
alter table public.profiles drop constraint if exists profiles_age_check;
alter table public.profiles add constraint profiles_age_check
  check (
    age is null
    or (age >= 18 and age <= 99)
  );
-- Retired sports land in Other. Combat detail is Boxing / MMA / Kickboxing / Wrestling / BJJ.
update public.profiles
set
  sport_detail = sport,
  sport = 'Other'
where sport in ('Cycling', 'Triathlon', 'Strongman');

alter table public.profiles drop constraint if exists profiles_sport_check;
alter table public.profiles add constraint profiles_sport_check
  check (
    sport is null
    or sport in (
      'HYROX',
      'Running',
      'CrossFit',
      'Combat',
      'Athletics',
      'Other'
    )
  );

alter table public.profiles drop constraint if exists profiles_sport_detail_check;
alter table public.profiles add constraint profiles_sport_detail_check
  check (
    sport_detail is null
    or (
      sport = 'Combat'
      and sport_detail in (
        'Boxing',
        'MMA',
        'Kickboxing',
        'Wrestling',
        'BJJ'
      )
    )
    or (
      sport = 'Other'
      and char_length(btrim(sport_detail)) between 1 and 40
    )
  );

-- Destination only. Brands pay SkinBid. Athletes get 80% to PayPal after proof.
alter table public.profiles add column if not exists payout_rail text;
alter table public.profiles add column if not exists payout_account text;

update public.profiles
set payout_rail = null
where payout_rail is not null
  and payout_rail <> 'PayPal';

alter table public.profiles drop constraint if exists profiles_payout_rail_check;
alter table public.profiles add constraint profiles_payout_rail_check
  check (
    payout_rail is null
    or payout_rail = 'PayPal'
  );

-- One category per brand. Same category cannot share a body later.
update public.profiles
set brand_category = case lower(brand_category)
  when 'drink' then 'Drink'
  when 'apparel' then 'Apparel'
  when 'finance' then 'Finance'
  when 'tech' then 'Tech'
  when 'food' then 'Food'
  when 'software' then 'Tech'
  when 'supplements' then 'Other'
  when 'wearable' then 'Other'
  when 'other' then 'Other'
  else brand_category
end
where brand_category is not null;

alter table public.profiles drop constraint if exists profiles_brand_category_check;
alter table public.profiles add constraint profiles_brand_category_check
  check (
    brand_category is null
    or brand_category in ('Drink', 'Apparel', 'Finance', 'Tech', 'Food', 'Other')
  );

alter table public.profiles enable row level security;

grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;

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

-- PayPal stays off public profile reads. Anon and other users cannot select it.
-- The athlete reads/writes their own row on athlete_payouts.
revoke select (payout_rail, payout_account) on table public.profiles from public, anon, authenticated;
revoke insert (payout_rail, payout_account) on table public.profiles from public, anon, authenticated;
revoke update (payout_rail, payout_account) on table public.profiles from public, anon, authenticated;

-- Date of birth is not a public listing field. Anon cannot select it.
-- Authenticated clients can still read dob (including other users) until
-- profiles_select is narrowed; owners need it for onboarding.
revoke select (dob, age) on table public.profiles from anon;

create table if not exists public.athlete_payouts (
  athlete_id uuid primary key references public.profiles (id) on delete cascade,
  payout_rail text,
  payout_account text,
  created_at timestamptz not null default now()
);

alter table public.athlete_payouts drop constraint if exists athlete_payouts_rail_check;
alter table public.athlete_payouts add constraint athlete_payouts_rail_check
  check (
    payout_rail is null
    or payout_rail = 'PayPal'
  );

insert into public.athlete_payouts (athlete_id, payout_rail, payout_account)
select id, payout_rail, payout_account
from public.profiles
where payout_rail is not null
   or payout_account is not null
on conflict (athlete_id) do nothing;

alter table public.athlete_payouts enable row level security;

drop policy if exists "athlete_payouts_own" on public.athlete_payouts;
create policy "athlete_payouts_own"
  on public.athlete_payouts for all
  to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

grant select, insert, update, delete on table public.athlete_payouts to authenticated;
revoke all on table public.athlete_payouts from anon;

update public.profiles
set payout_rail = null,
    payout_account = null
where exists (
  select 1
  from public.athlete_payouts a
  where a.athlete_id = profiles.id
);

-- ---------------------------------------------------------------------------
-- Brand leads (pre-launch email capture on the gated bid dock)
-- ---------------------------------------------------------------------------
create table if not exists public.brand_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  event_slug text,
  created_at timestamptz not null default now()
);

create unique index if not exists brand_leads_email_slug_idx
  on public.brand_leads (email, coalesce(event_slug, ''));

alter table public.brand_leads enable row level security;

grant insert on table public.brand_leads to anon, authenticated;

drop policy if exists "brand_leads_insert_public" on public.brand_leads;
create policy "brand_leads_insert_public"
  on public.brand_leads for insert
  to anon, authenticated
  with check (true);

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
  sport_detail text,
  slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'live', 'closed', 'done', 'cancelled')),
  likeness_opt_in boolean not null default false,
  appearance_price_cents int,
  created_at timestamptz not null default now()
);

alter table public.events add column if not exists sport_detail text;
alter table public.events add column if not exists country text;

create index if not exists events_status_date_idx on public.events (status, date);
create index if not exists events_athlete_idx on public.events (athlete_id);

-- One draft or live listing per athlete. Closed/done events do not block the next one.
create unique index if not exists events_one_active_per_athlete
  on public.events (athlete_id)
  where status in ('draft', 'live');

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
-- Official events catalog (picker on /new). Not auctions. Never live.
-- ---------------------------------------------------------------------------
create table if not exists public.official_events (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null unique,
  name text not null,
  city text,
  country text,
  sport text not null,
  combat_subtype text,
  official_url text not null,
  og_image_url text,
  og_image_checked_at timestamptz,
  venue text,
  facts_checked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.official_events add column if not exists og_image_url text;
alter table public.official_events add column if not exists og_image_checked_at timestamptz;
alter table public.official_events add column if not exists venue text;
alter table public.official_events add column if not exists facts_checked_at timestamptz;

alter table public.official_events drop constraint if exists official_events_sport_check;
alter table public.official_events add constraint official_events_sport_check
  check (
    sport in ('HYROX', 'Running', 'CrossFit', 'Combat', 'Athletics')
  );

alter table public.official_events drop constraint if exists official_events_combat_subtype_check;
alter table public.official_events add constraint official_events_combat_subtype_check
  check (
    (
      sport = 'Combat'
      and combat_subtype in (
        'Boxing',
        'MMA',
        'Kickboxing',
        'Wrestling',
        'BJJ'
      )
    )
    or (
      sport <> 'Combat'
      and combat_subtype is null
    )
  );

create index if not exists official_events_sport_date_idx
  on public.official_events (sport, starts_on);

alter table public.official_events enable row level security;

drop policy if exists "official_events_select" on public.official_events;
create policy "official_events_select"
  on public.official_events for select
  to anon, authenticated
  using (true);

grant select on table public.official_events to anon, authenticated;
revoke insert, update, delete on table public.official_events from anon, authenticated;

-- Sport / AI / stock JPGs are not official photos. Keep real og_image_url rows.
update public.official_events
set og_image_url = null
where og_image_url is not null
  and (
    og_image_url like '/sports/%'
    or og_image_url ~* '/sports/[a-z0-9]+\.jpe?g([?#]|$)'
  );

-- Drop UFC, Canelo, and every 2027 catalog row. Keep IBJJF. Does not touch public.events.
delete from public.official_events
where starts_on >= '2027-01-01'
   or name ilike '%canelo%'
   or name ~* '^ufc(\s|:|$)'
   or official_url ilike '%ufc.com%'
   or official_url ilike '%/ufc/%';

-- 20 researched rows through 2026. Re-run updates names/urls. Does not insert into events.
insert into public.official_events (
  starts_on, name, city, country, sport, combat_subtype, official_url
) values
  ('2026-09-23', 'HYROX Rome', 'Rome', 'Italy', 'HYROX', null, 'https://hyrox.com/event/hyrox-rome/'),
  ('2026-09-30', 'INTERSPORT HYROX Bordeaux', 'Bordeaux', 'France', 'HYROX', null, 'https://hyrox.com/event/hyrox-bordeaux-s26-27/'),
  ('2026-10-01', 'HYROX Karlsruhe', 'Karlsruhe', 'Germany', 'HYROX', null, 'https://hyrox.com/event/hyrox-karlsruhe/'),
  ('2026-10-08', 'HWPO HYROX Boston', 'Boston', 'United States', 'HYROX', null, 'https://hyrox.com/event/hwpo-hyrox-boston-26-27/'),
  ('2026-10-22', 'MyFitnessPal HYROX Tampa', 'Tampa', 'United States', 'HYROX', null, 'https://hyrox.com/event/hyrox-tampa/'),
  ('2026-10-27', 'HYROX Birmingham', 'Birmingham', 'United Kingdom', 'HYROX', null, 'https://hyrox.com/event/hyrox-birmingham/'),
  ('2026-10-28', 'INTERSPORT HYROX Hamburg', 'Hamburg', 'Germany', 'HYROX', null, 'https://hyrox.com/event/intersport-hyrox-hamburg/'),
  ('2026-11-11', 'EDEKA HYROX Düsseldorf', 'Düsseldorf', 'Germany', 'HYROX', null, 'https://hyrox.com/event/hyrox-dusseldorf/'),
  ('2026-11-18', 'HYROX Dallas', 'Dallas', 'United States', 'HYROX', null, 'https://usa.hyrox.com/events/hyrox-dallas-season-26-27-b0k8ev'),
  ('2026-12-02', 'HYROX London ExCel', 'London', 'United Kingdom', 'HYROX', null, 'https://hyrox.com/find-my-race/'),
  ('2026-09-27', 'BMW Berlin Marathon', 'Berlin', 'Germany', 'Running', null, 'https://www.bmw-berlin-marathon.com/'),
  ('2026-10-11', 'Bank of America Chicago Marathon', 'Chicago', 'United States', 'Running', null, 'https://www.chicagomarathon.com/'),
  ('2026-10-25', 'Valencia Half Marathon Trinidad Alfonso Zurich', 'Valencia', 'Spain', 'Running', null, 'https://www.valenciaciudaddelrunning.com/'),
  ('2026-11-01', 'TCS New York City Marathon', 'New York', 'United States', 'Running', null, 'https://www.tcsnycmarathon.org/'),
  ('2026-12-06', 'Valencia Marathon Trinidad Alfonso Zurich', 'Valencia', 'Spain', 'Running', null, 'https://www.valenciaciudaddelrunning.com/evento/maraton-valencia-2026/'),
  ('2026-09-25', 'Gymreapers Wodapalooza SoCal', 'Huntington Beach', 'United States', 'CrossFit', null, 'https://wodapalooza.com/'),
  ('2026-10-23', 'Rogue Invitational 2026', 'Aberdeen', 'United Kingdom', 'CrossFit', null, 'https://www.roguefitness.com/invitational'),
  ('2026-11-05', 'Wodapalooza Online Challenge & Qualifier', 'Online', null, 'CrossFit', null, 'https://wodapalooza.com/'),
  ('2026-12-10', 'World IBJJF Jiu-Jitsu No-Gi Championship 2026', 'Las Vegas', 'United States', 'Combat', 'BJJ', 'https://ibjjf.com/events/world-ibjjf-jiu-jitsu-no-gi-championship-2026'),
  ('2026-10-02', 'Athlos NYC', 'New York', 'United States', 'Athletics', null, 'https://worldathletics.org/competitions/world-athletics-continental-tour/calendar-results')
on conflict (starts_on) do update set
  name = excluded.name,
  city = excluded.city,
  country = excluded.country,
  sport = excluded.sport,
  combat_subtype = excluded.combat_subtype,
  official_url = excluded.official_url,
  og_image_url = case
    when public.official_events.official_url is distinct from excluded.official_url
    then null
    else public.official_events.og_image_url
  end,
  og_image_checked_at = case
    when public.official_events.official_url is distinct from excluded.official_url
    then null
    else public.official_events.og_image_checked_at
  end,
  venue = case
    when public.official_events.official_url is distinct from excluded.official_url
    then null
    else public.official_events.venue
  end,
  facts_checked_at = case
    when public.official_events.official_url is distinct from excluded.official_url
    then null
    else public.official_events.facts_checked_at
  end;

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

-- Close empty zones only. No reopen after T–48h. Held/won blocks close.
create or replace function public.zones_guard_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  event_date timestamptz;
begin
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  if NEW.status = 'closed' then
    if exists (
      select 1
      from public.bids b
      where b.zone_id = NEW.id
        and b.status in ('held', 'won')
    ) then
      raise exception 'Cannot close a zone that is held or won.';
    end if;
    return NEW;
  end if;

  if NEW.status = 'open' then
    select e.date into event_date
    from public.events e
    where e.id = NEW.event_id;
    if event_date is null then
      raise exception 'Event not found.';
    end if;
    if now() > event_date - interval '48 hours' then
      raise exception 'Cannot reopen after T–48h.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists zones_guard_status on public.zones;
create trigger zones_guard_status
  before update on public.zones
  for each row
  execute function public.zones_guard_status();

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
  polar_checkout_id text,
  polar_order_id text,
  status text not null default 'pending'
    check (status in ('pending', 'held', 'refunded', 'won', 'failed')),
  payable boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bids add column if not exists polar_checkout_id text;
alter table public.bids add column if not exists polar_order_id text;

create index if not exists bids_zone_status_idx on public.bids (zone_id, status);
create index if not exists bids_zone_created_idx on public.bids (zone_id, created_at desc);
create index if not exists bids_payment_idx on public.bids (dodo_payment_id);
create index if not exists bids_polar_checkout_idx on public.bids (polar_checkout_id);

alter table public.bids enable row level security;

drop policy if exists "bids_select" on public.bids;
create policy "bids_select"
  on public.bids for select
  to anon, authenticated
  using (true);

-- Client inserts: completed brand, live + open zone, pending only. No athletes, no drafts.
-- Held/won updates go through the service role.
drop policy if exists "bids_insert_brand" on public.bids;
create policy "bids_insert_brand"
  on public.bids for insert
  to authenticated
  with check (
    brand_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'brand'
        and p.name is not null
        and length(trim(p.name)) > 0
        and p.website is not null
        and length(trim(p.website)) > 0
        and p.brand_category in ('Drink', 'Apparel', 'Finance', 'Tech', 'Food', 'Other')
    )
    and exists (
      select 1
      from public.zones z
      join public.events e on e.id = z.event_id
      where z.id = zone_id
        and z.status = 'open'
        and e.status = 'live'
    )
  );

-- Client cannot write bids. Anon cannot insert. API + webhooks use the service role.
grant select on table public.bids to anon, authenticated;
revoke insert, update, delete on table public.bids from anon, authenticated;

-- Updates (held / refunded / won) go through the service role in webhooks.
-- Failed/refunded still land on a closed zone so checkout can unwind.
create or replace function public.bids_require_open_zone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.status not in ('pending', 'held', 'won') then
    return NEW;
  end if;
  if exists (
    select 1
    from public.zones z
    where z.id = NEW.zone_id
      and z.status = 'closed'
  ) then
    raise exception 'Zone is closed.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists bids_require_open_zone on public.bids;
create trigger bids_require_open_zone
  before insert or update on public.bids
  for each row
  execute function public.bids_require_open_zone();

-- ---------------------------------------------------------------------------
-- Captures / avatars / proofs / ledger
-- ---------------------------------------------------------------------------
-- Raw scan files in Storage bucket captures. status=uploaded means files landed.
-- Do not run photogrammetry here. Do not set avatars.ready from this table.
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  paths text[] not null default '{}',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.captures drop constraint if exists captures_status_check;
alter table public.captures add constraint captures_status_check
  check (status in ('pending', 'uploaded', 'processing', 'ready', 'failed'));

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

-- ---------------------------------------------------------------------------
-- No ready GLB → event stays draft
-- placeholder.glb does not count. Live cannot exist without avatars.ready + glb_url.
-- ---------------------------------------------------------------------------
create or replace function public.avatar_has_ready_glb(p_athlete_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.avatars a
    where a.athlete_id = p_athlete_id
      and a.ready is true
      and a.glb_url is not null
      and length(trim(a.glb_url)) > 0
      and position('placeholder.glb' in lower(a.glb_url)) = 0
  );
$$;

create or replace function public.events_keep_draft_without_glb()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.status = 'live' and not public.avatar_has_ready_glb(NEW.athlete_id) then
    NEW.status := 'draft';
  end if;
  return NEW;
end;
$$;

drop trigger if exists events_keep_draft_without_glb on public.events;
create trigger events_keep_draft_without_glb
  before insert or update on public.events
  for each row
  execute function public.events_keep_draft_without_glb();

create or replace function public.avatars_unpublish_without_glb()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    update public.events
    set status = 'draft'
    where athlete_id = OLD.athlete_id
      and status = 'live';
    return OLD;
  end if;
  if not public.avatar_has_ready_glb(NEW.athlete_id) then
    update public.events
    set status = 'draft'
    where athlete_id = NEW.athlete_id
      and status = 'live';
  end if;
  return NEW;
end;
$$;

drop trigger if exists avatars_unpublish_without_glb on public.avatars;
create trigger avatars_unpublish_without_glb
  after insert or update or delete on public.avatars
  for each row
  execute function public.avatars_unpublish_without_glb();

update public.events e
set status = 'draft'
where e.status = 'live'
  and not public.avatar_has_ready_glb(e.athlete_id);

create table if not exists public.proofs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  files text[] not null default '{}',
  post_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.proofs add column if not exists post_url text;

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

-- One send per bid (or proof) + event type. Service role only.
create table if not exists public.email_sends (
  event_type text not null,
  entity_id text not null,
  created_at timestamptz not null default now(),
  primary key (event_type, entity_id)
);

alter table public.email_sends enable row level security;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('captures', 'captures', false),
  ('avatars', 'avatars', true),
  -- Public brand marks. Occupied zone overlays read PNG files from here.
  ('logos', 'logos', true),
  ('photos', 'photos', true),
  ('proofs', 'proofs', false)
on conflict (id) do nothing;

drop policy if exists "storage_own_write" on storage.objects;
create policy "storage_own_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('captures', 'avatars', 'logos', 'photos', 'proofs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_own_update" on storage.objects;
create policy "storage_own_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('captures', 'avatars', 'logos', 'photos', 'proofs')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('captures', 'avatars', 'logos', 'photos', 'proofs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_public_read_avatars_logos" on storage.objects;
create policy "storage_public_read_avatars_logos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('avatars', 'logos', 'photos'));

drop policy if exists "storage_own_read_private" on storage.objects;
create policy "storage_own_read_private"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('captures', 'proofs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
