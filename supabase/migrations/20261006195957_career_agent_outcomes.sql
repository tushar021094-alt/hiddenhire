alter table public.career_agent_actions
  add column if not exists outcome text not null default 'not_started'
    check (outcome in ('not_started','opened','applied','reviewing','shortlisted','interview','hired','rejected','withdrawn')),
  add column if not exists outcome_at timestamptz,
  add column if not exists outcome_source text;

create index if not exists career_agent_actions_outcome_idx
  on public.career_agent_actions(candidate_id, outcome, outcome_at desc);