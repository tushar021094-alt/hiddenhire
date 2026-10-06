create table if not exists public.career_agent_opportunity_state (
  watch_id uuid not null references public.job_watches(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  job_fingerprint text not null,
  latest_score numeric not null default 0,
  trend text not null default 'stable' check (trend in ('improving','stable','changed','reopened')),
  last_material_event text,
  last_decision text,
  task_status text not null default 'open' check (task_status in ('open','completed','dismissed')),
  outcome text not null default 'not_started',
  last_decision_at timestamptz,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (watch_id, job_fingerprint)
);

create index if not exists career_agent_opportunity_state_candidate_idx
  on public.career_agent_opportunity_state(candidate_id, updated_at desc);

create index if not exists career_agent_opportunity_state_watch_idx
  on public.career_agent_opportunity_state(watch_id, updated_at desc);

alter table public.career_agent_opportunity_state enable row level security;

drop policy if exists "career_agent_opportunity_state_own_select" on public.career_agent_opportunity_state;
create policy "career_agent_opportunity_state_own_select"
  on public.career_agent_opportunity_state
  for select to authenticated
  using (candidate_id = (select auth.uid()));

grant select on public.career_agent_opportunity_state to authenticated;