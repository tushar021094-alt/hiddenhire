-- Anonymous visitors may emit unlinked events; signed-in events must match
-- the caller's profile. RLS limits insert payload ownership, not read access.
drop policy if exists growth_events_insert on public.growth_events;
create policy growth_events_insert
  on public.growth_events
  for insert
  to anon, authenticated
  with check (profile_id is null or profile_id = auth.uid());
