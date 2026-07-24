-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — SUPABASE AUTH · PASO 1: CIMIENTOS
--
-- Este script NO rompe nada: crea la estructura de autenticación
-- pero la app sigue funcionando con el login actual hasta que
-- hagamos el cambio en el código (Paso 3).
--
-- Ejecutar completo en: SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. TABLA DE PERFILES ────────────────────────────────────
-- Vincula cada cuenta de Auth con su rol y su área/empleado.
create table if not exists public.perfiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  rol        text not null default 'empleado'
             check (rol in ('superadmin','analista_rrhh','lider_rrhh','lider_area',
                            'gerencia','juridico','empleado')),
  area_id    text,        -- obligatorio si rol = 'lider_area'  ('5' = Financiera)
  emp_id     text,        -- obligatorio si rol = 'empleado'
  cedula     text,        -- para enlazar con la tabla empleados
  nombre     text default '',
  activo     boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_perfiles_cedula on public.perfiles (cedula);
create index if not exists idx_perfiles_rol    on public.perfiles (rol);

-- La tabla de perfiles SÍ lleva RLS desde el inicio:
-- cada usuario solo puede leer su propio perfil.
alter table public.perfiles enable row level security;

drop policy if exists "perfil_propio" on public.perfiles;
create policy "perfil_propio" on public.perfiles
  for select using (auth.uid() = user_id);

-- ─── 2. FUNCIONES AUXILIARES ─────────────────────────────────
-- Las usarán las políticas RLS del Paso 4 para saber quién consulta.
create or replace function public.fn_rol() returns text
  language sql stable security definer set search_path = public as
$$ select rol from public.perfiles where user_id = auth.uid() and activo $$;

create or replace function public.fn_area() returns text
  language sql stable security definer set search_path = public as
$$ select area_id from public.perfiles where user_id = auth.uid() and activo $$;

create or replace function public.fn_emp() returns text
  language sql stable security definer set search_path = public as
$$ select emp_id from public.perfiles where user_id = auth.uid() and activo $$;

-- ¿El empleado indicado pertenece al área del líder conectado?
create or replace function public.fn_emp_en_mi_area(p_emp_id text)
  returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.empleados e
     where e.id = p_emp_id and e.area_id::text = public.fn_area()
   ) $$;

-- ¿Es RRHH? (quien aprueba permisos e incapacidades)
create or replace function public.fn_es_rrhh() returns boolean
  language sql stable security definer set search_path = public as
$$ select public.fn_rol() in ('superadmin','analista_rrhh') $$;

-- ─── 3. PERFIL AUTOMÁTICO AL CREAR UNA CUENTA ────────────────
-- Cuando se cree un usuario en Auth, se genera su perfil leyendo
-- los datos que se le pasen en "metadata" (rol, area_id, emp_id).
create or replace function public.fn_nuevo_usuario()
  returns trigger language plpgsql security definer set search_path = public as
$$
begin
  insert into public.perfiles (user_id, rol, area_id, emp_id, cedula, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'rol', 'empleado'),
    new.raw_user_meta_data->>'area_id',
    new.raw_user_meta_data->>'emp_id',
    new.raw_user_meta_data->>'cedula',
    coalesce(new.raw_user_meta_data->>'nombre', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_nuevo_usuario on auth.users;
create trigger trg_nuevo_usuario
  after insert on auth.users
  for each row execute function public.fn_nuevo_usuario();

-- ─── 4. VERIFICACIÓN ─────────────────────────────────────────
-- select * from public.perfiles;
-- select id, email, raw_user_meta_data from auth.users;
