-- Client inserts must not control lifecycle/server-managed fields.
revoke insert on public.applications from authenticated;
grant insert (job_id, candidate_id) on public.applications to authenticated;

revoke insert on public.jobs from authenticated;
grant insert (
  company_id, posted_by, title, description, location, city, region, country,
  remote, workplace_type, salary_min, salary_max, currency,
  experience_min, experience_max, job_function
) on public.jobs to authenticated;
