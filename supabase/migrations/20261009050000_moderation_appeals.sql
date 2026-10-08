create table if not exists public.moderation_appeals (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.moderation_cases(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade,
 recruiter_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check (char_length(trim(reason)) between 20 and 2000),
 status text not null default 'submitted' check (status in ('submitted','under_review','accepted','rejected')),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id) on delete set null,
 resolution text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.moderation_appeals enable row level security;
create index if not exists moderation_appeals_case_idx on public.moderation_appeals(case_id,status);
create index if not exists moderation_appeals_recruiter_idx on public.moderation_appeals(recruiter_id,status);
grant select,insert,update on public.moderation_appeals to authenticated;
grant select,insert,update,delete on public.moderation_appeals to service_role;
create policy moderation_appeals_select_own on public.moderation_appeals for select to authenticated using ((select auth.uid())=recruiter_id);
create policy moderation_appeals_insert_own on public.moderation_appeals for insert to authenticated with check ((select auth.uid())=recruiter_id);
create policy moderation_appeals_update_own on public.moderation_appeals for update to authenticated using ((select auth.uid())=recruiter_id) with check ((select auth.uid())=recruiter_id);
create or replace function private.sync_appeal_case()
returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if new.status='submitted' then update public.moderation_cases set status='appealed',updated_at=now() where id=new.case_id and status in ('open','under_review','appealed');
 elsif new.status='under_review' then update public.moderation_cases set status='under_review',updated_at=now() where id=new.case_id;
 elsif new.status='accepted' then update public.moderation_cases set status='resolved',decision='allow',reviewed_at=coalesce(new.reviewed_at,now()),reviewed_by=new.reviewed_by,resolution=new.resolution,updated_at=now() where id=new.case_id;
 elsif new.status='rejected' then update public.moderation_cases set status='resolved',decision='restrict',reviewed_at=coalesce(new.reviewed_at,now()),reviewed_by=new.reviewed_by,resolution=new.resolution,updated_at=now() where id=new.case_id;
 end if;
 return new;
end; $$;
revoke all on function private.sync_appeal_case() from public,anon,authenticated;
drop trigger if exists moderation_appeal_sync on public.moderation_appeals;
create trigger moderation_appeal_sync after insert or update of status,reviewed_at,reviewed_by,resolution on public.moderation_appeals for each row execute function private.sync_appeal_case();