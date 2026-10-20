-- Secure application workflow mutations behind owner-checked RPCs.
-- Direct authenticated grants intentionally do not include reminder/response metadata
-- columns. These functions validate actor role and row ownership, lock the application
-- row to enforce the reminder cooldown atomically, and write the appropriate notice.

CREATE OR REPLACE FUNCTION public.candidate_remind_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text;
  application_row public.applications%rowtype;
  job_row public.jobs%rowtype;
  candidate_name text;
  current_time_at timestamptz;
  next_eligible_at timestamptz;
  reminder_eligible_at timestamptz;
  next_count integer;
  due_at timestamptz;
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

  SELECT application.* INTO application_row
  FROM public.applications AS application
  WHERE application.id = p_application_id
    AND application.candidate_id = actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  IF application_row.status NOT IN ('applied', 'reviewing', 'shortlisted') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STATUS');
  END IF;

  SELECT job.* INTO job_row
  FROM public.jobs AS job
  WHERE job.id = application_row.job_id;

  IF NOT FOUND
     OR job_row.source_type <> 'native'
     OR job_row.status <> 'published'
     OR job_row.posted_by IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_MANAGED_BY_HIDDENHIRE');
  END IF;

  current_time_at := clock_timestamp();
  reminder_eligible_at := application_row.created_at + interval '5 days';
  IF reminder_eligible_at > current_time_at THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'TOO_EARLY',
      'eligibleAt', reminder_eligible_at
    );
  END IF;

  IF application_row.last_candidate_reminder_at IS NOT NULL THEN
    next_eligible_at := application_row.last_candidate_reminder_at + interval '3 days';
    IF next_eligible_at > current_time_at THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'COOLDOWN',
        'nextEligibleAt', next_eligible_at
      );
    END IF;
  END IF;

  next_count := coalesce(application_row.candidate_reminder_count, 0) + 1;
  due_at := current_time_at + interval '3 days';

  UPDATE public.applications
  SET candidate_reminder_count = next_count,
      last_candidate_reminder_at = current_time_at,
      recruiter_response_due_at = due_at,
      updated_at = current_time_at
  WHERE id = application_row.id;

  SELECT profile.full_name INTO candidate_name
  FROM public.profiles AS profile
  WHERE profile.id = actor_id;

  INSERT INTO public.notifications (profile_id, type, title, body, data)
  VALUES (
    job_row.posted_by,
    'application_reminder',
    'Candidate requested an application update',
    coalesce(nullif(candidate_name, ''), 'A candidate') ||
      ' requested an update on the application for "' || job_row.title || '".',
    jsonb_build_object(
      'application_id', application_row.id,
      'job_id', job_row.id,
      'status', application_row.status,
      'reminder_count', next_count
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'message', 'Reminder sent. The recruiter or agency has been asked to update the application.',
    'reminder', jsonb_build_object(
      'id', application_row.id,
      'status', application_row.status,
      'candidate_reminder_count', next_count,
      'last_candidate_reminder_at', current_time_at,
      'recruiter_response_due_at', due_at
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.recruiter_update_application_status(
  p_application_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text;
  application_row public.applications%rowtype;
  job_row public.jobs%rowtype;
  current_time_at timestamptz := clock_timestamp();
  first_response_at timestamptz;
  response_count integer;
  status_label text;
BEGIN
  IF actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AUTH_REQUIRED');
  END IF;

  SELECT profile.role INTO actor_role
  FROM public.profiles AS profile
  WHERE profile.id = actor_id;

  IF actor_role IS DISTINCT FROM 'employer' AND actor_role IS DISTINCT FROM 'agency' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;

  IF p_status NOT IN ('reviewing', 'shortlisted', 'interview', 'rejected', 'hired') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_STATUS');
  END IF;

  SELECT application.* INTO application_row
  FROM public.applications AS application
  WHERE application.id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  SELECT job.* INTO job_row
  FROM public.jobs AS job
  WHERE job.id = application_row.job_id;

  IF NOT FOUND
     OR job_row.posted_by IS DISTINCT FROM actor_id
     OR job_row.source_type <> 'native' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  IF application_row.status = p_status THEN
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'UNCHANGED',
      'message', 'The application already has this status.',
      'application', jsonb_build_object(
        'id', application_row.id,
        'job_id', application_row.job_id,
        'candidate_id', application_row.candidate_id,
        'status', application_row.status,
        'created_at', application_row.created_at,
        'updated_at', application_row.updated_at,
        'recruiter_first_response_at', application_row.recruiter_first_response_at,
        'recruiter_response_count', application_row.recruiter_response_count
      )
    );
  END IF;

  -- Keep status choices aligned with the recruiter UI; p_status is validated above.
  -- Row ownership and status allowlisting are enforced in this transaction.

  first_response_at := coalesce(application_row.recruiter_first_response_at, current_time_at);
  response_count := coalesce(application_row.recruiter_response_count, 0) + 1;

  UPDATE public.applications
  SET status = p_status,
      recruiter_response_due_at = NULL,
      recruiter_first_response_at = first_response_at,
      recruiter_response_count = response_count,
      updated_at = current_time_at
  WHERE id = application_row.id;

  status_label := replace(initcap(replace(p_status, '_', ' ')), ' ', ' ');

  INSERT INTO public.notifications (profile_id, type, title, body, data)
  VALUES (
    application_row.candidate_id,
    'application_status',
    'Application status updated',
    'Your application for "' || job_row.title || '" was updated to ' || status_label || '.',
    jsonb_build_object(
      'application_id', application_row.id,
      'job_id', application_row.job_id,
      'status', p_status
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'message', 'Application status updated.',
    'application', jsonb_build_object(
      'id', application_row.id,
      'job_id', application_row.job_id,
      'candidate_id', application_row.candidate_id,
      'status', p_status,
      'created_at', application_row.created_at,
      'updated_at', current_time_at,
      'recruiter_first_response_at', first_response_at,
      'recruiter_response_count', response_count
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.candidate_remind_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidate_remind_application(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.recruiter_update_application_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recruiter_update_application_status(uuid, text) TO authenticated;
