-- Restrict moderation-case visibility to authorized HiddenHire administrators.
-- Moderation cases contain internal trust signals, risk reasons and review state.
-- Recruiters submit/track appeals through public.moderation_appeals; they do not
-- need direct read access to the internal moderation queue.
--
-- This migration is committed for review only. Do not apply to Production until
-- the schema change has been reviewed and the launch migration window is approved.

drop policy if exists moderation_cases_authenticated_select
  on public.moderation_cases;

drop policy if exists moderation_cases_admin_select
  on public.moderation_cases;

create policy moderation_cases_admin_select
  on public.moderation_cases
  for select
  to authenticated
  using (public.is_hiddenhire_admin());

-- Retain the existing authenticated SELECT grant. RLS now restricts it to
-- profiles whose authoritative role is admin. service_role continues to bypass
-- RLS for trusted server-side automation.
