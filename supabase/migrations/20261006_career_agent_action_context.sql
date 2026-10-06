alter table public.career_agent_actions
  add column if not exists job_title text,
  add column if not exists company_name text,
  add column if not exists job_location text;

create index if not exists career_agent_actions_candidate_title_idx
  on public.career_agent_actions(candidate_id, created_at desc);
