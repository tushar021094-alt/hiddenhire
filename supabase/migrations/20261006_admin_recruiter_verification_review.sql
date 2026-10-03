-- HiddenHire V1 admin recruiter-verification review workflow.
--
-- Admin-only database-authorized approval/rejection path.
-- No direct authenticated writes are granted on verification_records,
-- employer_profiles, agency_profiles, companies, or audit_events.

drop function if exists public.admin_review_recruiter_verification(uuid, text, text);

create function public.admin_review_recruiter_verification(
  p_verification_id uuid,
  p_action text,
  p_reason text default null
)
returns table (
  verification_id uuid,
  verification_status text,
  reviewed_by uuid,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();

  verification_profile_id uuid;
  verification_company_id uuid;
  verification_status text;

  actor_role text;
  resolved_action text;
  resolved_reason text;

  audit_id uuid;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  if not public.is_hiddenhire_admin() then
    raise exception using
      errcode = '42501',
      message = 'Admin access is required to review recruiter verification.';
  end if;

  resolved_action := lower(nullif(btrim(coalesce(p_action, '')), ''));

  if resolved_action not in ('approve', 'reject') then
    raise exception using
      errcode = '22023',
      message = 'Verification action must be approve or reject.';
  end if;

  resolved_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if resolved_action = 'reject'
     and resolved_reason is null then
    raise exception using
      errcode = '22023',
      message = 'A rejection reason is required.';
  end if;

  if resolved_reason is not null
     and length(resolved_reason) > 500 then
    raise exception using
      errcode = '22023',
      message = 'The verification review reason cannot exceed 500 characters.';
  end if;

  select
    verification.profile_id,
    verification.company_id,
    verification.status
  into
    verification_profile_id,
    verification_company_id,
    verification_status
  from public.verification_records as verification
  where verification.id = p_verification_id
    and verification.verification_type = 'recruiter_verification'
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The requested recruiter verification record could not be found.';
  end if;

  if verification_status <> 'pending' then
    raise exception using
      errcode = '22023',
      message = 'Only pending recruiter verification requests can be reviewed.';
  end if;

  select profile.role
    into actor_role
  from public.profiles as profile
  where profile.id = verification_profile_id;

  if actor_role not in ('employer', 'agency') then
    raise exception using
      errcode = '22023',
      message = 'The verification requester is not an employer or agency.';
  end if;

  update public.verification_records
  set
    status = case
      when resolved_action = 'approve' then 'verified'
      else 'rejected'
    end,
    reviewed_by = actor_id,
    updated_at = now()
  where id = p_verification_id;

  if actor_role = 'employer' then
    update public.employer_profiles
    set recruiter_verified = (resolved_action = 'approve')
    where profile_id = verification_profile_id;

    if verification_company_id is not null then
      update public.companies
      set
        verification_status = case
          when resolved_action = 'approve' then 'verified'
          else 'rejected'
        end,
        updated_at = now()
      where id = verification_company_id;
    end if;
  else
    update public.agency_profiles
    set verified = (resolved_action = 'approve')
    where profile_id = verification_profile_id;
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor_id,
    case
      when resolved_action = 'approve'
        then 'recruiter_verification.approved'
      else 'recruiter_verification.rejected'
    end,
    'verification',
    p_verification_id::text,
    jsonb_build_object(
      'verification_type', 'recruiter_verification',
      'requester_profile_id', verification_profile_id,
      'company_id', verification_company_id,
      'previous_status', 'pending',
      'new_status', case
        when resolved_action = 'approve' then 'verified'
        else 'rejected'
      end,
      'reason', resolved_reason
    )
  )
  returning id into audit_id;

  insert into public.notifications (
    profile_id,
    type,
    title,
    body,
    data
  )
  values (
    verification_profile_id,
    'recruiter_verification',
    case
      when resolved_action = 'approve'
        then 'Recruiter verification approved'
      else 'Recruiter verification rejected'
    end,
    case
      when resolved_action = 'approve'
        then 'Your recruiter verification has been approved. You can now post native HiddenHire jobs.'
      else
        'Your recruiter verification was rejected.'
        || case
             when resolved_reason is not null
               then ' Reason: ' || resolved_reason
             else ''
           end
    end,
    jsonb_build_object(
      'verificationId', p_verification_id,
      'status', case
        when resolved_action = 'approve' then 'verified'
        else 'rejected'
      end
    )
  );

  return query
  select
    p_verification_id,
    case
      when resolved_action = 'approve' then 'verified'
      else 'rejected'
    end,
    actor_id,
    audit_id;
end;
$$;

revoke all
  on function public.admin_review_recruiter_verification(uuid, text, text)
  from public, anon, authenticated;

grant execute
  on function public.admin_review_recruiter_verification(uuid, text, text)
  to authenticated;

comment on function public.admin_review_recruiter_verification(uuid, text, text) is
  'HiddenHire V1 admin-only recruiter verification approval/rejection. Database-side admin authorization, verification state transition, recruiter/company verification flags, notification and audit event are handled atomically.';
