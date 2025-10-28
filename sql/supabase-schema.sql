-- Habilitar extensiones útiles
create extension if not exists pgcrypto;

-- (moveremos is_admin() más abajo, después de crear public.profiles)

-- Tabla de perfiles (uno a uno con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  discord_id text,
  character_limit int not null default 4 check (character_limit >= 0),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Función helper: ¿es admin? (requiere que public.profiles exista)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin is true
  );
$$;

-- Crea perfil al registrarse usuario
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Tabla de personajes
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  exp int not null default 0 check (exp between 0 and 74),
  level int not null default 1,
  items text not null default '',
  partidas text not null default '',
  event_points int not null default 0,
  created_at timestamptz not null default now()
);

-- Asegurar columna en instalaciones existentes
alter table if exists public.characters
  add column if not exists event_points int not null default 0;
alter table if exists public.characters
  add column if not exists partidas text not null default '';

-- Limitar cantidad de personajes por usuario
create or replace function public.enforce_character_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  max_count int;
  current_count int;
begin
  select character_limit into max_count from public.profiles where id = new.owner;
  if max_count is null then
    max_count := 4;
  end if;
  select count(*) into current_count from public.characters where owner = new.owner;
  if current_count >= max_count then
    raise exception 'El usuario alcanzó su límite de personajes (%).', max_count;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_character_limit on public.characters;
create trigger trg_enforce_character_limit
  before insert on public.characters
  for each row execute procedure public.enforce_character_limit();

-- Noticias
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Log de pagos (cuenta semanal)
create table if not exists public.pagos_log (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Ventana semanal: desde sábado 00:00 (semana local) hasta sábado siguiente
create or replace function public.current_week_saturday_window(now_ts timestamptz default now())
returns table (start_at timestamptz, end_at timestamptz)
language plpgsql immutable as $$
declare
  sat_start timestamptz;
  sat_end timestamptz;
begin
  -- date_trunc('week', x) da lunes 00:00; sumamos 5 días = sábado 00:00
  sat_start := date_trunc('week', now_ts) + interval '5 days';
  if now_ts < sat_start then
    sat_start := sat_start - interval '7 days';
  end if;
  sat_end := sat_start + interval '7 days';
  return query select sat_start, sat_end;
end;
$$;

-- Vista auxiliar: pagos de la semana por personaje
create or replace view public.character_pagos_weekly as
select c.id as character_id,
       count(pl.id) as pagos_weekly
from public.characters c
left join public.pagos_log pl
  on pl.character_id = c.id
 and pl.created_at >= (select start_at from public.current_week_saturday_window())
 and pl.created_at <  (select end_at   from public.current_week_saturday_window())
group by c.id;

-- RLS
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.news enable row level security;
alter table public.pagos_log enable row level security;

-- Policies: profiles
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (
    -- los propios pueden cambiar name/discord_id; evitar que toquen is_admin/character_limit
    id = auth.uid()
  );
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Policies: characters
drop policy if exists characters_select_owner on public.characters;
create policy characters_select_owner on public.characters
  for select using (owner = auth.uid() or public.is_admin());
drop policy if exists characters_admin_all on public.characters;
create policy characters_admin_all on public.characters
  for all using (public.is_admin()) with check (public.is_admin());

-- Policies: news (solo autenticados leen; admin CRUD)
drop policy if exists news_public_read on public.news;
drop policy if exists news_authenticated_read on public.news;
create policy news_authenticated_read on public.news
  for select using (auth.uid() is not null);
drop policy if exists news_admin_write on public.news;
create policy news_admin_write on public.news
  for all using (public.is_admin()) with check (public.is_admin());

-- Policies: pagos_log
drop policy if exists pagos_select_owner on public.pagos_log;
create policy pagos_select_owner on public.pagos_log
  for select using (
    exists (
      select 1 from public.characters c
      where c.id = pagos_log.character_id
        and (c.owner = auth.uid() or public.is_admin())
    )
  );
drop policy if exists pagos_admin_write on public.pagos_log;
create policy pagos_admin_write on public.pagos_log
  for all using (public.is_admin()) with check (public.is_admin());

-- Índices útiles
create index if not exists idx_characters_owner on public.characters(owner);
create index if not exists idx_pagos_character on public.pagos_log(character_id, created_at);

-- Función para registrar un pago semanal (máx 5 por semana, sábado→sábado)
create or replace function public.increment_pago(p_character_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cnt int;
  w_start timestamptz;
  w_end timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Solo administradores pueden registrar pagos.';
  end if;

  select start_at, end_at into w_start, w_end from public.current_week_saturday_window();
  select count(*) into cnt
  from public.pagos_log
  where character_id = p_character_id
    and created_at >= w_start and created_at < w_end;

  if cnt >= 5 then
    raise exception 'Límite semanal de pagos alcanzado (5).';
  end if;

  insert into public.pagos_log(character_id) values (p_character_id);
end;
$$;

-- Función para reducir un pago semanal (elimina el más reciente dentro de la semana actual)
create or replace function public.decrement_pago(p_character_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  w_start timestamptz;
  w_end timestamptz;
  to_delete uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo administradores pueden reducir pagos.';
  end if;

  select start_at, end_at into w_start, w_end from public.current_week_saturday_window();
  select pl.id into to_delete
  from public.pagos_log pl
  where pl.character_id = p_character_id
    and pl.created_at >= w_start and pl.created_at < w_end
  order by pl.created_at desc
  limit 1;

  if to_delete is null then
    -- no hay pagos para eliminar en la semana actual, no hacer nada
    return;
  end if;

  delete from public.pagos_log where id = to_delete;
end;
$$;
