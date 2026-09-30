-- HiddenHire V1 recruiter verification request workflow.
--
-- Canonical verification type:
--   recruiter_verification
--
-- Employers/agencies submit verification evidence through this SECURITY
-- DEFINER RPC because authenticated clients intentionally have no INSERT/UPDATE
-- privileges on public.verification_records.

create unique index if not exists verification_records_one_pending_recruiter_verification
  on public.verification_records (profile_id, verification_type)
  where verification_type = 'recruiter_verification'
    and status = 'pending';

create or replace function public.request_recruiter_verification(
  p_evidence jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  email_confirmed_at timestamptz;
  employer_company_id uuid;
  employer_verified boolean := false;
  agency_verified boolean := false;
  existing_pending_id uuid;
  verification_id uuid;
  evidence jsonb;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select profile.role
    into actor_role
  from public.profiles as profile
  where profile.id = actor_id;

  if actor_role is null then
    raise exception using
      errcode = '42501',
      message = 'A HiddenHire profile is required.';
  end if;

  if actor_role not in ('employer', 'agency') then
    raise exception using
      errcode = '42501',
      message = 'Only employers and agencies can request recruiter verification.';
  end if;

  select users.email_confirmed_at
    into email_confirmed_at
  from auth.users as users
  where users.id = actor_id;

  if email_confirmed_at is null then
    raise exception using
      errcode = '22023',
      message = 'Email verification is required before recruiter verification.';
  end if;

  evidence := coalesce(p_evidence, '{}'::jsonb);

  if jsonb_typeof(evidence) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'Verification evidence must be a JSON object.';
  end if;

  if nullif(btrim(coalesce(evidence->>'mobile', '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Mobile number is required for recruiter verification.';
  end if;

  if nullif(btrim(coalesce(evidence->>'recruiter_name', '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Recruiter name is required for recruiter verification.';
  end if;

  if nullif(btrim(coalesce(evidence->>'designation', '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Recruiter designation is required for recruiter verification.';
  end if;

  if nullif(btrim(coalesce(evidence->>'company_name', '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Company or agency name is required for recruiter verification.';
  end if;

  if actor_role = 'employer' then
    select
      employer_profile.company_id,
      employer_profile.recruiter_verified
    into
      employer_company_id,
      employer_verified
    from public.employer_profiles as employer_profile
    where employer_profile.profile_id = actor_id;

    if not found then
      raise exception using
        errcode = '22023',
        message = 'An employer profile is required before requesting verification.';
    end if;

    if employer_verified then
      raise exception using
        errcode = '22023',
        message = 'This employer account is already verified.';
    end if;
  else
    select
      agency_profile.verified
    into
      agency_verified
    from public.agency_profiles as agency_profile
    where agency_profile.profile_id = actor_id;

    if not found then
      raise exception using
        errcode = '22023',
        message = 'An agency profile is required before requesting verification.';
    end if;

    if agency_verified then
      raise exception using
        errcode = '22023',
        message = 'This agency account is already verified.';
    end if;
  end if;

  select verification.id
    into existing_pending_id
  from public.verification_records as verification
  where verification.profile_id = actor_id
    and verification.verification_type = 'recruiter_verification'
    and verification.status = 'pending'
  order by verification.created_at desc
  limit 1;

  if existing_pending_id is not null then
    return existing_pending_id;
  end if;

  insert into public.verification_records (
    profile_id,
    company_id,
    verification_type,
    status,
    evidence,
    reviewed_by
  )
  values (
    actor_id,
    employer_company_id,
    'recruiter_verification',
    'pending',
    evidence,
    null
  )
  returning id into verification_id;

  if employer_company_id is not null then
    update public.companies
    set verification_status = 'pending',
        updated_at = now()
    where id = employer_company_id
      and verification_status <> 'verified';
  end if;

  return verification_id;
end;
$$;

revoke all on function public.request_recruiter_verification(jsonb)
  from public, anon, authenticated;

grant execute on function public.request_recruiter_verification(jsonb)
  to authenticated;

comment on function public.request_recruiter_verification(jsonb) is
  'HiddenHire V1 recruiter verification request. Employer/agency users submit controlled evidence through a SECURITY DEFINER RPC because verification_records is not client-writable. Email confirmation is required; admin review determines final verification.';