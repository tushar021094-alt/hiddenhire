-- HiddenHire security foundation: identity provisioning, RLS, and safe recruiter discovery.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  validated_role text;
begin
  validated_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'candidate'));
  if validated_role not in ('candidate', 'employer', 'agency') then
    validated_role := 'candidate';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    validated_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_hiddenhire on auth.users;
create trigger on_auth_user_created_hiddenhire
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- One-time, idempotent backfill. Existing profile rows are preserved.
insert into public.profiles (id, email, full_name, role)
select
  auth_user.id,
  auth_user.email,
  nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
  case
    when lower(coalesce(auth_user.raw_user_meta_data ->> 'role', 'candidate')) in ('candidate', 'employer', 'agency')
      then lower(auth_user.raw_user_meta_data ->> 'role')
    else 'candidate'
  end
from auth.users as auth_user
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.agency_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.company_sources enable row level security;
alter table public.applications enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.matches enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.contact_unlocks enable row level security;
alter table public.verification_records enable row level security;
alter table public.moderation_events enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

revoke all on table
  public.profiles,
  public.candidate_profiles,
  public.employer_profiles,
  public.agency_profiles,
  public.companies,
  public.jobs,
  public.company_sources,
  public.applications,
  public.saved_jobs,
  public.matches,
  public.plans,
  public.subscriptions,
  public.entitlements,
  public.credit_ledger,
  public.contact_unlocks,
  public.verification_records,
  public.moderation_events,
  public.reports,
  public.notifications,
  public.audit_events
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, skills, experience_years, location, country, remote_only, min_salary, salary_currency, visibility) on public.profiles to authenticated;

grant select, insert, update (resume_url, job_search_mode, headline, target_roles, preferred_locations) on public.candidate_profiles to authenticated;
grant insert (profile_id, resume_url, job_search_mode, headline, target_roles, preferred_locations) on public.candidate_profiles to authenticated;

grant select, insert (profile_id, company_id, designation), update (company_id, designation) on public.employer_profiles to authenticated;
grant select, insert (profile_id, agency_name), update (agency_name) on public.agency_profiles to authenticated;

grant select, insert (name, website, email_domain, country, description, created_by), update (name, website, email_domain, country, description) on public.companies to authenticated;
grant select on public.jobs to anon, authenticated;
grant select, insert (job_id, candidate_id, status), update (status) on public.applications to authenticated;
grant select, insert (profile_id, external_job_id, job_id, source, job_url, score, status), update (status) on public.saved_jobs to authenticated;
grant select on public.matches to authenticated;
grant select on public.plans to anon, authenticated;
grant select on public.subscriptions, public.entitlements, public.credit_ledger, public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists candidate_profiles_manage_own on public.candidate_profiles;
create policy candidate_profiles_manage_own on public.candidate_profiles
  for all to authenticated
  using (
    profile_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'candidate')
  )
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'candidate')
  );

drop policy if exists employer_profiles_manage_own on public.employer_profiles;
create policy employer_profiles_manage_own on public.employer_profiles
  for all to authenticated
  using (
    profile_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'employer'
    )
  )
  with check (
    profile_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'employer'
    )
  );

drop policy if exists agency_profiles_manage_own on public.agency_profiles;
create policy agency_profiles_manage_own on public.agency_profiles
  for all to authenticated
  using (
    profile_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'agency')
  )
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'agency')
  );

drop policy if exists companies_select_owned on public.companies;
create policy companies_select_owned on public.companies
  for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.employer_profiles
      where employer_profiles.profile_id = auth.uid()
        and employer_profiles.company_id = companies.id
    )
  );

drop policy if exists companies_insert_employer_or_agency on public.companies;
create policy companies_insert_employer_or_agency on public.companies
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('employer', 'agency')
    )
  );

drop policy if exists companies_update_owned on public.companies;
create policy companies_update_owned on public.companies
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists jobs_select_published_or_owned on public.jobs;
create policy jobs_select_published_or_owned on public.jobs
  for select to anon, authenticated
  using (status = 'published' or posted_by = auth.uid());

