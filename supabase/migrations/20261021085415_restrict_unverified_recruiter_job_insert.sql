-- Enforce the same recruiter-verification requirement at the database boundary
-- as the application API. A client must not bypass verification by inserting
-- a pending native job directly through the Supabase Data API.
DROP POLICY IF EXISTS jobs_insert_native_recruiter ON public.jobs;

CREATE POLICY jobs_insert_native_recruiter
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (
  posted_by = (SELECT auth.uid())
  AND source_type = 'native'
  AND country = 'India'
  AND status = 'pending_review'
  AND (
    EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      JOIN public.employer_profiles AS employer
        ON employer.profile_id = profile.id
      WHERE profile.id = (SELECT auth.uid())
        AND profile.role = 'employer'
        AND employer.recruiter_verified IS TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      JOIN public.agency_profiles AS agency
        ON agency.profile_id = profile.id
      WHERE profile.id = (SELECT auth.uid())
        AND profile.role = 'agency'
        AND agency.verified IS TRUE
    )
  )
);
