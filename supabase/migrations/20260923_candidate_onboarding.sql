/* Candidate onboarding fields used by the AI matching layer. */
alter table public.candidate_profiles
  add column if not exists headline text,
  add column if not exists target_roles text[] not null default '{}',
  add column if not exists preferred_locations text[] not null default '{}';

create index if not exists candidate_profiles_target_roles_idx
  on public.candidate_profiles using gin(target_roles);
