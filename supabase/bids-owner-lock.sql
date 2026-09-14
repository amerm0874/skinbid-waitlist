-- Paste in Supabase → SQL editor, then Run.
-- Event owner cannot insert a bid on their own zones.

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
        and e.athlete_id <> auth.uid()
    )
  );
