-- Allow authenticated employers/agencies to create native India jobs
-- through the server-side recruiter workflow.

grant insert (
  company_id,
  posted_by,
  source_type,
  title,
  description,
  location,
  city,
  region,
  country,
  remote,
  workplace_type,
  salary_min,
  salary_max,
  currency,
  experience_min,
  experience_max,
  status,
  visibility
) on public.jobs to authenticated;

drop policy if exists jobs_insert_native_recruiter on public.jobs;

create policy jobs_insert_native_recruiter on public.jobs
  for insert to authenticated
  with check (
    posted_by = auth.uid()
    and source_type = 'native'
    and country = 'India'
    and status = 'pending_review'
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('employer', 'agency')
    )
  );