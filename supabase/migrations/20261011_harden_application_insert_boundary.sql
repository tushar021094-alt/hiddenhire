-- Applications may only be created as "applied" against published native jobs.
revoke insert (status) on public.applications from authenticated;

drop policy if exists applications_candidate_insert on public.applications;
create policy applications_candidate_insert
  on public.applications
  for insert
  to authenticated
  with check (
    candidate_id = auth.uid()
    and current_profile_role() = 'candidate'
    and status = 'applied'
    and exists (
      select 1
      from public.jobs j
      where j.id = applications.job_id
        and j.source_type = 'native'
        and j.status = 'published'
    )
  );
