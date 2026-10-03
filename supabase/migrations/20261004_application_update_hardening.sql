-- Security hardening: prevent application ownership/status rows from being reassigned.
-- Authenticated callers may only change the application status. The RLS
-- WITH CHECK also preserves ownership and job access during UPDATE.

REVOKE UPDATE ON public.applications FROM authenticated;

GRANT UPDATE (status)
  ON public.applications
  TO authenticated;

DROP POLICY IF EXISTS applications_candidate_update
  ON public.applications;

CREATE POLICY applications_candidate_update
  ON public.applications
  FOR UPDATE
  TO authenticated
  USING (
    (candidate_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = applications.job_id
        AND j.posted_by = auth.uid()
    )
    OR (current_profile_role() = 'admin')
  )
  WITH CHECK (
    (candidate_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = applications.job_id
        AND j.posted_by = auth.uid()
    )
    OR (current_profile_role() = 'admin')
  );
