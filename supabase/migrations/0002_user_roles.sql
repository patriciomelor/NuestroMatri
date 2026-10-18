-- Roles de colaboración para el panel de planificación.
alter table public.profiles
  add column if not exists role text not null default 'couple'
  check (role in ('couple', 'wedding_planner', 'bridesmaid'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := 'bridesmaid';
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    v_role
  );
  return new;
end;
$$;

create or replace function public.is_couple()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'couple'
  );
$$;

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(allowed_roles)
  );
$$;

revoke all on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to authenticated;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated
  using (public.is_couple() or id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (display_name, side) on public.profiles to authenticated;

drop policy if exists "planner_guest_groups" on public.guest_groups;
create policy "planner_guest_groups" on public.guest_groups for all to authenticated
  using (public.has_role(array['wedding_planner']))
  with check (public.has_role(array['wedding_planner']));

drop policy if exists "planner_guests" on public.guests;
create policy "planner_guests" on public.guests for all to authenticated
  using (public.has_role(array['wedding_planner']))
  with check (public.has_role(array['wedding_planner']));

drop policy if exists "planner_rsvps" on public.rsvps;
create policy "planner_rsvps" on public.rsvps for all to authenticated
  using (public.has_role(array['wedding_planner']))
  with check (public.has_role(array['wedding_planner']));

drop policy if exists "planner_seating_tables" on public.seating_tables;
create policy "planner_seating_tables" on public.seating_tables for all to authenticated
  using (public.has_role(array['wedding_planner']))
  with check (public.has_role(array['wedding_planner']));

drop policy if exists "collaborator_tasks" on public.tasks;
create policy "collaborator_tasks" on public.tasks for all to authenticated
  using (public.has_role(array['wedding_planner', 'bridesmaid']))
  with check (public.has_role(array['wedding_planner', 'bridesmaid']));

drop policy if exists "collaborator_timeline" on public.timeline_items;
create policy "collaborator_timeline" on public.timeline_items for all to authenticated
  using (public.has_role(array['wedding_planner', 'bridesmaid']))
  with check (public.has_role(array['wedding_planner', 'bridesmaid']));

drop policy if exists "collaborator_categories_read" on public.categories;
create policy "collaborator_categories_read" on public.categories for select to authenticated
  using (public.has_role(array['wedding_planner', 'bridesmaid']));

drop policy if exists "collaborator_settings_read" on public.wedding_settings;
create policy "collaborator_settings_read" on public.wedding_settings for select to authenticated
  using (public.has_role(array['wedding_planner', 'bridesmaid']));