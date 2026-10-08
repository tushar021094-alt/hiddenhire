create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  recruiter_id uuid references public.profiles(id) on delete set null,
  queue text not null default 'none' check (queue in ('none','monitor','review','urgent')),
  priority integer not null default 0 check (priority between 0 and 100),
  decision text not null default 'allow' check (decision in ('allow','warn','restrict','escalate')),
  status text not null default 'open' check (status in ('open','under_review','resolved','appealed')),
  reasons jsonb not null default '[]'::jsonb,
  opened_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.moderation_cases enable row level security;
drop policy if exists moderation_cases_authenticated_select on public.moderation_cases;
create policy moderation_cases_authenticated_select on public.moderation_cases for select to authenticated using (true);
grant select on public.moderation_cases to authenticated;
grant select,insert,update,delete on public.moderation_cases to service_role;
create index if not exists moderation_cases_queue_idx on public.moderation_cases(queue,priority desc,status);
create index if not exists moderation_cases_job_idx on public.moderation_cases(job_id,status);

create or replace function private.refresh_moderation_case(target_job uuid)
returns void language plpgsql security definer set search_path=public,private as $$
declare s record; c record;
begin
 select * into s from public.job_safety_risk where job_id=target_job;
 if not found then return; end if;
 select id into c from public.moderation_cases where job_id=target_job and status in ('open','under_review','appealed') order by created_at desc limit 1;
 if s.action in ('restrict','escalate') or s.tier in ('high','critical') then
   if c.id is null then
     insert into public.moderation_cases(job_id,recruiter_id,queue,priority,decision,reasons)
     values(target_job,s.recruiter_id,case when s.tier='critical' or s.score>=75 then 'urgent' else 'review' end,greatest(s.score,case when s.tier='critical' then 85 else 50 end),s.action,coalesce(s.flags,'[]'::jsonb));
   else
     update public.moderation_cases set recruiter_id=s.recruiter_id,queue=case when s.tier='critical' or s.score>=75 then 'urgent' else 'review' end,priority=greatest(s.score,case when s.tier='critical' then 85 else 50 end),decision=s.action,reasons=coalesce(s.flags,'[]'::jsonb),updated_at=now() where id=c.id;
   end if;
 elsif c.id is not null and c.status='open' then
   update public.moderation_cases set queue='monitor',priority=s.score,decision='warn',updated_at=now() where id=c.id;
 end if;
end;
$$;
revoke all on function private.refresh_moderation_case(uuid) from public,anon,authenticated;

create or replace function private.refresh_moderation_case_from_safety()
returns trigger language plpgsql security definer set search_path=public,private as $$ begin perform private.refresh_moderation_case(new.job_id); return new; end; $$;
revoke all on function private.refresh_moderation_case_from_safety() from public,anon,authenticated;
drop trigger if exists safety_moderation_case_refresh on public.job_safety_risk;
create trigger safety_moderation_case_refresh after insert or update on public.job_safety_risk for each row execute function private.refresh_moderation_case_from_safety();

insert into public.moderation_cases(job_id,recruiter_id,queue,priority,decision,reasons)
select r.job_id,r.recruiter_id,case when r.tier='critical' then 'urgent' when r.tier='high' then 'review' else 'none' end,r.score,r.action,r.flags
from public.job_safety_risk r where r.action in ('restrict','escalate');