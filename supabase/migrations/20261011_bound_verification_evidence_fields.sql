-- Bound recruiter verification JSON evidence fields and document metadata.
create or replace function public.recruiter_verification_evidence_within_limits(p_evidence jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  field_name text;
  field_value text;
  document jsonb;
begin
  if jsonb_typeof(p_evidence) <> 'object' then return false; end if;

  foreach field_name in array[
    'mobile','recruiter_name','designation','organisation_type','company_name',
    'company_website','company_domain','legal_company_name','cin','llpin',
    'company_pan','registered_address','gst_registered','gstin','proprietor_name',
    'business_trade_name','udyam_number','business_registration_details',
    'additional_business_verification'
  ] loop
    if jsonb_typeof(p_evidence->field_name) is not null
       and jsonb_typeof(p_evidence->field_name) <> 'string' then
      return false;
    end if;
    field_value := p_evidence->>field_name;
    if field_value is not null and char_length(field_value) > 500 then
      return false;
    end if;
  end loop;

  if p_evidence ? 'verification_documents' then
    if jsonb_typeof(p_evidence->'verification_documents') <> 'array'
       or jsonb_array_length(p_evidence->'verification_documents') > 5 then
      return false;
    end if;

    for document in
      select value from jsonb_array_elements(p_evidence->'verification_documents')
    loop
      if jsonb_typeof(document) <> 'object' then return false; end if;
      foreach field_name in array['type','path','file_name','mime_type'] loop
        if jsonb_typeof(document->field_name) is not null
           and jsonb_typeof(document->field_name) <> 'string' then
          return false;
        end if;
        field_value := document->>field_name;
        if field_value is not null and char_length(field_value) > 500 then
          return false;
        end if;
      end loop;
    end loop;
  end if;

  return true;
end;
$$;

revoke all on function public.recruiter_verification_evidence_within_limits(jsonb) from public, anon, authenticated;

alter table public.verification_records
  drop constraint if exists verification_records_recruiter_evidence_length_check;

alter table public.verification_records
  add constraint verification_records_recruiter_evidence_length_check
  check (
    verification_type <> 'recruiter_verification'
    or public.recruiter_verification_evidence_within_limits(evidence)
  );