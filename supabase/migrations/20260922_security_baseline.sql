-- HiddenHire marketplace security baseline.
-- All application data is accessed through authenticated server routes/admin clients.
-- The service key bypasses RLS and must remain server-only.

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.agency_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.company_sources enable row level security;
alter table public.applications enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.matches enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.contact_unlocks enable row level security;
alter table public.verification_records enable row level security;
alter table public.moderation_events enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

-- No permissive anon/authenticated policies are created here.
-- Add least-privilege policies when browser-side table access is introduced.
