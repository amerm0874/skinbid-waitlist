-- $50 3D model fee. Orbit upload after Whop payment.succeeded.
alter table public.captures add column if not exists model_paid boolean not null default false;
alter table public.captures add column if not exists whop_payment_id text;

create or replace function public.captures_lock_model_paid()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if auth.role() is distinct from 'service_role' then
      NEW.model_paid := false;
      NEW.whop_payment_id := null;
    end if;
    return NEW;
  end if;
  if auth.role() is distinct from 'service_role' then
    NEW.model_paid := OLD.model_paid;
    NEW.whop_payment_id := OLD.whop_payment_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists captures_lock_model_paid on public.captures;
create trigger captures_lock_model_paid
  before insert or update on public.captures
  for each row
  execute function public.captures_lock_model_paid();
