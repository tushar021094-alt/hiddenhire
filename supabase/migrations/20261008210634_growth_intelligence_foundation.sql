-- Establish the privacy-aware growth analytics event stream.
create table if not exists public.growth_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'landing_view',
    'search_started',
    'auth_prompt_shown',
    'match_results_viewed',
    'application_click',
    'signup_started',
    'signup_completed',
    'login_completed',
    'job_post_started',
    'job_post_completed'
  )),
  profile_id uuid references public.profiles(id) on delete set null,
  session_id text check (
    session_id is null
    or (char_length(session_id) >= 8 and char_length(session_id) <= 128)
  ),
  path text,
  referrer text,
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists growth_events_created_at_idx
  on public.growth_events(created_at desc);
create index if not exists growth_events_event_name_created_at_idx
  on public.growth_events(event_name, created_at desc);
create index if not exists growth_events_profile_id_created_at_idx
  on public.growth_events(profile_id, created_at desc);

alter table public.growth_events enable row level security;
