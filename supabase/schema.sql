-- HiddenHire V1.0 marketplace foundation
-- Designed for Supabase/Postgres. Apply after enabling pgcrypto if needed.
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  role text not null check (role in ('candidate','employer','agency','admin')),
  full_name text,
  skills text[] not null default '{}',
  experience_years numeric not null default 0 check (experience_years >= 0),
  location text,
  country text,
  remote_only boolean not null default false,
  min_salary numeric not null default 0 check (min_salary >= 0),
  salary_currency text not null default 'INR',
  visibility text not null default 'match_only' check (visibility in ('public','match_only','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  email_domain text,
  country text,
  description text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','suspended')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists employer_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  designation text,
  recruiter_verified boolean not null default false
);

create table if not exists candidate_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  resume_url text,
  job_search_mode text not null default 'active' check (job_search_mode in ('active','passive','not_looking')),
  profile_boost_until timestamptz
);

create table if not exists agency_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  agency_name text not null,
  verified boolean not null default false
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  posted_by uuid references profiles(id) on delete set null,
  source_type text not null default 'native' check (source_type in ('native','greenhouse','ashby','lever','other')),
  external_job_id text,
  title text not null,
  description text not null,
  location text,
  city text,
  region text,
  country text,
  remote boolean not null default false,
  workplace_type text not null default 'Unknown' check (workplace_type in ('Remote','Hybrid','On-site','Unknown')),
  salary_min numeric,
  salary_max numeric,
  currency text,
  experience_min numeric,
  experience_max numeric,
  status text not null default 'pending_review' check (status in ('draft','pending_review','published','paused','expired','rejected','closed')),
  visibility text not null default 'standard' check (visibility in ('standard','featured')),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_type, external_job_id)
);

create index if not exists jobs_status_idx on jobs(status);
create index if not exists jobs_company_idx on jobs(company_id);
create index if not exists jobs_location_idx on jobs(country, region, city);
create index if not exists jobs_posted_idx on jobs(published_at desc);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied','reviewing','shortlisted','interview','rejected','hired','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, candidate_id)
);

create index if not exists applications_candidate_idx on applications(candidate_id);
create index if not exists applications_job_idx on applications(job_id);

create table if not exists saved_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  external_job_id text,
  job_id uuid references jobs(id) on delete cascade,
  source text,
  job_url text,
  score numeric,
  status text not null default 'saved',
  created_at timestamptz not null default now(),
  check (job_id is not null or external_job_id is not null),
  unique(profile_id, external_job_id)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  candidate_id uuid not null references profiles(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 100),
  reasons jsonb not null default '[]',
  gaps jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique(job_id, candidate_id)
);

create index if not exists matches_candidate_score_idx on matches(candidate_id, score desc);
create index if not exists matches_job_score_idx on matches(job_id, score desc);

create table if not exists plans (
  id text primary key,
  audience text not null check (audience in ('candidate','employer','agency')),
  name text not null,
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'INR',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  plan_id text not null references plans(id),
  status text not null default 'active' check (status in ('trialing','active','past_due','cancelled','expired')),
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_profile_idx on subscriptions(profile_id);

create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  key text not null,
  limit_value numeric,
  used_value numeric not null default 0,
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, key, period_start)
);

create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  credit_type text not null,
  amount integer not null,
  reason text not null,
  reference_id text,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists contact_unlocks (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references profiles(id) on delete cascade,
  candidate_id uuid not null references profiles(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(employer_id, candidate_id, job_id)
);

create table if not exists verification_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  verification_type text not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  evidence jsonb not null default '{}',
  reviewed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists moderation_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  job_id uuid references jobs(id) on delete cascade,
  target_profile_id uuid references profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

insert into plans(id,audience,name,price_minor,currency) values
 ('candidate_free','candidate','Free',0,'INR'),
 ('candidate_plus','candidate','Plus',19900,'INR'),
 ('employer_free','employer','Free',0,'INR'),
 ('employer_starter','employer','Starter',199900,'INR'),
 ('employer_growth','employer','Growth',499900,'INR')
on conflict (id) do update set name=excluded.name, price_minor=excluded.price_minor, currency=excluded.currency, active=true;

-- Seed entitlement definitions. Actual user entitlements are created by application logic.
create index if not exists entitlements_profile_key_idx on entitlements(profile_id,key);
create index if not exists credit_ledger_profile_type_idx on credit_ledger(profile_id,credit_type,created_at desc);
create index if not exists notifications_profile_read_idx on notifications(profile_id,read_at,created_at desc);
create index if not exists audit_events_entity_idx on audit_events(entity_type,entity_id,created_at desc);

-- RLS should be enabled and policies bound to auth.uid() when Supabase Auth is connected.
-- This migration intentionally does not create permissive policies.
