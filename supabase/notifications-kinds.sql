-- Transactional notice kinds. Run in the Supabase SQL editor if notifications already exists.
do $$
declare
  rec record;
begin
  for rec in
    select conname
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.notifications drop constraint %I', rec.conname);
  end loop;
end $$;

alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'bid_held',
    'bid_held_brand',
    'outbid',
    'won',
    'auction_won_athlete',
    'auction_won_brand',
    'proof_due',
    'proof_approved',
    'proof_rejected',
    'refund_done'
  ));
