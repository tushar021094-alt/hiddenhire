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

update public.plans
set price_minor = 29900, name = 'Candidate Plus', currency = 'INR', active = true
where id = 'candidate_plus' and audience = 'candidate';
