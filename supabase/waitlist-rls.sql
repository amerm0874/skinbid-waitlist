-- Paste this in Supabase: SQL Editor → New query → Run.
-- It lets the website add a waitlist row. It does not let visitors read other emails.

grant insert on table public.waitlist to anon;

drop policy if exists "anon can join waitlist" on public.waitlist;

create policy "anon can join waitlist"
on public.waitlist
for insert
to anon
with check (true);
