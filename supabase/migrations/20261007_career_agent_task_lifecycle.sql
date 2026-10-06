alter table public.career_agent_actions
  add column if not exists last_evaluated_at timestamptz;

create index if not exists career_agent_actions_open_eval_idx
  on public.career_agent_actions(candidate_id, task_status, last_evaluated_at);

comment on column public.career_agent_actions.last_evaluated_at is
  'Last time the Career Agent reconciled this task against application and opportunity state.';