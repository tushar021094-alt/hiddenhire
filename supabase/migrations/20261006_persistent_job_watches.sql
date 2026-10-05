create table if not exists public.job_watches (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  query text,
  target_roles text[] not null default '{}'::text[],
  preferred_locations text[] not null default '{}'::text[],
  preferred_countries text[] not null default '{}'::text[],
  skills text[] not null default '{}'::text[],
  minimum_salary numeric not null default 0 check (minimum_salary >= 0),
  currency text not null default 'INR',
  remote_only boolean not null default false,
  min_match_score integer not null default 70 check (min_match_score between 0 and 100),
  enabled boolean not null default true,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_watches_candidate_idx on public.job_watches(candidate_id);
create index if not exists job_watches_enabled_scan_idx on public.job_watches(enabled, last_scanned_at desc);

create table if not exists public.job_watch_events (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.job_watches(id) on delete cascade,
  job_fingerprint text not null,
  event_type text not null check (event_type in ('new','score_increase','salary_change','location_change','reopened')),
  previous_score numeric,
  current_score numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_watch_events_watch_created_idx on public.job_watch_events(watch_id, created_at desc);
create index if not exists job_watch_events_fingerprint_idx on public.job_watch_events(watch_id, job_fingerprint, created_at desc);

alter table public.job_watches enable row level security;
alter table public.job_watch_events enable row level security;

create policy "job_watches_own_select" on public.job_watches for select to authenticated
  using ((select auth.uid()) = candidate_id);
create policy "job_watches_own_insert" on public.job_watches for insert to authenticated
  with check ((select auth.uid()) = candidate_id);
create policy "job_watches_own_update" on public.job_watches for update to authenticated
  using ((select auth.uid()) = candidate_id)
  with check ((select auth.uid()) = candidate_id);
create policy "job_watches_own_delete" on public.job_watches for delete to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "job_watch_events_own_select" on public.job_watch_events for select to authenticated
  using (exists (select 1 from public.job_watches w where w.id = watch_id and w.candidate_id = (select auth.uid())));
create policy "job_watch_events_own_insert" on public.job_watch_events for insert to authenticated
  with check (exists (select 1 from public.job_watches w where w.id = watch_id and w.candidate_id = (select auth.uid())));
create policy "job_watch_events_own_update" on public.job_watch_events for update to authenticated
  using (exists (select 1 from public.job_watches w where w.id = watch_id and w.candidate_id = (select auth.uid())))
  with check (exists (select 1 from public.job_watches w where w.id = watch_id and w.candidate_id = (select auth.uid())));
create policy "job_watch_events_own_delete" on public.job_watch_events for delete to authenticated
  using (exists (select 1 from public.job_watches w where w.id = watch_id and w.candidate_id = (select auth.uid())));

grant select, insert, update, delete on public.job_watches to authenticated;
grant select, insert, update, delete on public.job_watch_events to authenticated;
