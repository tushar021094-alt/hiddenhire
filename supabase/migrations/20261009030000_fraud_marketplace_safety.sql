create table if not exists public.job_safety_risk (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  recruiter_id uuid references public.profiles(id) on delete set null,
  score integer not null default 0,
  tier text not null default 'low' check (tier in ('low','guarded','high','critical')),
  action text not null default 'allow' check (action in ('allow','warn','restrict','escalate')),
  flags jsonb not null default '[]'::jsonb,
  signals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.job_safety_risk enable row level security;
drop policy if exists job_safety_risk_authenticated_select on public.job_safety_risk;
create policy job_safety_risk_authenticated_select on public.job_safety_risk for select to authenticated using (true);
grant select on public.job_safety_risk to authenticated;
grant select, insert, update, delete on public.job_safety_risk to service_role;
create index if not exists job_safety_risk_score_idx on public.job_safety_risk (score desc);
create index if not exists job_safety_risk_tier_idx on public.job_safety_risk (tier);
create index if not exists job_safety_risk_recruiter_idx on public.job_safety_risk (recruiter_id, tier);

create or replace function private.refresh_job_safety_risk(target_job uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare j record; a record; rq record;
report_count integer := 0; moderation_count integer := 0; duplicate_count integer := 0;
suspicious boolean := false; score integer := 0;
flags jsonb := '[]'::jsonb; signals jsonb := '[]'::jsonb;
tier text := 'low'; risk_action text := 'allow';
begin
select id,posted_by,company_id,title,description,location into j from public.jobs where id=target_job;
if not found then delete from public.job_safety_risk where job_id=target_job; return; end if;
select * into a from public.job_authenticity where job_id=target_job;
select * into rq from public.recruiter_quality where recruiter_id=j.posted_by;
select count(*) into report_count from public.reports where job_id=target_job;
select count(*) into moderation_count from public.moderation_events where job_id=target_job and action in ('reject','suspend','flag','escalate');
select count(*) into duplicate_count from public.jobs other where other.id<>target_job and other.status='published'
and other.company_id=j.company_id and j.company_id is not null
and lower(regexp_replace(coalesce(other.title,''),'\\s+','','g'))=lower(regexp_replace(coalesce(j.title,''),'\\s+','','g'))
and lower(coalesce(other.location,''))=lower(coalesce(j.location,''));
suspicious := lower(coalesce(j.description,'')) ~ '(registration[[:space:]]+fee|pay[[:space:]]+(a[[:space:]]+)?fee|security[[:space:]]+deposit|whatsapp[[:space:]]+only|telegram[[:space:]]+only|guaranteed[[:space:]]+(job|placement)|crypto(currency)?[[:space:]]+(payment|deposit)|buy[[:space:]]+(a[[:space:]]+)?course)';
if coalesce(a.score,50)<52 then score:=score+30; elsif coalesce(a.score,50)<72 then score:=score+12; end if;
if report_count>0 then score:=score+least(30,report_count*12); flags:=flags||jsonb_build_array(report_count::text||' candidate report'||case when report_count=1 then '' else 's' end); end if;
if moderation_count>0 then score:=score+least(30,moderation_count*18); flags:=flags||jsonb_build_array('moderation history detected'); end if;
if duplicate_count>=3 then score:=score+least(18,6+((duplicate_count-3)*4)); flags:=flags||jsonb_build_array('repeated or duplicate posting pattern'); end if;
if suspicious then score:=score+35; flags:=flags||jsonb_build_array('suspicious payment or contact language'); end if;
if coalesce(rq.repeated_non_response,false) then score:=score+12; flags:=flags||jsonb_build_array('repeated recruiter non-response'); end if;
if coalesce(rq.trust_score,50)<50 then score:=score+12; signals:=signals||jsonb_build_array('recruiter trust history is limited');
elsif coalesce(rq.trust_score,50)>=85 then score:=score-8; signals:=signals||jsonb_build_array('recruiter trust history is strong'); end if;
if not coalesce(rq.identity_verified,false) then score:=score+3; signals:=signals||jsonb_build_array('recruiter identity is not verified'); end if;
if not coalesce(rq.company_verified,false) then score:=score+3; signals:=signals||jsonb_build_array('company is not verified'); end if;
score:=greatest(0,least(100,score));
if score>=75 then tier:='critical'; risk_action:='escalate'; elsif score>=50 then tier:='high'; risk_action:='restrict'; elsif score>=25 then tier:='guarded'; risk_action:='warn'; else tier:='low'; risk_action:='allow'; end if;
insert into public.job_safety_risk(job_id,recruiter_id,score,tier,action,flags,signals,updated_at)
values(target_job,j.posted_by,score,tier,risk_action,flags,signals,now())
on conflict(job_id) do update set recruiter_id=excluded.recruiter_id,score=excluded.score,tier=excluded.tier,action=excluded.action,flags=excluded.flags,signals=excluded.signals,updated_at=now();
end; $$;
revoke all on function private.refresh_job_safety_risk(uuid) from public,anon,authenticated;

create or replace function private.refresh_job_safety_from_job()
returns trigger language plpgsql security definer set search_path=public,private as $$ begin perform private.refresh_job_safety_risk(new.id); return new; end; $$;
revoke all on function private.refresh_job_safety_from_job() from public,anon,authenticated;
drop trigger if exists job_safety_refresh on public.jobs;
create trigger job_safety_refresh after insert or update of company_id,posted_by,title,description,location,status on public.jobs for each row execute function private.refresh_job_safety_from_job();

create or replace function private.refresh_job_safety_from_authenticity()
returns trigger language plpgsql security definer set search_path=public,private as $$ begin perform private.refresh_job_safety_risk(new.job_id); return new; end; $$;
revoke all on function private.refresh_job_safety_from_authenticity() from public,anon,authenticated;
drop trigger if exists authenticity_safety_refresh on public.job_authenticity;
create trigger authenticity_safety_refresh after insert or update on public.job_authenticity for each row execute function private.refresh_job_safety_from_authenticity();

create or replace function private.refresh_job_safety_from_application_quality()
returns trigger language plpgsql security definer set search_path=public,private as $$
declare job_row record; begin for job_row in select id from public.jobs where posted_by=new.recruiter_id loop perform private.refresh_job_safety_risk(job_row.id); end loop; return new; end; $$;
revoke all on function private.refresh_job_safety_from_application_quality() from public,anon,authenticated;
drop trigger if exists recruiter_quality_safety_refresh on public.recruiter_quality;
create trigger recruiter_quality_safety_refresh after insert or update on public.recruiter_quality for each row execute function private.refresh_job_safety_from_application_quality();

create or replace function private.refresh_job_safety_from_report()
returns trigger language plpgsql security definer set search_path=public,private as $$ begin if new.job_id is not null then perform private.refresh_job_safety_risk(new.job_id); end if; return new; end; $$;
revoke all on function private.refresh_job_safety_from_report() from public,anon,authenticated;
drop trigger if exists report_safety_refresh on public.reports;
create trigger report_safety_refresh after insert or update of status,reason on public.reports for each row execute function private.refresh_job_safety_from_report();

create or replace function private.refresh_job_safety_from_moderation()
returns trigger language plpgsql security definer set search_path=public,private as $$ begin if new.job_id is not null then perform private.refresh_job_safety_risk(new.job_id); end if; return new; end; $$;
revoke all on function private.refresh_job_safety_from_moderation() from public,anon,authenticated;
drop trigger if exists moderation_safety_refresh on public.moderation_events;
create trigger moderation_safety_refresh after insert or update of action,reason on public.moderation_events for each row execute function private.refresh_job_safety_from_moderation();

insert into public.job_safety_risk(job_id,recruiter_id) select id,posted_by from public.jobs on conflict(job_id) do nothing;
do $$ declare job_row record; begin for job_row in select id from public.jobs loop perform private.refresh_job_safety_risk(job_row.id); end loop; end $$;