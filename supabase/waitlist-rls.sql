-- Paste this in Supabase: SQL Editor → New query → Run.
-- First query: see every saved email. Do not use Authentication → Users.

select email, name, role, instagram, fields, created_at
from public.waitlist
order by created_at desc;

-- It lets the website add a waitlist row. It does not let visitors read other emails.

grant insert on table public.waitlist to anon, authenticated;

drop policy if exists "anon can join waitlist" on public.waitlist;

create policy "anon can join waitlist"
on public.waitlist
for insert
to anon
with check (true);

-- Keep the newest row per email, then lock the table to one row each.
delete from public.waitlist as older
using public.waitlist as newer
where older.email = newer.email
  and (
    older.created_at < newer.created_at
    or (older.created_at = newer.created_at and older.id < newer.id)
  );

create unique index if not exists waitlist_email_idx on public.waitlist (email);
