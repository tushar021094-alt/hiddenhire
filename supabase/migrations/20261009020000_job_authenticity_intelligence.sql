create table if not exists public.job_authenticity (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  score integer not null default 0,
  tier text not null default 'review' check (tier in ('verified','likely_authentic','review','caution')),
  verified_job boolean not null default false,
  verified_company boolean not null default false,
  verified_recruiter boolean not null default false,
  source_verified boolean not null default false,
  duplicate_count integer not null default 0,
  report_count integer not null default 0,
  moderation_issue_count integer not null default 0,
  flags jsonb not null default '[]'::jsonb,
  signals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.job_authenticity enable row level security;

drop policy if exists job_authenticity_authenticated_select on public.job_authenticity;
create policy job_authenticity_authenticated_select
on public.job_authenticity
for select to authenticated
using (true);

grant select on public.job_authenticity to authenticated;
grant select, insert, update, delete on public.job_authenticity to service_role;

create index if not exists job_authenticity_score_idx on public.job_authenticity (score desc);
create index if not exists job_authenticity_tier_idx on public.job_authenticity (tier);

create or replace function private.refresh_job_authenticity(target_job uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  j record;
  company_verified boolean := false;
  recruiter_verified boolean := false;
  source_verified boolean := false;
  duplicate_count integer := 0;
  report_count integer := 0;
  moderation_issue_count integer := 0;
  score integer := 50;
  flags jsonb := '[]'::jsonb;
  signals jsonb := '[]'::jsonb;
  tier text := 'review';
  verified_job boolean := false;
  suspicious boolean := false;
begin
  select jobs.id, jobs.company_id, jobs.posted_by, jobs.source_type, jobs.title,
         jobs.description, jobs.salary_min, jobs.salary_max, jobs.location,
         companies.website, companies.verification_status
  into j
  from public.jobs
  left join public.companies on companies.id = jobs.company_id
  where jobs.id = target_job;

  if not found then
    delete from public.job_authenticity where job_id = target_job;
    return;
  end if;

  company_verified := coalesce(j.verification_status = 'verified', false);
  recruiter_verified := exists (
    select 1 from public.verification_records vr
    where vr.profile_id = j.posted_by
      and vr.verification_type = 'recruiter_verification'
      and vr.status = 'approved'
  ) or exists (
    select 1 from public.employer_profiles ep
    where ep.profile_id = j.posted_by and ep.recruiter_verified = true
  );
  source_verified := lower(coalesce(j.source_type, '')) in
    ('greenhouse','lever','ashby','workable','careerpage','companydiscovery','native');

  select count(*) into duplicate_count
  from public.jobs other
  where other.id <> j.id and other.status = 'published'
    and other.company_id = j.company_id and j.company_id is not null
    and lower(regexp_replace(coalesce(other.title,''), '\\s+', '', 'g')) =
        lower(regexp_replace(coalesce(j.title,''), '\\s+', '', 'g'))
    and lower(coalesce(other.location,'')) = lower(coalesce(j.location,''));

  select count(*) into report_count from public.reports r where r.job_id = j.id;
  select count(*) into moderation_issue_count
  from public.moderation_events me
  where me.job_id = j.id and me.action in ('reject','suspend','flag','escalate');

  if source_verified then score := score + 20; signals := signals || jsonb_build_array('trusted job source'); end if;
  if company_verified then score := score + 18; signals := signals || jsonb_build_array('company verified'); end if;
  if recruiter_verified then score := score + 12; signals := signals || jsonb_build_array('recruiter verified'); end if;

  if nullif(trim(coalesce(j.website,'')), '') is not null then
    score := score + 5; signals := signals || jsonb_build_array('company website available');
  elsif lower(coalesce(j.source_type,'')) = 'native' then
    score := score - 5; flags := flags || jsonb_build_array('company website not provided');
  end if;

  if nullif(trim(coalesce(j.title,'')), '') is null then
    score := score - 15; flags := flags || jsonb_build_array('job title is missing');
  end if;

  if lower(coalesce(j.source_type,'')) <> 'native' and nullif(trim(coalesce(j.location,'')), '') is null then
    score := score - 10; flags := flags || jsonb_build_array('job location is incomplete');
  end if;

  if length(trim(coalesce(j.description,''))) < 180 then
    score := score - 8; flags := flags || jsonb_build_array('job description is unusually short');
  end if;

  if j.salary_min is not null and j.salary_max is not null and j.salary_min > j.salary_max then
    score := score - 18; flags := flags || jsonb_build_array('salary range is inconsistent');
  end if;

  if duplicate_count >= 3 then
    score := score - least(18, 6 + ((duplicate_count - 3) * 3));
    flags := flags || jsonb_build_array('similar posting pattern detected');
  end if;

  if report_count > 0 then
    score := score - least(25, report_count * 10);
    flags := flags || jsonb_build_array(report_count::text || ' candidate report' || case when report_count = 1 then '' else 's' end);
  end if;

  if moderation_issue_count > 0 then
    score := score - least(30, moderation_issue_count * 15);
    flags := flags || jsonb_build_array('moderation history requires review');
  end if;

  suspicious := lower(coalesce(j.description,'')) ~
    '(registration[[:space:]]+fee|pay[[:space:]]+(a[[:space:]]+)?fee|security[[:space:]]+deposit|whatsapp[[:space:]]+only|telegram[[:space:]]+only|guaranteed[[:space:]]+(job|placement)|crypto(currency)?[[:space:]]+(payment|deposit)|buy[[:space:]]+(a[[:space:]]+)?course)';
  if suspicious then
    score := score - 30; flags := flags || jsonb_build_array('suspicious payment or contact language');
  end if;

  score := greatest(0, least(100, score));

  if score >= 85 and
     ((company_verified and recruiter_verified) or (source_verified and nullif(trim(coalesce(j.website,'')), '') is not null))
     and jsonb_array_length(flags) = 0 then
    verified_job := true; tier := 'verified';
  elsif score >= 72 then
    tier := 'likely_authentic'; signals := signals || jsonb_build_array('no major authenticity conflict detected');
  elsif score >= 52 then
    tier := 'review'; signals := signals || jsonb_build_array('additional verification recommended');
  else
    tier := 'caution'; signals := signals || jsonb_build_array('candidate caution recommended');
  end if;

  insert into public.job_authenticity
    (job_id, score, tier, verified_job, verified_company, verified_recruiter, source_verified,
     duplicate_count, report_count, moderation_issue_count, flags, signals, updated_at)
  values
    (j.id, score, tier, verified_job, company_verified, recruiter_verified, source_verified,
     duplicate_count, report_count, moderation_issue_count, flags, signals, now())
  on conflict (job_id) do update set
    score=excluded.score, tier=excluded.tier, verified_job=excluded.verified_job,
    verified_company=excluded.verified_company, verified_recruiter=excluded.verified_recruiter,
    source_verified=excluded.source_verified, duplicate_count=excluded.duplicate_count,
    report_count=excluded.report_count, moderation_issue_count=excluded.moderation_issue_count,
    flags=excluded.flags, signals=excluded.signals, updated_at=now();
end;
$$;

revoke all on function private.refresh_job_authenticity(uuid) from public, anon, authenticated;

create or replace function private.refresh_job_authenticity_from_job()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin perform private.refresh_job_authenticity(new.id); return new; end;
$$;

revoke all on function private.refresh_job_authenticity_from_job() from public, anon, authenticated;

drop trigger if exists job_authenticity_refresh on public.jobs;
create trigger job_authenticity_refresh
after insert or update of company_id, posted_by, source_type, title, description, salary_min, salary_max, status, location
on public.jobs for each row execute function private.refresh_job_authenticity_from_job();

create or replace function private.refresh_job_authenticity_from_company()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare job_row record;
begin
  for job_row in select id from public.jobs where company_id = new.id loop
    perform private.refresh_job_authenticity(job_row.id);
  end loop;
  return new;
end;
$$;

revoke all on function private.refresh_job_authenticity_from_company() from public, anon, authenticated;

drop trigger if exists company_authenticity_refresh on public.companies;
create trigger company_authenticity_refresh
after update of verification_status, website on public.companies
for each row execute function private.refresh_job_authenticity_from_company();

create or replace function private.refresh_job_authenticity_from_verification()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare job_row record;
begin
  if new.profile_id is not null then
    for job_row in select id from public.jobs where posted_by = new.profile_id loop
      perform private.refresh_job_authenticity(job_row.id);
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function private.refresh_job_authenticity_from_verification() from public, anon, authenticated;

drop trigger if exists verification_authenticity_refresh on public.verification_records;
create trigger verification_authenticity_refresh
after insert or update of status on public.verification_records
for each row execute function private.refresh_job_authenticity_from_verification();

create or replace function private.refresh_job_authenticity_from_report()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.job_id is not null then perform private.refresh_job_authenticity(new.job_id); end if;
  return new;
end;
$$;

revoke all on function private.refresh_job_authenticity_from_report() from public, anon, authenticated;

drop trigger if exists report_authenticity_refresh on public.reports;
create trigger report_authenticity_refresh
after insert or update of status, reason on public.reports
for each row execute function private.refresh_job_authenticity_from_report();

create or replace function private.refresh_job_authenticity_from_moderation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.job_id is not null then perform private.refresh_job_authenticity(new.job_id); end if;
  return new;
end;
$$;

revoke all on function private.refresh_job_authenticity_from_moderation() from public, anon, authenticated;

drop trigger if exists moderation_authenticity_refresh on public.moderation_events;
create trigger moderation_authenticity_refresh
after insert or update of action, reason on public.moderation_events
for each row execute function private.refresh_job_authenticity_from_moderation();

insert into public.job_authenticity (job_id)
select id from public.jobs
on conflict (job_id) do nothing;

do $$
declare job_row record;
begin
  for job_row in select id from public.jobs loop
    perform private.refresh_job_authenticity(job_row.id);
  end loop;
end;
$$;
