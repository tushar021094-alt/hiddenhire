create table if not exists public.job_watch_observations (
  watch_id uuid not null references public.job_watches(id) on delete cascade,
  job_fingerprint text not null,
  last_seen_at timestamptz not null default now(),
  score numeric not null default 0,
  salary_min numeric,
  salary_max numeric,
  location text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (watch_id, job_fingerprint)
);

create index if not exists job_watch_observations_watch_seen_idx
  on public.job_watch_observations(watch_id, last_seen_at desc);

alter table public.job_watch_observations enable row level security;

drop policy if exists "job_watch_observations_own_select" on public.job_watch_observations;
create policy "job_watch_observations_own_select"
  on public.job_watch_observations
  for select to authenticated
  using (
    exists (
      select 1 from public.job_watches
      where job_watches.id = job_watch_observations.watch_id
        and job_watches.candidate_id = (select auth.uid())
    )
  );

grant select on public.job_watch_observations to authenticated;