-- The admin verification queue and review actions use SECURITY DEFINER
-- RPCs with explicit admin checks. Do not expose raw verification evidence
-- through direct authenticated SELECTs, especially while this table has no
-- row-level SELECT policy.
REVOKE SELECT ON TABLE public.verification_records FROM anon, authenticated;
