create table if not exists public.career_execution_tasks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 application_id uuid references public.applications(id) on delete set null,
 operation_id text,
 action text not null check (action in ('prepare','follow_up','review','apply')),
 state text not null default 'awaiting_approval' check (state in ('queued','awaiting_approval','approved','executing','completed','failed','cancelled')),
 title text not null, summary text not null, requires_approval boolean not null default true,
 attempts integer not null default 0, max_attempts integer not null default 3, last_error text,
 approved_at timestamptz, started_at timestamptz, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.career_execution_tasks enable row level security;
grant select,insert,update on public.career_execution_tasks to authenticated;
grant select,insert,update,delete on public.career_execution_tasks to service_role;
create index if not exists career_execution_tasks_user_state_idx on public.career_execution_tasks(user_id,state,created_at desc);
create policy career_execution_tasks_select_own on public.career_execution_tasks for select to authenticated using ((select auth.uid())=user_id);
create policy career_execution_tasks_insert_own on public.career_execution_tasks for insert to authenticated with check ((select auth.uid())=user_id);
create policy career_execution_tasks_update_own on public.career_execution_tasks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);