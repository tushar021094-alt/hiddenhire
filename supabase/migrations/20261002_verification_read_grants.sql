-- HiddenHire V1 verification read grants.
--
-- RLS policies already restrict which rows authenticated users may read.
-- These grants provide the table-level SELECT privilege required for those
-- policies to take effect.

grant select on public.verification_records to authenticated;
grant select on public.agency_profiles to authenticated;