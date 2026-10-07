alter table public.applications
  add column if not exists candidate_reminder_count integer not null default 0,
  add column if not exists last_candidate_reminder_at timestamptz,
  add column if not exists recruiter_response_due_at timestamptz;

create index if not exists applications_recruiter_response_due_idx
  on public.applications (recruiter_response_due_at)
  where recruiter_response_due_at is not null;

create index if not exists applications_candidate_reminder_idx
  on public.applications (candidate_id, last_candidate_reminder_at);

create schema if not exists private;

create or replace function private.notify_application_reminder()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  recruiter_id uuid;
  job_title text;
  candidate_name text;
begin
  if new.last_candidate_reminder_at is null
     or (tg_op = 'UPDATE' and new.last_candidate_reminder_at = old.last_candidate_reminder_at) then
    return new;
  end if;

  select j.posted_by, j.title into recruiter_id, job_title
  from public.jobs j where j.id = new.job_id;

  select p.full_name into candidate_name
  from public.profiles p where p.id = new.candidate_id;

  if recruiter_id is not null then
    insert into public.notifications(profile_id, type, title, body, data, created_at)
    values (
      recruiter_id,
      'application_reminder',
      'Candidate requested an application update',
      coalesce(candidate_name, 'A candidate') || ' requested an update on ' || coalesce(job_title, 'your job') || '. Please review and update the application status.',
      jsonb_build_object(
        'application_id', new.id,
        'job_id', new.job_id,
        'candidate_id', new.candidate_id,
        'response_due_at', new.recruiter_response_due_at
      ),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists application_reminder_notification on public.applications;

create trigger application_reminder_notification
after update of last_candidate_reminder_at on public.applications
for each row execute function private.notify_application_reminder();
