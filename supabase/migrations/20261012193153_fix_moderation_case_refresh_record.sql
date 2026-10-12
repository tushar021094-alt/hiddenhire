CREATE OR REPLACE FUNCTION private.refresh_moderation_case(target_job uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare s record; a record; rq record; c record;
begin
 select * into s from public.job_safety_risk where job_id=target_job;
 if not found then return; end if;
 select * into a from public.job_authenticity where job_id=target_job;
 select * into rq from public.recruiter_quality where recruiter_id=s.recruiter_id;

 -- Load the entire case row because the logic below checks c.status as well as c.id.
 select * into c from public.moderation_cases
 where job_id=target_job and status in ('open','under_review','appealed')
 order by created_at desc limit 1;

 if s.action in ('restrict','escalate') or s.tier in ('high','critical') then
   if c.id is null then
     insert into public.moderation_cases(job_id,recruiter_id,queue,priority,decision,reasons)
     values(target_job,s.recruiter_id,
       case when s.tier='critical' or s.score>=75 then 'urgent' else 'review' end,
       greatest(s.score, case when s.tier='critical' then 85 else 50 end),
       s.action,coalesce(s.flags,'[]'::jsonb));
   else
     update public.moderation_cases set
       recruiter_id=s.recruiter_id,
       queue=case when s.tier='critical' or s.score>=75 then 'urgent' else 'review' end,
       priority=greatest(s.score,case when s.tier='critical' then 85 else 50 end),
       decision=s.action,
       reasons=coalesce(s.flags,'[]'::jsonb),
       updated_at=now()
     where id=c.id;
   end if;
 elsif c.id is not null and c.status='open' then
   update public.moderation_cases set queue='monitor',priority=s.score,decision='warn',updated_at=now() where id=c.id;
 end if;
end;
$function$;
