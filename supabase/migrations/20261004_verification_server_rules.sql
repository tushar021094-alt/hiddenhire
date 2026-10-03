-- HiddenHire V1 stronger recruiter verification rules.
--
-- Server-side enforcement for:
--   - organisation type
--   - entity-specific business identity fields
--   - conditional GST information
--   - registered address
--   - supporting private verification documents
--
-- Website and company email domain remain optional.
-- Mobile OTP is intentionally not enforced here yet because the OTP workflow
-- is not implemented yet.

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
  organisation_type text;
  gst_registered text;
  documents jsonb;
  document jsonb;
  document_path text;
  document_mime_type text;
  document_size bigint;
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

  organisation_type :=
    lower(nullif(btrim(coalesce(evidence->>'organisation_type', '')), ''));

  if organisation_type is null then
    raise exception using
      errcode = '22023',
      message = 'Organisation type is required for recruiter verification.';
  end if;

  if organisation_type not in (
    'private_limited',
    'public_limited',
    'llp',
    'partnership',
    'proprietorship',
    'recruitment_agency',
    'international'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid organisation type.';
  end if;

  if nullif(btrim(coalesce(evidence->>'registered_address', '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Registered or business address is required for recruiter verification.';
  end if;

  if organisation_type in (
    'private_limited',
    'public_limited'
  ) then
    if nullif(btrim(coalesce(evidence->>'legal_company_name', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Legal company name is required.';
    end if;

    if nullif(btrim(coalesce(evidence->>'cin', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'CIN is required for a private or public limited company.';
    end if;

    if nullif(btrim(coalesce(evidence->>'company_pan', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Company PAN is required.';
    end if;
  elsif organisation_type = 'llp' then
    if nullif(btrim(coalesce(evidence->>'legal_company_name', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Legal LLP name is required.';
    end if;

    if nullif(btrim(coalesce(evidence->>'llpin', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'LLPIN is required for an LLP.';
    end if;

    if nullif(btrim(coalesce(evidence->>'company_pan', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'PAN is required for an LLP.';
    end if;
  elsif organisation_type = 'partnership' then
    if nullif(btrim(coalesce(evidence->>'legal_company_name', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Legal firm name is required for a partnership.';
    end if;

    if nullif(btrim(coalesce(evidence->>'company_pan', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'PAN is required for a partnership.';
    end if;

    if nullif(btrim(coalesce(evidence->>'business_registration_details', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Business registration details are required for a partnership.';
    end if;
  elsif organisation_type = 'proprietorship' then
    if nullif(btrim(coalesce(evidence->>'business_trade_name', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Business or trade name is required for a proprietorship.';
    end if;

    if nullif(btrim(coalesce(evidence->>'proprietor_name', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Proprietor name is required.';
    end if;

    if nullif(btrim(coalesce(evidence->>'company_pan', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Proprietor PAN is required.';
    end if;
  elsif organisation_type = 'recruitment_agency' then
    if nullif(btrim(coalesce(evidence->>'company_pan', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Business PAN or applicable tax identity is required for a recruitment agency.';
    end if;

    if nullif(btrim(coalesce(evidence->>'business_registration_details', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Business registration details are required for a recruitment agency.';
    end if;
  elsif organisation_type = 'international' then
    if nullif(btrim(coalesce(evidence->>'legal_company_name', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Legal company name is required for an international company.';
    end if;

    if nullif(btrim(coalesce(evidence->>'business_registration_details', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'Local business registration details are required for an international company.';
    end if;
  end if;

  gst_registered :=
    lower(nullif(btrim(coalesce(evidence->>'gst_registered', '')), ''));

  if organisation_type <> 'international' then
    if gst_registered not in ('yes', 'no') then
      raise exception using
        errcode = '22023',
        message = 'GST registration status is required.';
    end if;

    if gst_registered = 'yes'
      and nullif(btrim(coalesce(evidence->>'gstin', '')), '') is null then
      raise exception using
        errcode = '22023',
        message = 'GSTIN is required when GST registration is marked Yes.';
    end if;
  end if;

  documents := coalesce(evidence->'verification_documents', '[]'::jsonb);

  if jsonb_typeof(documents) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Verification documents must be an array.';
  end if;

  if jsonb_array_length(documents) < 1 then
    raise exception using
      errcode = '22023',
      message = 'At least one supporting verification document is required.';
  end if;

  if jsonb_array_length(documents) > 5 then
    raise exception using
      errcode = '22023',
      message = 'A maximum of five verification documents can be submitted.';
  end if;

  for document in
    select value
    from jsonb_array_elements(documents)
  loop
    if jsonb_typeof(document) <> 'object' then
      raise exception using
        errcode = '22023',
        message = 'Each verification document must be a valid document object.';
    end if;

    document_path :=
      nullif(btrim(coalesce(document->>'path', '')), '');

    document_mime_type :=
      lower(nullif(btrim(coalesce(document->>'mime_type', '')), ''));

    document_size :=
      coalesce((document->>'size')::bigint, 0);

    if document_path is null then
      raise exception using
        errcode = '22023',
        message = 'Each verification document must include a storage path.';
    end if;

    if left(
      document_path,
      length('recruiter-verification/' || actor_id::text || '/')
    ) <> 'recruiter-verification/' || actor_id::text || '/' then
      raise exception using
        errcode = '42501',
        message = 'Verification documents must belong to the submitting recruiter.';
    end if;

    if document_mime_type not in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ) then
      raise exception using
        errcode = '22023',
        message = 'Unsupported verification document type.';
    end if;

    if document_size <= 0 or document_size > 10485760 then
      raise exception using
        errcode = '22023',
        message = 'Verification document size must be between 1 byte and 10 MB.';
    end if;

    if not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'verification-documents'
        and object.name = document_path
        and object.owner_id = actor_id::text
    ) then
      raise exception using
        errcode = '22023',
        message = 'A submitted verification document could not be found in private storage.';
    end if;
  end loop;

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
  'HiddenHire V1 recruiter verification request with entity-specific business identity, conditional GST validation, and private verification-document validation. Website and domain remain optional; admin review determines final verification.';
