-- Defense-in-depth: jobs may only be inserted through the constrained native recruiter policy.
-- The older jobs_insert_owner policy was permissive enough to allow arbitrary source/status
-- values when called directly through Supabase, bypassing the intended moderation boundary.
drop policy if exists jobs_insert_owner on public.jobs;
