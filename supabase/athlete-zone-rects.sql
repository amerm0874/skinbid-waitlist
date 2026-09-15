-- Paste this in Supabase: SQL Editor → New query → Run.
-- Athlete-drawn slot boxes (percent of front/back photo). Brand pages only read these.

create table if not exists public.athlete_zone_rects (
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  zone_name text not null check (zone_name in (
    'chest_l','chest_r','abs','shoulder_l','shoulder_r',
    'bicep_l','bicep_r','forearm_l','forearm_r',
    'back_l','back_r','thigh_l','thigh_r'
  )),
  x numeric not null,
  y numeric not null,
  w numeric not null,
  h numeric not null,
  primary key (athlete_id, zone_name)
);

alter table public.athlete_zone_rects enable row level security;

drop policy if exists "athlete_zone_rects_select" on public.athlete_zone_rects;
create policy "athlete_zone_rects_select"
  on public.athlete_zone_rects for select
  to anon, authenticated
  using (true);

drop policy if exists "athlete_zone_rects_write_own" on public.athlete_zone_rects;
create policy "athlete_zone_rects_write_own"
  on public.athlete_zone_rects for all
  to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

-- Hide Shoulder L / Shoulder R on mohamed-test. Keep the zone rows.
update public.zones z
set status = 'closed'
from public.events e
where z.event_id = e.id
  and e.slug = 'mohamed-test'
  and z.name in ('shoulder_l', 'shoulder_r');
