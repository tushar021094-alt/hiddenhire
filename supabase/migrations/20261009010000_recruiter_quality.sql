create table if not exists public.recruiter_quality (
  recruiter_id uuid primary key references public.profiles(id) on delete cascade,
  total_applications integer not null default 0,
  responded_applications integer not null default 0,
  response_rate integer not null default 0,
  overdue_applications integer not null default 0,
  reminded_applications integer not null default 0,
  median_first_response_hours numeric,
  responsiveness_score integer not null default 0,
  trust_tier text not null default 'new',
  repeated_non_response boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.recruiter_quality enable row level security;
drop policy if exists recruiter_quality_authenticated_select on public.recruiter_quality;
create policy recruiter_quality_authenticated_select on public.recruiter_quality for select to authenticated using (true);
create index if not exists recruiter_quality_score_idx on public.recruiter_quality (responsiveness_score desc);

create or replace function private.refresh_recruiter_quality(target_recruiter uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare total_count integer; responded_count integer; overdue_count integer; reminded_count integer; response_rate_value integer; median_hours_value numeric; score_value integer; tier_value text; repeated_value boolean;
begin
  select count(*)::integer, count(*) filter (where a.recruiter_first_response_at is not null)::integer,
    count(*) filter (where a.status not in ('rejected','withdrawn','hired') and a.recruiter_response_due_at is not null and a.recruiter_response_due_at < now())::integer,
    count(*) filter (where coalesce(a.candidate_reminder_count,0) > 0)::integer
  into total_count, responded_count, overdue_count, reminded_count
  from public.applications a join public.jobs j on j.id=a.job_id where j.posted_by=target_recruiter;
  select percentile_cont(0.5) within group (order by extract(epoch from (a.recruiter_first_response_at-a.created_at))/3600)
  into median_hours_value from public.applications a join public.jobs j on j.id=a.job_id
  where j.posted_by=target_recruiter and a.recruiter_first_response_at is not null;
  response_rate_value := case when total_count>0 then round(responded_count::numeric/total_count*100)::integer else 0 end;
  score_value := case when total_count=0 then 0 else greatest(0,least(100,round(response_rate_value*0.55 + case
    when median_hours_value is null then 50 when median_hours_value<=24 then 100 when median_hours_value<=72 then 85
    when median_hours_value<=120 then 70 when median_hours_value<=168 then 55 else 35 end*0.45
    - least(25,overdue_count::numeric/total_count*100)*0.35 - least(20,reminded_count::numeric/total_count*60)*0.15))) end;
  repeated_value := total_count>=5 and overdue_count>=2 and overdue_count::numeric/total_count>=0.25 and response_rate_value<70;
  tier_value := case when total_count<5 then 'new' when repeated_value then 'needs_attention' when score_value>=85 then 'highly_responsive' when score_value>=70 then 'responsive' else 'needs_attention' end;
  insert into public.recruiter_quality(recruiter_id,total_applications,responded_applications,response_rate,overdue_applications,reminded_applications,median_first_response_hours,responsiveness_score,trust_tier,repeated_non_response,updated_at)
  values(target_recruiter,total_count,responded_count,response_rate_value,overdue_count,reminded_count,median_hours_value,score_value,tier_value,repeated_value,now())
  on conflict(recruiter_id) do update set total_applications=excluded.total_applications,responded_applications=excluded.responded_applications,response_rate=excluded.response_rate,overdue_applications=excluded.overdue_applications,reminded_applications=excluded.reminded_applications,median_first_response_hours=excluded.median_first_response_hours,responsiveness_score=excluded.responsiveness_score,trust_tier=excluded.trust_tier,repeated_non_response=excluded.repeated_non_response,updated_at=excluded.updated_at;
end; $$;
revoke all on function private.refresh_recruiter_quality(uuid) from public,anon,authenticated;

create or replace function private.refresh_recruiter_quality_from_application()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare recruiter_id uuid;
begin
  select j.posted_by into recruiter_id from public.jobs j where j.id=coalesce(new.job_id,old.job_id);
  if recruiter_id is not null then perform private.refresh_recruiter_quality(recruiter_id); end if;
  return coalesce(new,old);
end; $$;
revoke all on function private.refresh_recruiter_quality_from_application() from public,anon,authenticated;
drop trigger if exists refresh_recruiter_quality_after_application on public.applications;
create trigger refresh_recruiter_quality_after_application after insert or update of status,candidate_reminder_count,recruiter_response_due_at,recruiter_first_response_at on public.applications for each row execute function private.refresh_recruiter_quality_from_application();