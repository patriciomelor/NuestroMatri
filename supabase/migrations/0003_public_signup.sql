-- Permite que el registro público elija solo entre los roles colaboradores existentes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := case
    when new.raw_user_meta_data ->> 'role' in ('wedding_planner', 'bridesmaid')
      then new.raw_user_meta_data ->> 'role'
    else 'bridesmaid'
  end;
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
