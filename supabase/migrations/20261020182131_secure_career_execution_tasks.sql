-- Make career-task approval guarantees enforceable at the database boundary.
-- Authenticated clients may read only their own tasks; mutations must use the
-- owner-checked RPCs below so RLS cannot be bypassed with a crafted table update.
-- Review-only: this migration has not been applied to Production.

-- Existing pending side-effecting tasks must be re-approved before execution.
UPDATE public.career_execution_tasks
SET requires_approval = true,
    state = 'awaiting_approval',
    approved_at = NULL,
    started_at = NULL,
    completed_at = NULL,
    updated_at = now()
WHERE action IN ('apply', 'follow_up')
  AND state IN ('queued', 'awaiting_approval', 'approved', 'executing');

-- The API uses operation ids for idempotency. This also prevents concurrent
-- duplicate active tasks, with per-user advisory locks in the create RPC.
CREATE UNIQUE INDEX IF NOT EXISTS career_execution_tasks_one_active_operation
  ON public.career_execution_tasks (user_id, operation_id)
  WHERE operation_id IS NOT NULL
    AND state IN ('queued', 'awaiting_approval', 'approved', 'executing');

-- Revoke direct table mutation so authenticated callers cannot forge a task's
-- state, approval timestamp, user id, attempt count, or executor metadata.
REVOKE ALL ON TABLE public.career_execution_tasks FROM anon, authenticated;
GRANT SELECT ON TABLE public.career_execution_tasks TO authenticated;

-- Also clear any lingering column-level DML grants.
REVOKE INSERT (id, user_id, application_id, operation_id, action, state, title, summary, requires_approval, attempts, max_attempts, last_error, approved_at, started_at, completed_at, created_at, updated_at)
  ON TABLE public.career_execution_tasks FROM anon, authenticated;
REVOKE UPDATE (id, user_id, application_id, operation_id, action, state, title, summary, requires_approval, attempts, max_attempts, last_error, approved_at, started_at, completed_at, created_at, updated_at)
  ON TABLE public.career_execution_tasks FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_career_execution_task(
  p_action text,
  p_title text,
  p_summary text,
  p_requires_approval boolean DEFAULT true,
  p_application_id uuid DEFAULT NULL,
  p_operation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_summary text := btrim(coalesce(p_summary, ''));
  v_operation_id text := nullif(btrim(coalesce(p_operation_id, '')), '');
  v_requires_approval boolean;
  v_state text;
  v_task public.career_execution_tasks%rowtype;
BEGIN
  IF actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED');
  END IF;

  SELECT profile.role INTO actor_role
  FROM public.profiles AS profile
  WHERE profile.id = actor_id;

  IF actor_role IS DISTINCT FROM 'candidate' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  IF v_action NOT IN ('prepare', 'follow_up', 'review', 'apply') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTION');
  END IF;
  IF v_title = '' OR length(v_title) > 180 OR v_summary = '' OR length(v_summary) > 3000 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TEXT');
  END IF;
  IF v_operation_id IS NOT NULL AND length(v_operation_id) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_OPERATION_ID');
  END IF;

  IF p_application_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.applications AS application
    WHERE application.id = p_application_id
      AND application.candidate_id = actor_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'APPLICATION_NOT_FOUND');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));

  IF v_operation_id IS NOT NULL THEN
    SELECT task.* INTO v_task
    FROM public.career_execution_tasks AS task
    WHERE task.user_id = actor_id
      AND task.operation_id = v_operation_id
      AND task.state IN ('queued', 'awaiting_approval', 'approved', 'executing')
    ORDER BY task.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'code', 'OK',
        'deduplicated', true,
        'task', to_jsonb(v_task)
      );
    END IF;
  END IF;

  -- External side effects are always approval-gated; clients cannot override this.
  v_requires_approval := coalesce(p_requires_approval, true)
    OR v_action IN ('apply', 'follow_up');
  v_state := CASE WHEN v_requires_approval THEN 'awaiting_approval' ELSE 'queued' END;

  INSERT INTO public.career_execution_tasks (
    user_id, application_id, operation_id, action, state, title, summary,
    requires_approval, max_attempts
  ) VALUES (
    actor_id, p_application_id, v_operation_id, v_action, v_state, v_title, v_summary,
    v_requires_approval, 3
  )
  RETURNING * INTO v_task;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'deduplicated', false,
    'task', to_jsonb(v_task)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_career_execution_task(
  p_task_id uuid,
  p_event text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text;
  v_task public.career_execution_tasks%rowtype;
  v_state text;
  v_now timestamptz := clock_timestamp();
  v_attempts integer;
BEGIN
  IF actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED');
  END IF;

  SELECT profile.role INTO actor_role
  FROM public.profiles AS profile
  WHERE profile.id = actor_id;

  IF actor_role IS DISTINCT FROM 'candidate' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  IF p_task_id IS NULL OR p_event NOT IN ('approve', 'start', 'complete', 'fail', 'cancel') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_EVENT');
  END IF;

  SELECT task.* INTO v_task
  FROM public.career_execution_tasks AS task
  WHERE task.id = p_task_id
    AND task.user_id = actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  v_state := v_task.state;
  v_attempts := v_task.attempts;

  IF p_event = 'approve' AND v_task.state = 'awaiting_approval' AND v_task.requires_approval THEN
    v_state := 'approved';
  ELSIF p_event = 'start'
    AND v_task.state = 'approved'
    AND v_task.approved_at IS NOT NULL
  THEN
    v_state := 'executing';
  ELSIF p_event = 'start'
    AND v_task.state = 'queued'
    AND NOT v_task.requires_approval
    AND v_task.action NOT IN ('apply', 'follow_up')
  THEN
    v_state := 'executing';
  ELSIF p_event = 'complete' AND v_task.state = 'executing' THEN
    v_state := 'completed';
  ELSIF p_event = 'fail' AND v_task.state = 'executing' THEN
    v_state := 'failed';
    v_attempts := least(coalesce(v_task.attempts, 0) + 1, coalesce(v_task.max_attempts, 3));
  ELSIF p_event = 'cancel' AND v_task.state NOT IN ('completed', 'cancelled') THEN
    v_state := 'cancelled';
  ELSE
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION');
  END IF;

  UPDATE public.career_execution_tasks
  SET state = v_state,
      approved_at = CASE WHEN p_event = 'approve' THEN v_now ELSE approved_at END,
      started_at = CASE WHEN p_event = 'start' THEN v_now ELSE started_at END,
      completed_at = CASE WHEN p_event = 'complete' THEN v_now ELSE completed_at END,
      last_error = CASE WHEN p_event = 'fail' THEN 'Execution failed during a user-requested task.' ELSE last_error END,
      attempts = v_attempts,
      updated_at = v_now
  WHERE id = v_task.id
  RETURNING * INTO v_task;

  RETURN jsonb_build_object('ok', true, 'code', 'OK', 'task', to_jsonb(v_task));
END;
$function$;

REVOKE ALL ON FUNCTION public.create_career_execution_task(text, text, text, boolean, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_career_execution_task(text, text, text, boolean, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.transition_career_execution_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_career_execution_task(uuid, text) TO authenticated;
