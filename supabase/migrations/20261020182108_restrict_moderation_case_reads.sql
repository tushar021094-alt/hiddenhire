-- Restrict moderation-case visibility to the affected recruiter and admins.
-- Cases contain internal trust signals, risk reasons and review state. A recruiter
-- may inspect only their own case to file/track an appeal; other cases stay private.
--
-- This migration is committed for review only. Do not apply to Production until
-- the schema change has been reviewed and the launch migration window is approved.

drop policy if exists moderation_cases_authenticated_select
  on public.moderation_cases;

drop policy if exists moderation_cases_admin_select
  on public.moderation_cases;

create policy moderation_cases_admin_or_owner_select
  on public.moderation_cases
  for select
  to authenticated
  using (public.is_hiddenhire_admin() OR recruiter_id = auth.uid());

-- Retain the existing authenticated SELECT grant. RLS now restricts it to
-- an admin or the recruiter associated with that specific case. service_role
-- continues to bypass RLS for trusted server-side automation.
