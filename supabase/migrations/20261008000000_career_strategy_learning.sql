alter table public.career_agent_actions add column if not exists strategy_id text;
alter table public.career_agent_actions add column if not exists strategy_changes jsonb;
