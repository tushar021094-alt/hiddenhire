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
  profile_boost_until timestamptz,
  headline text,
  target_roles text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  education jsonb not null default '[]'::jsonb,
  work_experience jsonb not null default '[]'::jsonb,
  certifications text[] not null default '{}',
  resume_summary text,
  recommended_target_roles text[] not null default '{}',
  suggested_salary_min numeric,
  suggested_salary_max numeric,
  suggested_salary_currency text,
  salary_recommendation_rationale text,
  salary_recommendation_confidence text
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
  source_type text not null default 'native' check (source_type in ('native','greenhouse','ashby','lever','workable','careerpage','other')),
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

create table if not exists company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  provider text not null check (provider in ('greenhouse','ashby','lever','workable','workday','structured-jobposting','unknown')),
  identifier text,
  canonical_url text not null,
  careers_url text,
  discovery_confidence text not null default 'low' check (discovery_confidence in ('high','medium','low')),
  status text not null default 'active' check (status in ('active','failing','paused','retired')),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_job_count integer not null default 0 check (last_job_count >= 0),
  last_error text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, identifier, canonical_url)
);

create index if not exists company_sources_company_idx on company_sources(company_id);
create index if not exists company_sources_status_idx on company_sources(status,last_checked_at);

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
  title text,
  company text,
  location text,
  remote boolean,
  salary_min numeric,
  salary_max numeric,
  currency text,
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

create table if not exists public.ai_feature_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null check (feature_key in ('resume_import','resume_job_match')),
  period_start date not null,
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, feature_key, period_start)
);

alter table public.ai_feature_usage enable row level security;
revoke all on table public.ai_feature_usage from anon, authenticated;

insert into plans(id,audience,name,price_minor,currency) values
 ('candidate_free','candidate','Free',0,'INR'),
 ('candidate_plus','candidate','Candidate Plus',29900,'INR'),
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

-- Role helper used by private recruiter verification storage policies.
-- Keep the function's lookup pinned to a trusted schema and make it callable
-- only by authenticated users whose policies use the result.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select profile.role
  from public.profiles as profile
  where profile.id = auth.uid()
  limit 1;
$function$;

revoke all on function public.current_profile_role() from public, anon;
grant execute on function public.current_profile_role() to authenticated;



-- Candidate Plus-only, server-metered AI usage for cost-controlled paid features.
create or replace function public.consume_candidate_ai_quota(p_feature_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_plan_id text;
  v_period_end timestamptz;
  v_limit integer;
  v_period_start date := date_trunc('month', now() at time zone 'UTC')::date;
  v_used integer;
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'authentication_required');
  end if;

  v_limit := case p_feature_key
    when 'resume_import' then 5
    when 'resume_job_match' then 10
    else null
  end;
  if v_limit is null then
    return jsonb_build_object('allowed', false, 'reason', 'unsupported_feature');
  end if;

  select p.role into v_role
  from public.profiles as p
  where p.id = v_user_id;
  if v_role is distinct from 'candidate' then
    return jsonb_build_object('allowed', false, 'reason', 'candidate_only');
  end if;

  select s.plan_id, s.current_period_end
  into v_plan_id, v_period_end
  from public.subscriptions as s
  where s.profile_id = v_user_id
    and s.status in ('active','trialing')
  order by s.created_at desc
  limit 1;

  if not found
     or v_plan_id is distinct from 'candidate_plus'
     or (v_period_end is not null and v_period_end <= now()) then
    return jsonb_build_object('allowed', false, 'reason', 'upgrade_required', 'limit', v_limit, 'used', 0);
  end if;

  insert into public.ai_feature_usage (profile_id, feature_key, period_start, used_count, updated_at)
  values (v_user_id, p_feature_key, v_period_start, 1, now())
  on conflict (profile_id, feature_key, period_start)
  do update
    set used_count = public.ai_feature_usage.used_count + 1,
        updated_at = now()
    where public.ai_feature_usage.used_count < v_limit
  returning used_count into v_used;

  if v_used is null then
    select u.used_count into v_used
    from public.ai_feature_usage as u
    where u.profile_id = v_user_id
      and u.feature_key = p_feature_key
      and u.period_start = v_period_start;

    return jsonb_build_object('allowed', false, 'reason', 'monthly_limit_reached', 'limit', v_limit, 'used', coalesce(v_used, v_limit));
  end if;

  return jsonb_build_object('allowed', true, 'reason', 'allowed', 'limit', v_limit, 'used', v_used, 'remaining', v_limit - v_used);
end;
$function$;

revoke all on function public.consume_candidate_ai_quota(text) from public, anon;
grant execute on function public.consume_candidate_ai_quota(text) to authenticated;
