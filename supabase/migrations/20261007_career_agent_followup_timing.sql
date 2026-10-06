alter table public.career_agent_actions
  add column if not exists due_at timestamptz,
  add column if not exists last_reminded_at timestamptz;

create index if not exists career_agent_actions_due_idx
  on public.career_agent_actions(candidate_id, task_status, due_at);