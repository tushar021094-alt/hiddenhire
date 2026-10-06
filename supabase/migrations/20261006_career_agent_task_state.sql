alter table public.career_agent_actions
  add column if not exists task_status text not null default 'open'
    check (task_status in ('open','completed','dismissed')),
  add column if not exists completed_at timestamptz;

create index if not exists career_agent_actions_candidate_status_idx
  on public.career_agent_actions(candidate_id, task_status, created_at desc);

drop policy if exists "career_agent_actions_own_update" on public.career_agent_actions;
create policy "career_agent_actions_own_update" on public.career_agent_actions
  for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);

grant update on public.career_agent_actions to authenticated;
