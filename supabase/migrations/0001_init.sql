-- =====================================================================
-- NuestroMatri · Esquema inicial
-- Ejecutar completo en Supabase → SQL Editor → New query → Run
-- =====================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Perfiles (Pato y Andrea). Se crean automáticamente al crear el usuario.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  side text check (side in ('novio', 'novia')),
  created_at timestamptz not null default now()
);

-- Máximo 2 cuentas: la app es solo para los novios.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.profiles) >= 2 then
    raise exception 'NuestroMatri solo permite 2 cuentas (los novios).';
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_couple()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Ajustes de la boda (fila única)
-- ---------------------------------------------------------------------
create table if not exists public.wedding_settings (
  id int primary key default 1 check (id = 1),
  couple_names text not null default 'Pato & Andrea',
  wedding_date timestamptz not null default '2027-03-22 18:00:00-03',
  venue text,
  venue_address text,
  total_budget numeric(14, 0) not null default 0,
  currency text not null default 'CLP',
  rsvp_deadline date,
  rsvp_open boolean not null default true,
  rsvp_message text default '¡Nos casamos! Nos encantaría que nos acompañes en este día tan especial.',
  updated_at timestamptz not null default now()
);
insert into public.wedding_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- Presupuesto
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#9D7A90',
  icon text not null default '✨',
  budget numeric(14, 0) not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_unique on public.categories (lower(name));

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  service text,
  category_id uuid references public.categories (id) on delete set null,
  contact_name text,
  phone text,
  email text,
  website text,
  instagram text,
  contract_path text,
  rating int check (rating between 1 and 5),
  status text not null default 'cotizando' check (status in ('cotizando', 'contratado', 'descartado')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category_id uuid references public.categories (id) on delete set null,
  vendor_id uuid references public.vendors (id) on delete set null,
  estimated numeric(14, 0) not null default 0,
  actual numeric(14, 0) not null default 0,
  status text not null default 'cotizado' check (status in ('cotizado', 'reservado', 'pagado')),
  paid_by text not null default 'ambos' check (paid_by in ('novio', 'novia', 'ambos')),
  expense_date date,
  receipt_path text,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  label text not null default 'Cuota',
  amount numeric(14, 0) not null default 0,
  due_date date,
  paid_at date,
  paid_by text not null default 'ambos' check (paid_by in ('novio', 'novia', 'ambos')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tareas y acuerdos
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee text not null default 'ambos' check (assignee in ('novio', 'novia', 'ambos')),
  due_date date,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'lista')),
  priority text not null default 'media' check (priority in ('baja', 'media', 'alta')),
  category_id uuid references public.categories (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  topic text,
  proposed_by uuid default auth.uid() references public.profiles (id) on delete set null,
  approved_novio boolean not null default false,
  approved_novia boolean not null default false,
  status text not null default 'propuesto' check (status in ('propuesto', 'aprobado', 'descartado')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ---------------------------------------------------------------------
-- Invitados, grupos, mesas y RSVP
-- ---------------------------------------------------------------------
create table if not exists public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  side text not null default 'comun' check (side in ('novio', 'novia', 'comun')),
  invite_code text not null unique default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity int not null default 10 check (capacity > 0),
  shape text not null default 'redonda' check (shape in ('redonda', 'rectangular')),
  sort int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.guest_groups (id) on delete set null,
  first_name text not null,
  last_name text not null default '',
  side text not null default 'comun' check (side in ('novio', 'novia', 'comun')),
  guest_type text not null default 'adulto' check (guest_type in ('adulto', 'nino')),
  phone text,
  email text,
  notes text,
  plus_one_allowed boolean not null default false,
  is_plus_one boolean not null default false,
  plus_one_of uuid references public.guests (id) on delete cascade,
  table_id uuid references public.seating_tables (id) on delete set null,
  added_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists guests_group_idx on public.guests (group_id);

create table if not exists public.rsvps (
  guest_id uuid primary key references public.guests (id) on delete cascade,
  attending boolean not null,
  dietary text not null default 'ninguna'
    check (dietary in ('ninguna', 'vegetariano', 'vegano', 'celiaco', 'sin_lactosa', 'alergia', 'otra')),
  dietary_notes text,
  song text,
  message text,
  source text not null default 'formulario' check (source in ('formulario', 'manual')),
  responded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Regalos, cronograma y notificaciones push
-- ---------------------------------------------------------------------
create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  giver_name text not null,
  guest_id uuid references public.guests (id) on delete set null,
  description text,
  gift_type text not null default 'dinero' check (gift_type in ('dinero', 'objeto', 'experiencia', 'otro')),
  amount numeric(14, 0),
  received_at date,
  thanked boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.timeline_items (
  id uuid primary key default gen_random_uuid(),
  start_time time not null,
  end_time time,
  title text not null,
  description text,
  location text,
  responsible text,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security: solo los novios acceden a los datos.
-- Los invitados solo interactúan mediante las funciones rsvp_* (abajo).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'wedding_settings', 'categories', 'vendors', 'expenses', 'payments', 'tasks',
    'agreements', 'guest_groups', 'seating_tables', 'guests', 'rsvps', 'gifts',
    'timeline_items', 'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "couple_all" on public.%I', t);
    execute format(
      'create policy "couple_all" on public.%I for all to authenticated using (public.is_couple()) with check (public.is_couple())',
      t
    );
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated using (public.is_couple());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Funciones públicas del RSVP (invitados sin login)
-- ---------------------------------------------------------------------
create or replace function public.rsvp_info()
returns table (
  couple_names text,
  wedding_date timestamptz,
  venue text,
  venue_address text,
  rsvp_deadline date,
  rsvp_open boolean,
  rsvp_message text
)
language sql
stable
security definer
set search_path = public
as $$
  select couple_names, wedding_date, venue, venue_address, rsvp_deadline,
         (rsvp_open and (rsvp_deadline is null or rsvp_deadline >= (now() at time zone 'America/Santiago')::date)),
         rsvp_message
  from public.wedding_settings where id = 1;
$$;

-- Búsqueda por nombre: mínimo 3 letras, máximo 8 resultados, solo nombre + grupo.
create or replace function public.rsvp_search(p_query text)
returns table (guest_id uuid, full_name text, group_id uuid, group_name text, responded boolean)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select g.id,
         trim(g.first_name || ' ' || g.last_name),
         g.group_id,
         gg.name,
         exists (select 1 from public.rsvps r where r.guest_id = g.id)
  from public.guests g
  left join public.guest_groups gg on gg.id = g.group_id
  where length(trim(coalesce(p_query, ''))) >= 3
    and not g.is_plus_one
    and extensions.unaccent(lower(g.first_name || ' ' || g.last_name))
        like '%' || extensions.unaccent(lower(trim(p_query))) || '%'
  order by g.first_name, g.last_name
  limit 8;
$$;

-- Miembros del grupo de un invitado (para sugerir a la familia completa).
create or replace function public.rsvp_group_members(p_guest_id uuid)
returns table (guest_id uuid, full_name text, guest_type text, plus_one_allowed boolean, responded boolean, attending boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, trim(g.first_name || ' ' || g.last_name), g.guest_type, g.plus_one_allowed,
         r.guest_id is not null, r.attending
  from public.guests g
  left join public.rsvps r on r.guest_id = g.id
  where not g.is_plus_one
    and (
      g.id = p_guest_id
      or (g.group_id is not null and g.group_id = (select group_id from public.guests where id = p_guest_id))
    )
  order by (g.id = p_guest_id) desc, g.first_name;
$$;

-- Link personalizado por grupo (/confirmar/CODIGO).
create or replace function public.rsvp_by_code(p_code text)
returns table (group_name text, guest_id uuid, full_name text, guest_type text, plus_one_allowed boolean, responded boolean, attending boolean)
language sql
stable
security definer
set search_path = public
as $$
  select gg.name, g.id, trim(g.first_name || ' ' || g.last_name), g.guest_type, g.plus_one_allowed,
         r.guest_id is not null, r.attending
  from public.guest_groups gg
  join public.guests g on g.group_id = gg.id and not g.is_plus_one
  left join public.rsvps r on r.guest_id = g.id
  where gg.invite_code = lower(trim(p_code))
  order by g.first_name;
$$;

-- Envío de respuestas. p_responses = [{guest_id, attending, dietary, dietary_notes, song, message, plus_one_name}]
create or replace function public.rsvp_submit(p_responses jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_guest public.guests;
  v_open boolean;
  v_count int := 0;
  v_plus_id uuid;
  v_plus_name text;
begin
  select rsvp_open into v_open from public.rsvp_info();
  if not coalesce(v_open, false) then
    raise exception 'El formulario de confirmación está cerrado.';
  end if;

  if jsonb_typeof(p_responses) <> 'array' or jsonb_array_length(p_responses) = 0 or jsonb_array_length(p_responses) > 20 then
    raise exception 'Respuestas inválidas.';
  end if;

  for r in select * from jsonb_array_elements(p_responses) loop
    select * into v_guest from public.guests where id = (r ->> 'guest_id')::uuid and not is_plus_one;
    if not found then
      continue;
    end if;

    insert into public.rsvps (guest_id, attending, dietary, dietary_notes, song, message, source, responded_at)
    values (
      v_guest.id,
      coalesce((r ->> 'attending')::boolean, false),
      coalesce(nullif(r ->> 'dietary', ''), 'ninguna'),
      left(r ->> 'dietary_notes', 300),
      left(r ->> 'song', 200),
      left(r ->> 'message', 1000),
      'formulario',
      now()
    )
    on conflict (guest_id) do update set
      attending = excluded.attending,
      dietary = excluded.dietary,
      dietary_notes = excluded.dietary_notes,
      song = excluded.song,
      message = excluded.message,
      source = 'formulario',
      responded_at = now();

    -- Acompañante (+1) solo si los novios lo permitieron para este invitado
    v_plus_name := nullif(trim(coalesce(r ->> 'plus_one_name', '')), '');
    select id into v_plus_id from public.guests where plus_one_of = v_guest.id limit 1;

    if v_guest.plus_one_allowed and coalesce((r ->> 'attending')::boolean, false) and v_plus_name is not null then
      if v_plus_id is null then
        insert into public.guests (group_id, first_name, last_name, side, is_plus_one, plus_one_of, added_by, notes)
        values (v_guest.group_id, left(v_plus_name, 120), '', v_guest.side, true, v_guest.id, null,
                'Acompañante de ' || v_guest.first_name || ' ' || v_guest.last_name)
        returning id into v_plus_id;
      else
        update public.guests set first_name = left(v_plus_name, 120) where id = v_plus_id;
      end if;
      insert into public.rsvps (guest_id, attending, dietary, dietary_notes, source)
      values (v_plus_id, true, coalesce(nullif(r ->> 'plus_one_dietary', ''), 'ninguna'), left(r ->> 'plus_one_dietary_notes', 300), 'formulario')
      on conflict (guest_id) do update set attending = true, dietary = excluded.dietary,
        dietary_notes = excluded.dietary_notes, responded_at = now();
    elsif v_plus_id is not null then
      delete from public.guests where id = v_plus_id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.rsvp_info() from public;
revoke all on function public.rsvp_search(text) from public;
revoke all on function public.rsvp_group_members(uuid) from public;
revoke all on function public.rsvp_by_code(text) from public;
revoke all on function public.rsvp_submit(jsonb) from public;
grant execute on function public.rsvp_info() to anon, authenticated;
grant execute on function public.rsvp_search(text) to anon, authenticated;
grant execute on function public.rsvp_group_members(uuid) to anon, authenticated;
grant execute on function public.rsvp_by_code(text) to anon, authenticated;
grant execute on function public.rsvp_submit(jsonb) to anon, authenticated;
grant execute on function public.is_couple() to authenticated;

-- ---------------------------------------------------------------------
-- Storage privado para comprobantes y contratos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists "couple_docs_all" on storage.objects;
create policy "couple_docs_all" on storage.objects for all to authenticated
  using (bucket_id = 'documentos' and public.is_couple())
  with check (bucket_id = 'documentos' and public.is_couple());

-- ---------------------------------------------------------------------
-- Realtime: ambos ven los cambios del otro al instante
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'wedding_settings', 'categories', 'vendors', 'expenses', 'payments', 'tasks',
    'agreements', 'guest_groups', 'seating_tables', 'guests', 'rsvps', 'gifts', 'timeline_items'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Categorías iniciales
-- ---------------------------------------------------------------------
insert into public.categories (name, color, icon) values
  ('Comida y bebida', '#809684', '🍽️'),
  ('Lugar', '#54234F', '🏛️'),
  ('Vestimenta', '#9D7A90', '👗'),
  ('Adornos y flores', '#B5838D', '💐'),
  ('Fotografía y video', '#6D597A', '📸'),
  ('Música', '#5E6E62', '🎶'),
  ('Invitaciones', '#C9A961', '💌'),
  ('Luna de miel', '#7A8B99', '✈️')
on conflict do nothing;
