-- HiddenHire V1 private verification-document storage.
--
-- Documents are private. Employers/agencies may upload and read only their own
-- verification documents. Admins may read documents for review.
--
-- Expected path:
--   recruiter-verification/<profile-id>/<random-file-name>

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'verification-documents',
  'verification-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists verification_documents_insert_own
  on storage.objects;

create policy verification_documents_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = 'recruiter-verification'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
  and current_profile_role() in ('employer', 'agency')
);

drop policy if exists verification_documents_select_own_or_admin
  on storage.objects;

create policy verification_documents_select_own_or_admin
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification-documents'
  and (
    owner_id = (select auth.uid()::text)
    or current_profile_role() = 'admin'
  )
);

drop policy if exists verification_documents_update_own
  on storage.objects;

create policy verification_documents_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'verification-documents'
  and owner_id = (select auth.uid()::text)
  and current_profile_role() in ('employer', 'agency')
)
with check (
  bucket_id = 'verification-documents'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[1] = 'recruiter-verification'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
  and current_profile_role() in ('employer', 'agency')
);

drop policy if exists verification_documents_delete_own
  on storage.objects;

create policy verification_documents_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'verification-documents'
  and owner_id = (select auth.uid()::text)
  and current_profile_role() in ('employer', 'agency')
);
