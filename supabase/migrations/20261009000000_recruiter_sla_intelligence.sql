alter table public.applications
  add column if not exists recruiter_first_response_at timestamptz,
  add column if not exists recruiter_response_count integer not null default 0;

create index if not exists applications_recruiter_first_response_idx
  on public.applications (recruiter_first_response_at)
  where recruiter_first_response_at is not null;

create index if not exists applications_recruiter_sla_idx
  on public.applications (recruiter_response_due_at, status)
  where recruiter_response_due_at is not null;
