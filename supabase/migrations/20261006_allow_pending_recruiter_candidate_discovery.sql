-- Allow recruiters to run candidate discovery while their native job is pending review.
-- Ownership and recruiter-role checks remain enforced by the existing SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.recruiter_candidate_discovery_for_job(p_job_id uuid)
RETURNS TABLE (
  candidate_id uuid,
  full_name text,
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  job_posted_by uuid;
  job_source_type text;
  job_status text;
  result_limit integer := 10;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select profile.role into actor_role
  from public.profiles as profile
  where profile.id = actor_id;

  if actor_role is null then
    raise exception using errcode = '42501', message = 'A HiddenHire profile is required.';
  end if;

  if actor_role not in ('employer', 'agency', 'admin') then
    raise exception using errcode = '42501',
      message = 'Employer, agency or admin access is required.';
  end if;

  select job.posted_by, job.source_type, job.status
    into job_posted_by, job_source_type, job_status
  from public.jobs as job
  where job.id = p_job_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'The requested job could not be found.';
  end if;

  if job_source_type <> 'native' then
    raise exception using errcode = '42501',
      message = 'Candidate discovery is only available for HiddenHire native jobs.';
  end if;

  if job_status not in ('published', 'pending_review') then
    raise exception using errcode = '42501',
      message = 'Candidate discovery is only available for jobs pending review or published.';
  end if;

  if actor_role <> 'admin' and job_posted_by is distinct from actor_id then
    raise exception using errcode = '42501',
      message = 'You are not authorized to discover candidates for this job.';
  end if;

  select coalesce(max(entitlement.limit_value), 10)::integer into result_limit
  from public.entitlements as entitlement
  where entitlement.profile_id = actor_id
    and entitlement.key = 'ai_matches'
    and (entitlement.period_start is null or entitlement.period_start <= now())
    and (entitlement.period_end is null or entitlement.period_end > now());

  return query
  with eligible as (
    select
      profile.id as profile_id,
      case
        when nullif(trim(profile.full_name), '') is null then 'Candidate'
        when position(' ' in trim(profile.full_name)) = 0 then trim(profile.full_name)
        else split_part(trim(profile.full_name), ' ', 1)
          || ' ' || left(split_part(trim(profile.full_name), ' ', 2), 1) || '.'
      end as masked_name,
      candidate.headline as headline,
      candidate.target_roles as target_roles,
      profile.skills as skills,
      profile.experience_years as experience_years,
      profile.location as location,
      profile.country as country,
      profile.remote_only as remote_only,
      profile.min_salary as min_salary,
      profile.salary_currency as salary_currency,
      candidate.preferred_locations as preferred_locations,
      profile.updated_at as updated_at
    from public.profiles as profile
    join public.candidate_profiles as candidate on candidate.profile_id = profile.id
    where profile.role = 'candidate'
      and profile.visibility in ('public', 'match_only')
      and candidate.job_search_mode in ('active', 'passive')
  )
  select
    eligible.profile_id as candidate_id,
    eligible.masked_name as full_name,
    eligible.masked_name as display_name,
    eligible.headline as headline,
    eligible.target_roles as target_roles,
    eligible.skills as skills,
    eligible.experience_years as experience_years,
    eligible.location as location,
    eligible.country as country,
    eligible.remote_only as remote_only,
    eligible.min_salary as min_salary,
    eligible.salary_currency as salary_currency,
    eligible.preferred_locations as preferred_locations
  from eligible
  order by eligible.updated_at desc
  limit greatest(result_limit, 0);
end;
$$;

REVOKE ALL ON FUNCTION public.recruiter_candidate_discovery_for_job(uuid)
  FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.recruiter_candidate_discovery_for_job(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.recruiter_candidate_discovery_for_job(uuid) IS
  'HiddenHire recruiter candidate discovery. Employer/agency owners and admins only; native pending-review or published jobs. Returns privacy-masked candidate summaries with no contact data.';
