-- Paid-only AI features and monthly per-candidate usage caps.
-- Apply to staging first; Production rollout requires separate approval.
UPDATE public.plans
SET price_minor = 29900, currency = 'INR', name = 'Candidate Plus', active = true
WHERE id = 'candidate_plus' AND audience = 'candidate';

CREATE OR REPLACE FUNCTION public.reserve_candidate_ai_entitlement(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_plan text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_used numeric;
  v_limit numeric := 10;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  IF p_key NOT IN ('ai_resume_imports', 'ai_match_explanations') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ENTITLEMENT');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role IS DISTINCT FROM 'candidate' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  SELECT s.plan_id INTO v_plan
  FROM public.subscriptions AS s
  JOIN public.plans AS p ON p.id = s.plan_id
  WHERE s.profile_id = v_user_id
    AND s.status IN ('active', 'trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
    AND p.audience = 'candidate'
    AND p.active = true
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_plan IS DISTINCT FROM 'candidate_plus' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PLAN_REQUIRED', 'limit', v_limit);
  END IF;

  v_period_start := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_period_end := v_period_start + interval '1 month';

  INSERT INTO public.entitlements
    (profile_id, key, limit_value, used_value, period_start, period_end, metadata)
  VALUES
    (v_user_id, p_key, v_limit, 0, v_period_start, v_period_end, jsonb_build_object('source', 'ai-usage-guard'))
  ON CONFLICT (profile_id, key, period_start) DO NOTHING;

  SELECT used_value INTO v_used
  FROM public.entitlements
  WHERE profile_id = v_user_id AND key = p_key AND period_start = v_period_start
  FOR UPDATE;

  IF COALESCE(v_used, 0) >= v_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'LIMIT_REACHED', 'used', COALESCE(v_used, 0), 'limit', v_limit, 'periodEnd', v_period_end);
  END IF;

  UPDATE public.entitlements
  SET used_value = COALESCE(v_used, 0) + 1,
      limit_value = v_limit,
      period_end = v_period_end,
      updated_at = now()
  WHERE profile_id = v_user_id AND key = p_key AND period_start = v_period_start;

  RETURN jsonb_build_object('ok', true, 'code', 'RESERVED', 'used', COALESCE(v_used, 0) + 1, 'limit', v_limit, 'remaining', v_limit - COALESCE(v_used, 0) - 1, 'periodEnd', v_period_end);
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_candidate_ai_entitlement(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_period_start timestamptz;
  v_used numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF p_key NOT IN ('ai_resume_imports', 'ai_match_explanations') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ENTITLEMENT');
  END IF;
  v_period_start := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  UPDATE public.entitlements
  SET used_value = GREATEST(used_value - 1, 0), updated_at = now()
  WHERE profile_id = v_user_id
    AND key = p_key
    AND period_start = v_period_start
    AND used_value > 0
  RETURNING used_value INTO v_used;

  RETURN jsonb_build_object('ok', true, 'used', COALESCE(v_used, 0));
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_candidate_ai_entitlement(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_candidate_ai_entitlement(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_candidate_ai_entitlement(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_candidate_ai_entitlement(text) TO authenticated;
