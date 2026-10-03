-- Security hardening: protect authorization state, profile identity, exposed tables, and helper execution.

-- Authenticated users may edit profile data, but never authorization state.
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (
  full_name,
  location,
  country,
  experience_years,
  min_salary,
  remote_only,
  salary_currency,
  skills,
  visibility
) ON public.profiles TO authenticated;

-- One profile per email, case-insensitive and whitespace-normalized.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_ci
  ON public.profiles (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

-- Exposed catalog/ingestion tables must use RLS.
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_select_active" ON public.plans;
CREATE POLICY "plans_select_active"
  ON public.plans
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- company_sources is internal ingestion metadata; no anon/authenticated policies.

-- SECURITY DEFINER helpers are restricted to callers that actually need them.
REVOKE EXECUTE ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_hiddenhire_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_hiddenhire_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;

-- Pin the search path for the immutable helper.
ALTER FUNCTION public.v1_job_validity_days(text)
  SET search_path = public, pg_temp;
