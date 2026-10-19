-- Harden direct access to moderation appeals.
-- Moderation decisions must only be changed by an administrator. Recruiters may
-- submit an appeal only for their own active restriction/escalation and may read
-- only their own appeal records. The server-side admin review route remains the
-- only user-facing path for accepted/rejected decisions.
--
-- Review-only migration. Do not apply to Production until this PR and migration
-- ordering have been reviewed and the launch migration window is approved.

-- Remove broad inherited table privileges (including TRUNCATE/TRIGGER) and grant
-- only the operations needed by the application. Row-level policies below still
-- determine which rows each authenticated user may access.
REVOKE ALL ON TABLE public.moderation_cases FROM anon, authenticated;
GRANT SELECT ON TABLE public.moderation_cases TO authenticated;

REVOKE ALL ON TABLE public.moderation_appeals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.moderation_appeals TO authenticated;

-- Admins may review all appeals; a recruiter may see their own appeal rows only.
DROP POLICY IF EXISTS moderation_appeals_select_own ON public.moderation_appeals;
DROP POLICY IF EXISTS moderation_appeals_select_admin_or_owner ON public.moderation_appeals;
CREATE POLICY moderation_appeals_select_admin_or_owner
  ON public.moderation_appeals
  FOR SELECT
  TO authenticated
  USING (public.is_hiddenhire_admin() OR recruiter_id = auth.uid());

-- An appeal must belong to the authenticated recruiter and match an existing
-- case/job pair owned by that recruiter. Only appealable active decisions can
-- be submitted, and client-supplied review fields/status are rejected.
DROP POLICY IF EXISTS moderation_appeals_insert_own ON public.moderation_appeals;
CREATE POLICY moderation_appeals_insert_own
  ON public.moderation_appeals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recruiter_id = auth.uid()
    AND status = 'submitted'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND resolution IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.moderation_cases AS moderation_case
      WHERE moderation_case.id = moderation_appeals.case_id
        AND moderation_case.job_id = moderation_appeals.job_id
        AND moderation_case.recruiter_id = auth.uid()
        AND moderation_case.status IN ('open', 'under_review', 'appealed')
        AND moderation_case.decision IN ('restrict', 'escalate')
    )
  );

-- Only administrators can change appeal status or decision metadata. This is
-- required because private.sync_appeal_case() updates the moderation case based
-- on the appeal status transition.
DROP POLICY IF EXISTS moderation_appeals_update_own ON public.moderation_appeals;
DROP POLICY IF EXISTS moderation_appeals_admin_update ON public.moderation_appeals;
CREATE POLICY moderation_appeals_admin_update
  ON public.moderation_appeals
  FOR UPDATE
  TO authenticated
  USING (public.is_hiddenhire_admin())
  WITH CHECK (public.is_hiddenhire_admin());

-- Application checks improve UX, but this constraint prevents concurrent
-- duplicate active appeals from bypassing the server-side check.
CREATE UNIQUE INDEX IF NOT EXISTS moderation_appeals_one_active_per_case
  ON public.moderation_appeals (case_id)
  WHERE status IN ('submitted', 'under_review');
