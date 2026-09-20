-- HiddenHire persistence foundation
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text,
  role text not null,
  skills text[] default '{}',
  experience_years numeric default 0,
  location text default 'India',
  remote_only boolean default true,
  min_salary_usd numeric default 0,
  created_at timestamptz not null default now()
);

create table if not exists saved_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  external_job_id text not null,
  source text not null,
  job_url text not null,
  score numeric,
  status text not null default 'saved',
  created_at timestamptz not null default now(),
  unique(profile_id, external_job_id)
);

create index if not exists saved_jobs_profile_idx on saved_jobs(profile_id);
