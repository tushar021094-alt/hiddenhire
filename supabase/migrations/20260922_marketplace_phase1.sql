-- HiddenHire marketplace phase 1
-- Run this once in Supabase SQL Editor after deploying this branch.

alter table public.candidate_profiles
  add column if not exists target_role text;

create index if not exists candidate_profiles_target_role_idx
  on public.candidate_profiles(target_role);

-- Native jobs created by recruiters need the application URL stored.
alter table public.jobs
  add column if not exists application_url text;

-- Keep profile ids aligned with Supabase Auth for newly created accounts.
-- Existing rows are left untouched so this migration is non-destructive.
