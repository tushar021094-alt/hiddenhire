alter table public.career_agent_actions
  add column if not exists workflow jsonb;
