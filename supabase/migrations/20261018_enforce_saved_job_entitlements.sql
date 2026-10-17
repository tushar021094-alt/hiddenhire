-- Enforce saved-job limits inside one transaction, serialized per authenticated user.
-- Direct table inserts are revoked so callers cannot bypass the RPC.
create or replace function public.save_job_with_entitlement(p_job jsonb, p_is_native boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_is_plus boolean := false;
  v_count bigint;
  v_existing jsonb;
  v_saved jsonb;
  v_columns text;
  v_select text;
  v_job_id text;
  v_external_job_id text;
  v_payload jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_job is null or jsonb_typeof(p_job) <> 'object' then
    raise exception 'invalid_job_payload' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  v_payload := (p_job - 'id' - 'created_at') || jsonb_build_object(
    'profile_id', v_user_id,
    'external_job_id', case when p_is_native then null else p_job->>'external_job_id' end,
    'job_id', case when p_is_native then p_job->>'job_id' else null end,
    'status', 'saved'
  );
  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'candidate' then
    return jsonb_build_object('forbidden', true);
  end if;
  select coalesce((
    select s.plan_id = 'candidate_plus'
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
    from public.subscriptions s
    where s.profile_id = v_user_id
    order by s.created_at desc
    limit 1
  ), false) into v_is_plus;
  if p_is_native then
    v_job_id := p_job->>'job_id';
    if v_job_id is null then raise exception 'native_job_id_required' using errcode = '22023'; end if;
    select to_jsonb(s) into v_existing from public.saved_jobs s
    where s.profile_id = v_user_id and s.job_id = v_job_id::uuid limit 1;
  else
    v_external_job_id := p_job->>'external_job_id';
    if v_external_job_id is null or v_external_job_id = '' then raise exception 'external_job_id_required' using errcode = '22023'; end if;
    select to_jsonb(s) into v_existing from public.saved_jobs s
    where s.profile_id = v_user_id and s.external_job_id = v_external_job_id limit 1;
  end if;
  if v_existing is not null then
    return jsonb_build_object('savedJob', v_existing, 'created', false);
  end if;
  if not v_is_plus then
    select count(*) into v_count from public.saved_jobs where profile_id = v_user_id;
    if v_count >= 10 then
      return jsonb_build_object('limitReached', true, 'limit', 10, 'used', v_count);
    end if;
  end if;
  -- Insert only known payload columns, preserving defaults for omitted columns.
  select string_agg(format('%I', a.attname), ', ' order by a.attnum),
         string_agg(format('(jsonb_populate_record(null::public.saved_jobs, $1)).%I', a.attname), ', ' order by a.attnum)
    into v_columns, v_select
  from jsonb_object_keys(v_payload) as k(key)
  join pg_attribute a on a.attrelid = 'public.saved_jobs'::regclass
    and a.attname = k.key and a.attnum > 0 and not a.attisdropped
    and k.key = any(array['profile_id','external_job_id','job_id','source','job_url','score','status','title','company','location','remote','salary_min','salary_max','currency']);
  if v_columns is null then raise exception 'no_valid_saved_job_columns' using errcode = '22023'; end if;
  execute format('insert into public.saved_jobs (%s) select %s returning to_jsonb(saved_jobs)', v_columns, v_select)
    into v_saved using v_payload;
  return jsonb_build_object('savedJob', v_saved, 'created', true);
end;
$$;
revoke all on function public.save_job_with_entitlement(jsonb, boolean) from public;
grant execute on function public.save_job_with_entitlement(jsonb, boolean) to authenticated;
revoke insert on public.saved_jobs from authenticated;
revoke insert (profile_id, external_job_id, job_id, source, job_url, score, status) on public.saved_jobs from authenticated;
