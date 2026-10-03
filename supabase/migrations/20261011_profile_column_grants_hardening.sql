-- Remove broad table grants so server-controlled columns cannot be written by clients.
revoke insert, update on public.employer_profiles from authenticated;
grant insert (profile_id, company_id, designation) on public.employer_profiles to authenticated;
grant update (profile_id, company_id, designation) on public.employer_profiles to authenticated;

revoke insert, update on public.candidate_profiles from authenticated;
grant insert (profile_id, resume_url, job_search_mode, headline, target_roles, preferred_locations)
  on public.candidate_profiles to authenticated;
grant update (profile_id, resume_url, job_search_mode, headline, target_roles, preferred_locations)
  on public.candidate_profiles to authenticated;

revoke insert on public.companies from authenticated;
grant insert (id, name, website, email_domain, country, description, created_by, created_at, updated_at)
  on public.companies to authenticated;
