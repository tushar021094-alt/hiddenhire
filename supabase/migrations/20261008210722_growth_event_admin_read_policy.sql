-- Growth analytics rows are visible only to authenticated administrators.
drop policy if exists growth_events_admin_read on public.growth_events;
create policy growth_events_admin_read
  on public.growth_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles as profile
      where profile.id = auth.uid()
        and profile.role = 'admin'
    )
  );
