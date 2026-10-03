-- Prevent authenticated clients from self-assigning server-controlled trust state.
revoke update (recruiter_verified) on public.employer_profiles from authenticated;

drop policy if exists employer_profiles_insert_own on public.employer_profiles;
create policy employer_profiles_insert_own
  on public.employer_profiles
  for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and current_profile_role() = 'employer'
    and recruiter_verified = false
  );

revoke insert (profile_boost_until) on public.candidate_profiles from authenticated;
revoke update (profile_boost_until) on public.candidate_profiles from authenticated;

drop policy if exists companies_insert_owner on public.companies;
create policy companies_insert_owner
  on public.companies
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and current_profile_role() = any (array['employer','agency'])
    and verification_status = 'pending'
  );
