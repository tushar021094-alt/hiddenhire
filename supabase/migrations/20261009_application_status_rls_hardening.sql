-- Enforce application status transitions at the database boundary.
-- API routes remain responsible for UX/error mapping, while RLS prevents
-- direct authenticated clients from bypassing actor-specific status rules.

revoke update on public.applications from authenticated;
grant update (status) on public.applications to authenticated;

drop policy if exists applications_candidate_update on public.applications;

create policy applications_candidate_status_update
  on public.applications
  for update
  to authenticated
  using (
    candidate_id = auth.uid()
    and current_profile_role() = 'candidate'
  )
  with check (
    candidate_id = auth.uid()
    and current_profile_role() = 'candidate'
    and status = 'withdrawn'
  );

create policy applications_recruiter_status_update
  on public.applications
  for update
  to authenticated
  using (
    current_profile_role() in ('employer', 'agency')
    and exists (
      select 1
      from public.jobs j
      where j.id = applications.job_id
        and j.posted_by = auth.uid()
    )
  )
  with check (
    current_profile_role() in ('employer', 'agency')
    and exists (
      select 1
      from public.jobs j
      where j.id = applications.job_id
        and j.posted_by = auth.uid()
    )
    and status in (
      'reviewing',
      'shortlisted',
      'interview',
      'rejected',
      'hired'
    )
  );

create policy applications_admin_status_update
  on public.applications
  for update
  to authenticated
  using (
    current_profile_role() = 'admin'
  )
  with check (
    current_profile_role() = 'admin'
    and status in (
      'applied',
      'reviewing',
      'shortlisted',
      'interview',
      'rejected',
      'hired',
      'withdrawn'
    )
  );
