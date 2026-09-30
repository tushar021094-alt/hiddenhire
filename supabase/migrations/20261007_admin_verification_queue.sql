-- HiddenHire V1 admin recruiter verification queue.
--
-- Admin-only SECURITY DEFINER read path.
-- Keeps normal RLS restrictive for non-admin users.

drop function if exists public.admin_recruiter_verification_queue();

create function public.admin_recruiter_verification_queue()
returns table (
  verification_id uuid,
  profile_id uuid,
  company_id uuid,
  verification_type text,
  verification_status text,
  created_at timestamptz,
  updated_at timestamptz,

  requester_role text,
  recruiter_designation text,
  agency_name text,
  recruiter_verified boolean,
  agency_verified boolean,

  company_name text,
  company_website text,
  company_email_domain text,
  company_country text,
  company_verification_status text,

  evidence jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if not public.is_hiddenhire_admin() then
    raise exception using
      errcode = '42501',
      message = 'Admin access is required.';
  end if;

  return query
  select
    verification.id,
    verification.profile_id,
    verification.company_id,
    verification.verification_type,
    verification.status,
    verification.created_at,
    verification.updated_at,

    profile.role,

    employer_profile.designation,

    agency_profile.agency_name,

    coalesce(
      employer_profile.recruiter_verified,
      false
    ),

    coalesce(
      agency_profile.verified,
      false
    ),

    company.name,
    company.website,
    company.email_domain,
    company.country,
    company.verification_status,

    verification.evidence

  from public.verification_records as verification

  left join public.profiles as profile
    on profile.id = verification.profile_id

  left join public.employer_profiles as employer_profile
    on employer_profile.profile_id = verification.profile_id

  left join public.agency_profiles as agency_profile
    on agency_profile.profile_id = verification.profile_id

  left join public.companies as company
    on company.id = verification.company_id

  where verification.verification_type = 'recruiter_verification'
    and verification.status = 'pending'

  order by verification.created_at asc;
end;
$$;

revoke all
  on function public.admin_recruiter_verification_queue()
  from public, anon, authenticated;

grant execute
  on function public.admin_recruiter_verification_queue()
  to authenticated;

comment on function public.admin_recruiter_verification_queue() is
  'HiddenHire V1 admin-only recruiter verification queue. SECURITY DEFINER read path exposes pending verification records and related requester/company metadata without weakening normal RLS policies.';
