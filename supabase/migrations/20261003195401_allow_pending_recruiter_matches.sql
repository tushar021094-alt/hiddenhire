CREATE OR REPLACE FUNCTION public.save_recruiter_match(
  p_job_id uuid,
  p_candidate_id uuid,
  p_score numeric,
  p_reasons jsonb,
  p_gaps jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
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

  if job_status not in ('published', 'pending_review') then
    raise exception using errcode = '42501',
      message = 'Matches can only be saved for jobs pending review or published.';
  end if;

  if actor_role <> 'admin' and job_posted_by is distinct from actor_id then
    raise exception using errcode = '42501',
      message = 'You are not authorized to save matches for this job.';
  end if;

  if not exists (
    select 1 from public.profiles as candidate_profile
    where candidate_profile.id = p_candidate_id
      and candidate_profile.role = 'candidate'
  ) then
    raise exception using errcode = '22023',
      message = 'The candidate profile could not be found.';
  end if;

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
$function$;
