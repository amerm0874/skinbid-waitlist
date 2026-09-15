-- Run after schema.sql and athlete-zone-rects.sql. No existing media is replaced.
begin;
create table if not exists public.athlete_media (
  athlete_id uuid primary key references public.profiles(id) on delete cascade,
  original_front text, original_back text, video_path text,
  video_shared boolean not null default false,
  candidate_front text, candidate_back text,
  approved_front text, approved_back text,
  state text not null default 'draft' check (state in ('draft','processing','review','approved','failed')),
  job_id uuid, error text, consent_at timestamptz,
  approved_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.athlete_media_jobs (
  id uuid primary key,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  model text not null, prompt_version text not null default 'skinbid-studio-v2',
  original_front text not null, original_back text not null,
  output_front text, output_back text, usage_front jsonb, usage_back jsonb,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  error text, created_at timestamptz not null default now(), finished_at timestamptz
);
create index if not exists athlete_media_jobs_owner_time on public.athlete_media_jobs(athlete_id, created_at desc);
alter table public.athlete_media enable row level security;
alter table public.athlete_media_jobs enable row level security;
-- Only server-side service role may mutate. A user cannot approve their own row via REST.
revoke all on public.athlete_media, public.athlete_media_jobs from anon, authenticated;
grant select on public.athlete_media, public.athlete_media_jobs to authenticated;
grant all on public.athlete_media, public.athlete_media_jobs to service_role;
drop policy if exists media_owner_read on public.athlete_media;
create policy media_owner_read on public.athlete_media for select to authenticated using (athlete_id = auth.uid());
drop policy if exists media_jobs_owner_read on public.athlete_media_jobs;
create policy media_jobs_owner_read on public.athlete_media_jobs for select to authenticated using (athlete_id = auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('athlete-media','athlete-media',false,8388608,array['image/jpeg','image/png']),
 ('athlete-videos','athlete-videos',false,41943040,array['video/mp4','video/webm'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
-- No direct browser policies: uploads require an authenticated server-issued token.

create or replace function public.claim_athlete_media(p_athlete_id uuid, p_job_id uuid, p_model text)
returns public.athlete_media language plpgsql security definer set search_path=public as $$
declare media public.athlete_media;
begin
 select * into media from public.athlete_media where athlete_id=p_athlete_id for update;
 if not found or media.original_front is null or media.original_back is null or media.video_path is null or not media.video_shared then
   raise exception 'Add both photos and your introduction video first.';
 end if;
 if media.state='processing' and media.updated_at > now()-interval '6 minutes' then
   raise exception 'Your photos are already being prepared.';
 end if;
 if (select count(*) from public.athlete_media_jobs where athlete_id=p_athlete_id and created_at>now()-interval '24 hours') >= 2 then
   raise exception 'You have used today''s two photo preparations. Try again tomorrow.';
 end if;
 insert into public.athlete_media_jobs(id,athlete_id,model,original_front,original_back)
 values(p_job_id,p_athlete_id,p_model,media.original_front,media.original_back);
 update public.athlete_media set state='processing',job_id=p_job_id,error=null,candidate_front=null,candidate_back=null,consent_at=now(),updated_at=now()
 where athlete_id=p_athlete_id returning * into media;
 return media;
end $$;

create or replace function public.approve_athlete_media(p_athlete_id uuid, p_job_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare media public.athlete_media;
begin
 -- Serialize with race creation/updates before invalidating placement geometry.
 lock table public.events in share row exclusive mode;
 select * into media from public.athlete_media where athlete_id=p_athlete_id for update;
 if not found or media.job_id is distinct from p_job_id or media.state<>'review' or media.candidate_front is null or media.candidate_back is null then
   raise exception 'These photos are not ready for approval. Refresh and try again.';
 end if;
 if exists(select 1 from public.events where athlete_id=p_athlete_id and status in ('live','closed')) then
   raise exception 'Your current race photos are locked. Finish the active race before replacing them.';
 end if;
 update public.athlete_media set approved_front=candidate_front,approved_back=candidate_back,state='approved',approved_at=now(),updated_at=now()
 where athlete_id=p_athlete_id;
 -- Never reuse coordinates after the photo changes. Existing source files/jobs remain recoverable.
 delete from public.athlete_zone_rects where athlete_id=p_athlete_id;
end $$;
revoke all on function public.claim_athlete_media(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.approve_athlete_media(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_athlete_media(uuid,uuid,text) to service_role;
grant execute on function public.approve_athlete_media(uuid,uuid) to service_role;

-- Photo coordinates are athlete-wide. Serialize geometry writes with bid writes
-- so the HTTP precheck cannot race a new checkout or a payment webhook.
create or replace function public.lock_sponsored_geometry()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
 if tg_table_name='athlete_zone_rects' then
   owner_id := case when tg_op='DELETE' then old.athlete_id else new.athlete_id end;
 else
   select e.athlete_id into owner_id from public.zones z join public.events e on e.id=z.event_id where z.id=new.zone_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
 if tg_table_name='athlete_zone_rects' then
   if tg_op='UPDATE' then
     if new.athlete_id is distinct from old.athlete_id or new.zone_name is distinct from old.zone_name then
       raise exception 'A placement owner and name cannot be changed.';
     end if;
   end if;
   if exists (
   select 1 from public.bids b join public.zones z on z.id=b.zone_id join public.events e on e.id=z.event_id
   where e.athlete_id=owner_id and e.status in ('draft','live','closed')
   and z.name=(case when tg_op='DELETE' then old.zone_name else new.zone_name end)
   and b.status in ('pending','held','won')
 ) then raise exception 'This placement has a paid or pending bid. Its position is locked for this race.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists sponsored_geometry_lock on public.athlete_zone_rects;
create trigger sponsored_geometry_lock before insert or update or delete on public.athlete_zone_rects for each row execute function public.lock_sponsored_geometry();
drop trigger if exists sponsorship_bid_geometry_lock on public.bids;
create trigger sponsorship_bid_geometry_lock before insert or update on public.bids for each row execute function public.lock_sponsored_geometry();
revoke all on function public.lock_sponsored_geometry() from public,anon,authenticated;
commit;
