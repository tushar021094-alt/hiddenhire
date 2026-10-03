-- HiddenHire V1 recruiter matching RPC foundation.
--
-- Adds the two server-side RPCs the recruiter workflow already calls:
--   * public.recruiter_candidate_discovery_for_job(uuid)
--   * public.save_recruiter_match(uuid, uuid, numeric, jsonb, jsonb)
--
-- Apply this file AFTER:
--   supabase/schema.sql
--   supabase/migrations/20260923_candidate_onboarding.sql
--   supabase/migrations/20260924_security_foundation.sql
--   supabase/migrations/20260924_recruiter_job_creation.sql
--   supabase/migrations/20260928_job_function.sql
--
-- This file is the authoritative definition AND privilege source for both
-- functions. 20260924_security_foundation.sql revoked EXECUTE on
-- recruiter_candidate_discovery_for_job from `authenticated` without re-granting
-- it; that migration is intentionally left untouched and is superseded here.
--
-- Scope notes:
--   * No table, column or parameter is invented. Every referenced column exists
--     in supabase/schema.sql and every parameter name matches the existing
--     application call sites (app/api/recruiter/jobs/route.ts).
--   * public.matches has no metadata column beyond score/reasons/gaps, so no
--     extra data is persisted and the table schema is untouched.
--   * Privacy: neither function reads, returns or stores candidate email,
--     phone or any other private contact field. Candidate names are masked
--     with the same expression the previous definition used.
--   * Matching/scoring logic stays in TypeScript; these functions only
--     authorize, select the allowed pool and persist the computed result.

-- ---------------------------------------------------------------------------
-- 1. Candidate discovery for a single owned native job.
-- ---------------------------------------------------------------------------

-- The return shape gains `full_name` (the field name the application reads)
-- alongside the previous `display_name`. CREATE OR REPLACE cannot change a
-- function's return columns, so the function is dropped and recreated. The
-- drop is signature-specific and the file stays re-runnable.
drop function if exists public.recruiter_candidate_discovery_for_job(uuid);

create function public.recruiter_candidate_discovery_for_job(p_job_id uuid)
returns table (
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
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  if job_status <> 'published' then
    raise exception using errcode = '42501',
      message = 'Candidate discovery is only available for published jobs.';
  end if;

  -- Ownership boundary. Admins may inspect the pool of any published native
  -- job; employers and agencies may only inspect jobs they posted.
  if actor_role <> 'admin' and job_posted_by is distinct from actor_id then
    raise exception using errcode = '42501',
      message = 'You are not authorized to discover candidates for this job.';
  end if;

  -- Plan-controlled pool size, read from existing entitlements. Quota
  -- consumption is intentionally not performed here.
  select coalesce(max(entitlement.limit_value), 10)::integer into result_limit
  from public.entitlements as entitlement
  where entitlement.profile_id = actor_id
    and entitlement.key = 'ai_matches'
    and (entitlement.period_start is null or entitlement.period_start <= now())
    and (entitlement.period_end is null or entitlement.period_end > now());

  -- Same privacy/search rules the previous definition applied: candidate role,
  -- discovery-compatible visibility, and an active/passive search mode.
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

-- Authenticated callers only. `public` is revoked first because PostgreSQL
-- grants EXECUTE to PUBLIC by default on newly created functions.
revoke all on function public.recruiter_candidate_discovery_for_job(uuid)
  from public, anon, authenticated;
grant execute on function public.recruiter_candidate_discovery_for_job(uuid)
  to authenticated;

comment on function public.recruiter_candidate_discovery_for_job(uuid) is
  'HiddenHire V1 recruiter candidate discovery. Employer/agency owners and admins only; native published jobs only. Returns privacy-masked candidate summaries with no contact data.';

-- ---------------------------------------------------------------------------
-- 2. Persist (upsert) one recruiter match for a single owned native job.
-- ---------------------------------------------------------------------------
--
-- Call site: app/api/recruiter/jobs/route.ts
--   rpc('save_recruiter_match', { p_job_id, p_candidate_id, p_score,
--                                p_reasons, p_gaps })
-- p_reasons / p_gaps are string arrays in application code and map onto the
-- existing public.matches.reasons / .gaps jsonb columns.

drop function if exists public.save_recruiter_match(uuid, uuid, numeric, jsonb, jsonb);

create function public.save_recruiter_match(
  p_job_id uuid,
  p_candidate_id uuid,
  p_score numeric,
  p_reasons jsonb,
  p_gaps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  job_posted_by uuid;
  job_source_type text;
  job_status text;
  match_id uuid;
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
      message = 'Matches can only be saved for HiddenHire native jobs.';
  end if;

  if job_status <> 'published' then
    raise exception using errcode = '42501',
      message = 'Matches can only be saved for published jobs.';
  end if;

  -- Prevents any caller from writing matches against another employer's job.
  if actor_role <> 'admin' and job_posted_by is distinct from actor_id then
    raise exception using errcode = '42501',
      message = 'You are not authorized to save matches for this job.';
  end if;

  -- Matches are candidate-scoped records; only real candidate profiles allowed.
  if not exists (
    select 1 from public.profiles as candidate_profile
    where candidate_profile.id = p_candidate_id
      and candidate_profile.role = 'candidate'
  ) then
    raise exception using errcode = '22023',
      message = 'The candidate profile could not be found.';
  end if;

  -- Idempotent upsert against the existing unique(job_id, candidate_id) key.
  -- Only the existing score/reasons/gaps columns are written; created_at is
  -- preserved on re-scoring and no new column is introduced.
  insert into public.matches (job_id, candidate_id, score, reasons, gaps)
  values (
    p_job_id,
    p_candidate_id,
    greatest(0::numeric, least(100::numeric, coalesce(p_score, 0::numeric))),
    coalesce(p_reasons, '[]'::jsonb),
    coalesce(p_gaps, '[]'::jsonb)
  )
  on conflict (job_id, candidate_id) do update
    set score = excluded.score,
        reasons = excluded.reasons,
        gaps = excluded.gaps
  returning id into match_id;

  return match_id;
end;
$$;

-- Authenticated callers only. `public` is revoked first because PostgreSQL
-- grants EXECUTE to PUBLIC by default on newly created functions.
revoke all on function public.save_recruiter_match(uuid, uuid, numeric, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_recruiter_match(uuid, uuid, numeric, jsonb, jsonb)
  to authenticated;

comment on function public.save_recruiter_match(uuid, uuid, numeric, jsonb, jsonb) is
  'HiddenHire V1 recruiter match upsert. Employer/agency owners and admins only; native published jobs only. Upserts public.matches on (job_id, candidate_id).';