-- Midline belly pad. Run in the Supabase SQL editor if insert of name = 'abs' is rejected.
alter table public.zones drop constraint if exists zones_name_check;
alter table public.zones add constraint zones_name_check check (name in (
  'chest_l','chest_r','abs','shoulder_l','shoulder_r',
  'bicep_l','bicep_r','forearm_l','forearm_r',
  'back_l','back_r','thigh_l','thigh_r'
));

insert into public.zones (event_id, name, status)
select e.id, 'abs', 'open'
from public.events e
where e.slug = 'mohamed-test'
on conflict (event_id, name) do update set status = 'open';