drop policy if exists applications_select_candidate_or_job_owner on public.applications;
create policy applications_select_candidate_or_job_owner on public.applications
  for select to authenticated
  using (
    candidate_id = auth.uid()
    or exists (select 1 from public.jobs where jobs.id = applications.job_id and jobs.posted_by = auth.uid())
  );

drop policy if exists applications_insert_own_candidate on public.applications;
create policy applications_insert_own_candidate on public.applications
  for insert to authenticated
  with check (
    candidate_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'candidate')
    and exists (select 1 from public.jobs where jobs.id = job_id and jobs.status = 'published')
  );

drop policy if exists applications_update_own_candidate_withdrawal on public.applications;
create policy applications_update_own_candidate_withdrawal on public.applications
  for update to authenticated
  using (candidate_id = auth.uid())
  with check (candidate_id = auth.uid() and status = 'withdrawn');

drop policy if exists applications_update_job_owner on public.applications;
create policy applications_update_job_owner on public.applications
  for update to authenticated
  using (exists (select 1 from public.jobs where jobs.id = applications.job_id and jobs.posted_by = auth.uid()))
  with check (exists (select 1 from public.jobs where jobs.id = applications.job_id and jobs.posted_by = auth.uid()));

drop policy if exists saved_jobs_manage_own on public.saved_jobs;
create policy saved_jobs_manage_own on public.saved_jobs
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists matches_select_candidate_or_job_owner on public.matches;
create policy matches_select_candidate_or_job_owner on public.matches
  for select to authenticated
  using (
    candidate_id = auth.uid()
    or exists (select 1 from public.jobs where jobs.id = matches.job_id and jobs.posted_by = auth.uid())
  );

drop policy if exists plans_select_active on public.plans;
create policy plans_select_active on public.plans
  for select to anon, authenticated using (active = true);

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own on public.entitlements
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists credit_ledger_select_own on public.credit_ledger;
create policy credit_ledger_select_own on public.credit_ledger
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create or replace function public.recruiter_candidate_discovery_for_job(p_job_id uuid)
returns table (
  candidate_id uuid,
  display_name text,
  headline text,
  target_roles text[],
  skills text[],
  experience_years numeric,
  location text,
  country text,
  remote_only boolean,
  min_salary numeric,
  salary_currency text,
  preferred_locations text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  result_limit integer := 10;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select profile.role into actor_role
  from public.profiles as profile
  where profile.id = actor_id;

  if actor_role not in ('employer', 'agency') then
    raise exception using errcode = '42501', message = 'Employer or agency access is required.';
  end if;

  if not exists (
    select 1 from public.jobs as job
    where job.id = p_job_id
      and job.posted_by = actor_id
      and job.source_type = 'native'
      and job.status = 'published'
  ) then
    raise exception using errcode = '42501', message = 'You are not authorized to discover candidates for this job.';
  end if;

  -- Future entitlement consumption belongs at this authorization boundary.
  select coalesce(max(entitlement.limit_value), 10)::integer into result_limit
  from public.entitlements as entitlement
  where entitlement.profile_id = actor_id
    and entitlement.key = 'ai_matches'
    and (entitlement.period_start is null or entitlement.period_start <= now())
    and (entitlement.period_end is null or entitlement.period_end > now());

  return query
  select
    profile.id as candidate_id,
    case
      when nullif(trim(profile.full_name), '') is null then 'Candidate'
      when position(' ' in trim(profile.full_name)) = 0 then trim(profile.full_name)
      else split_part(trim(profile.full_name), ' ', 1)
        || ' ' || left(split_part(trim(profile.full_name), ' ', 2), 1) || '.'
    end as display_name,
    candidate.headline,
    candidate.target_roles,
    profile.skills,
    profile.experience_years,
    profile.location,
    profile.country,
    profile.remote_only,
    profile.min_salary,
    profile.salary_currency,
    candidate.preferred_locations
  from public.profiles as profile
  join public.candidate_profiles as candidate on candidate.profile_id = profile.id
  where profile.role = 'candidate'
    and profile.visibility in ('public', 'match_only')
    and candidate.job_search_mode in ('active', 'passive')
  order by profile.updated_at desc
  limit greatest(result_limit, 0);
end;
$$;

revoke all on function public.recruiter_candidate_discovery_for_job(uuid) from public, anon, authenticated;
