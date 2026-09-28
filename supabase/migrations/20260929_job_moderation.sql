-- HiddenHire V1 job publishing/moderation foundation.
--
-- Scope (intentionally narrow):
--   * Native recruiter jobs keep entering the system as status = 'pending_review'
--     (see supabase/migrations/20260924_recruiter_job_creation.sql and
--      app/api/recruiter/jobs/route.ts). This file does not change that path.
--   * Adds an admin-only, database-authorized moderation path that can publish
--     or reject a pending_review native India job and write moderation history.
--   * Adds NO write grants on public.jobs, public.moderation_events or
--     public.audit_events for `anon`/`authenticated`. Every moderation write
--     happens inside a SECURITY DEFINER function that verifies the caller's role
--     against public.profiles. A client-supplied role is never trusted.
--
-- Out of scope on purpose: payments, entitlements/quota consumption, candidate
-- matching/search policy, the existing recruiter RPCs, admin signup, admin UI.
--
-- Apply AFTER:
--   supabase/schema.sql
--   supabase/migrations/20260923_candidate_onboarding.sql
--   supabase/migrations/20260924_security_foundation.sql
--   supabase/migrations/20260924_recruiter_job_creation.sql
--   supabase/migrations/20260928_job_function.sql
--   supabase/migrations/20260928_recruiter_match_rpc.sql
--
-- Live-schema note: this file is written against the repository definitions of
-- public.jobs / public.moderation_events / public.audit_events /
-- public.notifications / public.subscriptions / public.profiles. It adds no
-- column, drops no table and rewrites no existing policy, so it stays compatible
-- with a live database that carries additional columns or defaults.
--
-- Admin accounts stay manually provisioned in V1 (no admin signup flow):
--   update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
-- public.handle_new_user() intentionally coerces unknown signup roles to
-- 'candidate', so this migration adds no way to self-assign the admin role.

-- ---------------------------------------------------------------------------
-- 1. Server-side admin authorization primitive.
-- ---------------------------------------------------------------------------
-- Used by the moderation RPCs below (authoritative) and by the admin-only read
-- policies (convenience). It only ever answers "is the current JWT subject an
-- admin", so exposing EXECUTE to authenticated users leaks nothing.

create or replace function public.is_hiddenhire_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  );
$$;

comment on function public.is_hiddenhire_admin() is
  'True only when the current auth.uid() has role = admin in public.profiles. Moderation writes are authorized database-side; client-supplied roles are ignored.';

revoke all on function public.is_hiddenhire_admin() from public, anon;
grant execute on function public.is_hiddenhire_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Existing V1 job validity rules, resolved server-side.
-- ---------------------------------------------------------------------------
-- The application rule lives in lib/marketplace.ts (NATIVE_JOB_DAYS / jobValidityDays)
-- and is frozen in docs/PRODUCT-SPEC-V1.0.md section 6:
--   Employer Free -> 15-day job validity, paid employer plans -> 30-day validity.
-- The plan for a job owner is resolved like lib/entitlements.ts planForAudience()
-- (in-force subscription first, audience fallback otherwise). These helpers exist
-- because the employer's subscription row is not readable through RLS by an admin
-- session, so the calculation must happen inside the database.

create or replace function public.v1_job_validity_days(p_plan_id text)
returns integer
language sql
immutable
as $$
  select case when coalesce(p_plan_id, 'employer_free') = 'employer_free' then 15 else 30 end;
$$;

comment on function public.v1_job_validity_days(text) is
  'V1 native job validity window in days. Mirrors lib/marketplace.ts jobValidityDays() and PRODUCT-SPEC-V1.0 section 6.';

