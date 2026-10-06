alter table public.career_agent_actions
  add column if not exists source_provider text,
  add column if not exists job_function text,
  add column if not exists is_remote boolean;

create index if not exists career_agent_actions_learning_idx
  on public.career_agent_actions(candidate_id, source_provider, job_function, decision_score);
