-- Paste in Supabase → SQL editor, then Run.
-- In-app notices. Service role inserts; the signed-in user reads and marks read.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('bid_held', 'outbid', 'won', 'proof_approved', 'proof_rejected')),
  title text not null,
  body text not null default '',
  href text not null
    check (href ~ '^/(e|proof)/'),
  entity_id text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, entity_id)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on public.notifications to authenticated;
revoke insert, delete on public.notifications from anon, authenticated;
