-- Bound recruiter verification JSON evidence fields and document metadata.
alter table public.verification_records
  drop constraint if exists verification_records_recruiter_evidence_length_check;

alter table public.verification_records
  add constraint verification_records_recruiter_evidence_length_check
  check (
    verification_type <> 'recruiter_verification'
    or (
      jsonb_typeof(evidence) = 'object'
      and not exists (
        select 1
        from jsonb_each(evidence) as field(key, value)
        where field.key <> 'verification_documents'
          and jsonb_typeof(field.value) = 'string'
          and char_length(field.value #>> '{}') > 500
      )
      and (
        jsonb_typeof(evidence->'verification_documents') is null
        or (
          jsonb_typeof(evidence->'verification_documents') = 'array'
          and jsonb_array_length(evidence->'verification_documents') <= 5
          and not exists (
            select 1
            from jsonb_array_elements(evidence->'verification_documents') as doc(value)
            where jsonb_typeof(doc.value) <> 'object'
              or exists (
                select 1
                from jsonb_each(doc.value) as field(key, value)
                where field.key in ('type','path','file_name','mime_type')
                  and jsonb_typeof(field.value) = 'string'
                  and char_length(field.value #>> '{}') > 500
              )
          )
        )
      )
    )
  );