create or replace function public.v1_current_plan_id(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  in_force_plan_id text;
  owner_role text;
begin
  if p_profile_id is null then
    return null;
  end if;

  select subscription.plan_id
    into in_force_plan_id
  from public.subscriptions as subscription
  where subscription.profile_id = p_profile_id
    and subscription.status in ('trialing', 'active')
  order by subscription.created_at desc
  limit 1;

  if in_force_plan_id is not null then
    return in_force_plan_id;
  end if;

  select profile.role into owner_role
  from public.profiles as profile
  where profile.id = p_profile_id;

  -- Mirrors the planForAudience() fallback in lib/entitlements.ts.
  return case when owner_role = 'agency' then 'agency' else 'employer_free' end;
end;
$$;

comment on function public.v1_current_plan_id(uuid) is
  'Plan in force for a profile: latest active/trialing subscription plan_id, else the audience fallback plan used by lib/entitlements.ts.';

revoke all on function public.v1_job_validity_days(text) from public, anon, authenticated;
revoke all on function public.v1_current_plan_id(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Publish a pending_review native India job (admin only).
-- ---------------------------------------------------------------------------
-- Call site: app/api/admin/jobs/moderate/route.ts
--   rpc('admin_publish_job', { p_job_id })

drop function if exists public.admin_publish_job(uuid);

create function public.admin_publish_job(p_job_id uuid)
returns table (
  job_id uuid,
  job_status text,
  published_at timestamptz,
  expires_at timestamptz,
  validity_days integer,
  plan_id text,
  moderation_event_id uuid,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  moderation_job public.jobs%rowtype;
  resolved_plan_id text;
  resolved_validity_days integer;
  resolved_published_at timestamptz;
  resolved_expires_at timestamptz;
  event_id uuid;
  audit_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select profile.role into actor_role
  from public.profiles as profile
  where profile.id = actor_id;

  if actor_role is null then
    raise exception using errcode = '42501', message = 'A HiddenHire profile is required.';
  end if;

  -- Employers and agencies can never publish (or self-publish) their own job.
  -- Publishing is an admin-only moderation action.
  if actor_role <> 'admin' then
    raise exception using errcode = '42501',
      message = 'Admin access is required to publish a job.';
  end if;

  if p_job_id is null then
    raise exception using errcode = '22023', message = 'A job id is required.';
  end if;

  select job.* into moderation_job
  from public.jobs as job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The requested job could not be found.';
  end if;

  if moderation_job.status is distinct from 'pending_review' then
    raise exception using errcode = '22023',
      message = 'Only jobs pending review can be published. Current status: '
        || coalesce(moderation_job.status, 'unknown') || '.';
  end if;

  if moderation_job.source_type is distinct from 'native' then
    raise exception using errcode = '42501',
      message = 'Only HiddenHire native jobs can be published through moderation.';
  end if;

  if lower(btrim(coalesce(moderation_job.country, ''))) <> 'india' then
    raise exception using errcode = '22023',
      message = 'Only native India jobs can be published.';
  end if;

  if nullif(btrim(coalesce(moderation_job.title, '')), '') is null
     or nullif(btrim(coalesce(moderation_job.description, '')), '') is null then
    raise exception using errcode = '22023',
      message = 'A job requires a title and a description before it can be published.';
  end if;

  -- Existing V1 validity rule, resolved from the job owner's plan.
  resolved_plan_id := public.v1_current_plan_id(moderation_job.posted_by);
  resolved_validity_days := public.v1_job_validity_days(resolved_plan_id);
  resolved_published_at := now();
  resolved_expires_at := resolved_published_at + make_interval(days => resolved_validity_days);

  update public.jobs as job
  set status = 'published',
      published_at = resolved_published_at,
      expires_at = resolved_expires_at,
      updated_at = resolved_published_at
  where job.id = moderation_job.id;

  insert into public.moderation_events (job_id, actor_id, action, reason, metadata)
  values (
    moderation_job.id,
    actor_id,
    'publish',
    null,
    jsonb_build_object(
      'previous_status', moderation_job.status,
      'new_status', 'published',
      'source_type', moderation_job.source_type,
      'country', moderation_job.country,
      'plan_id', resolved_plan_id,
      'validity_days', resolved_validity_days,
      'published_at', resolved_published_at,
      'expires_at', resolved_expires_at
    )
  )
  returning id into event_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor_id,
    'job.published',
    'job',
    moderation_job.id::text,
    jsonb_build_object(
      'previous_status', moderation_job.status,
      'new_status', 'published',
      'moderation_event_id', event_id,
      'plan_id', resolved_plan_id,
      'validity_days', resolved_validity_days,
      'published_at', resolved_published_at,
      'expires_at', resolved_expires_at
    )
  )
  returning id into audit_id;

  -- Employer moderation/status notification (PRODUCT-SPEC-V1.0 section 16).
  if moderation_job.posted_by is not null then
    insert into public.notifications (profile_id, type, title, body, data)
    values (
      moderation_job.posted_by,
      'job_moderation',
      'Your job is live on HiddenHire',
      format(
        '"%s" passed moderation review and is now published for %s days.',
        moderation_job.title,
        resolved_validity_days
      ),
      jsonb_build_object(
        'job_id', moderation_job.id::text,
        'status', 'published',
        'moderation_event_id', event_id,
        'audit_event_id', audit_id
      )
    );
  end if;

  return query
  select
    moderation_job.id,
    'published'::text,
    resolved_published_at,
    resolved_expires_at,
    resolved_validity_days,
    resolved_plan_id,
    event_id,
    audit_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reject a pending_review native job (admin only, reason optional).
-- ---------------------------------------------------------------------------
-- Call site: app/api/admin/jobs/moderate/route.ts
--   rpc('admin_reject_job', { p_job_id, p_reason })
-- The rejection reason is stored on public.moderation_events.reason (the reason
-- column that already exists in the schema) and surfaced to the job owner
-- through the moderation notification. public.jobs gains no new column.

drop function if exists public.admin_reject_job(uuid, text);

create function public.admin_reject_job(p_job_id uuid, p_reason text default null)
returns table (
  job_id uuid,
  job_status text,
  rejection_reason text,
  moderation_event_id uuid,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  moderation_job public.jobs%rowtype;
  resolved_reason text;
  event_id uuid;
  audit_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select profile.role into actor_role
  from public.profiles as profile
  where profile.id = actor_id;

  if actor_role is null then
    raise exception using errcode = '42501', message = 'A HiddenHire profile is required.';
  end if;

  -- Rejection is a moderation action. Employers/agencies cannot reject either
  -- their own jobs or anybody else's.
  if actor_role <> 'admin' then
    raise exception using errcode = '42501',
      message = 'Admin access is required to reject a job.';
  end if;

  if p_job_id is null then
    raise exception using errcode = '22023', message = 'A job id is required.';
  end if;

  select job.* into moderation_job
  from public.jobs as job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The requested job could not be found.';
  end if;

  if moderation_job.status is distinct from 'pending_review' then
    raise exception using errcode = '22023',
      message = 'Only jobs pending review can be rejected. Current status: '
        || coalesce(moderation_job.status, 'unknown') || '.';
  end if;

  if moderation_job.source_type is distinct from 'native' then
    raise exception using errcode = '42501',
      message = 'Only HiddenHire native jobs can be rejected through moderation.';
  end if;

  resolved_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if resolved_reason is not null and char_length(resolved_reason) > 500 then
    raise exception using errcode = '22023',
      message = 'The rejection reason must be 500 characters or fewer.';
  end if;

  -- rejected jobs are hidden from the candidate marketplace by the existing RLS
  -- read policy on public.jobs (status = 'published' or posted_by = auth.uid())
  -- and by the native job source filter (source_type = 'native' and
  -- status = 'published').
  update public.jobs as job
  set status = 'rejected',
      updated_at = now()
  where job.id = moderation_job.id;

  insert into public.moderation_events (job_id, actor_id, action, reason, metadata)
  values (
    moderation_job.id,
    actor_id,
    'reject',
    resolved_reason,
    jsonb_build_object(
      'previous_status', moderation_job.status,
      'new_status', 'rejected',
      'source_type', moderation_job.source_type,
      'country', moderation_job.country
    )
  )
  returning id into event_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor_id,
    'job.rejected',
    'job',
    moderation_job.id::text,
    jsonb_build_object(
      'previous_status', moderation_job.status,
      'new_status', 'rejected',
      'reason', resolved_reason,
      'moderation_event_id', event_id
    )
  )
  returning id into audit_id;

  -- Employer moderation/status notification (PRODUCT-SPEC-V1.0 section 16).
  if moderation_job.posted_by is not null then
    insert into public.notifications (profile_id, type, title, body, data)
    values (
      moderation_job.posted_by,
      'job_moderation',
      'Your job was not approved',
      case
        when resolved_reason is null then
          format('"%s" was not approved by moderation.', moderation_job.title)
        else
          format(
            '"%s" was not approved by moderation. Reason: %s',
            moderation_job.title,
            resolved_reason
          )
      end,
      jsonb_build_object(
        'job_id', moderation_job.id::text,
        'status', 'rejected',
        'reason', resolved_reason,
        'moderation_event_id', event_id,
        'audit_event_id', audit_id
      )
    );
  end if;

  return query
  select
    moderation_job.id,
    'rejected'::text,
    resolved_reason,
    event_id,
    audit_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Function privileges.
-- ---------------------------------------------------------------------------
-- `public` is revoked first because PostgreSQL grants EXECUTE to PUBLIC on newly
-- created functions. Authenticated users may *call* the moderation RPCs, but the
-- database-side role check inside each function decides whether anything happens;
-- employers/agencies receive 42501 ("Admin access is required ...").

revoke all on function public.admin_publish_job(uuid) from public, anon, authenticated;
grant execute on function public.admin_publish_job(uuid) to authenticated;

revoke all on function public.admin_reject_job(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_reject_job(uuid, text) to authenticated;

comment on function public.admin_publish_job(uuid) is
  'HiddenHire V1 admin moderation: publishes a native India job that is pending_review, sets published_at and expires_at (existing V1 validity rule), and writes moderation_events, audit_events and an employer notification. Admin-only, enforced database-side.';

comment on function public.admin_reject_job(uuid, text) is
  'HiddenHire V1 admin moderation: rejects a native job that is pending_review, records the optional reason on moderation_events, and writes audit_events and an employer notification. Rejected jobs stay hidden from the candidate marketplace. Admin-only, enforced database-side.';

-- ---------------------------------------------------------------------------
-- 6. Read-only admin visibility (moderation queue / audit inspection).
-- ---------------------------------------------------------------------------
-- These policies are additive and read-only. They change nothing for `anon`,
-- candidates, employers or agencies, and they grant no INSERT/UPDATE to anyone.
-- public.jobs keeps its existing grants (select only for anon/authenticated) and
-- its existing update surface (none), so employers and agencies still cannot
-- self-publish.

drop policy if exists jobs_select_admin on public.jobs;
create policy jobs_select_admin on public.jobs
  for select to authenticated
  using (public.is_hiddenhire_admin());

drop policy if exists moderation_events_select_admin on public.moderation_events;
create policy moderation_events_select_admin on public.moderation_events
  for select to authenticated
  using (public.is_hiddenhire_admin());

drop policy if exists audit_events_select_admin on public.audit_events;
create policy audit_events_select_admin on public.audit_events
  for select to authenticated
  using (public.is_hiddenhire_admin());

-- public.moderation_events and public.audit_events were revoked from
-- anon/authenticated by 20260924_security_foundation.sql. Only SELECT is granted
-- back, and only admins can see rows because of the policies above.
grant select on public.moderation_events to authenticated;
grant select on public.audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Deliberate non-grants (documented so they are not "fixed" later).
-- ---------------------------------------------------------------------------
--   * No `grant insert`/`update`/`delete` on public.moderation_events or
--     public.audit_events for anon/authenticated: moderation history is written
--     exclusively by the SECURITY DEFINER RPCs above.
--   * No `grant update` on public.jobs for anon/authenticated and no `for update`
--     policy on public.jobs: a job status transition is only reachable through
--     the admin moderation RPCs.
--   * No admin write path on public.jobs outside these two RPCs, and no admin
--     signup flow. Admin accounts are provisioned manually:
--       update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
--
-- Not covered here (out of V1 scope for this task): automated duplicate/fraud
-- screening of pending jobs, credit/entitlement consumption on publish, take-down
-- of already-published jobs, and any admin dashboard UI.