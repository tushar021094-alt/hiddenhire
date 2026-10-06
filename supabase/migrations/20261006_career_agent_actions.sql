create table if not exists public.career_agent_actions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  job_fingerprint text not null,
  action text not null check (action in ('apply_now','review','prepare','follow_up','watch')),
  decision_score numeric not null default 0,
  source_url text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists career_agent_actions_once_idx
  on public.career_agent_actions(candidate_id, job_fingerprint, action);
create index if not exists career_agent_actions_candidate_created_idx
  on public.career_agent_actions(candidate_id, created_at desc);

alter table public.career_agent_actions enable row level security;
drop policy if exists "career_agent_actions_own_select" on public.career_agent_actions;
drop policy if exists "career_agent_actions_own_insert" on public.career_agent_actions;
create policy "career_agent_actions_own_select" on public.career_agent_actions
  for select to authenticated using ((select auth.uid()) = candidate_id);
create policy "career_agent_actions_own_insert" on public.career_agent_actions
  for insert to authenticated with check ((select auth.uid()) = candidate_id);
grant select, insert on public.career_agent_actions to authenticated;

drop policy if exists "notifications_own_insert" on public.notifications;
create policy "notifications_own_insert" on public.notifications
  for insert to authenticated with check ((select auth.uid()) = profile_id);
grant insert on public.notifications to authenticated;
