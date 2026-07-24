-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — CONFIGURACIÓN SUPABASE
-- Ejecutar en: Supabase → SQL Editor
--
-- PARTE 1: tablas nuevas (aplicar YA — la app las necesita)
-- PARTE 2: seguridad RLS por rol (aplicar al activar Supabase Auth)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- PARTE 1 · TABLAS NUEVAS (registro permanente en base de datos)
-- ─────────────────────────────────────────────────────────────

-- 1.1 Novedades de área (antes solo en localStorage → se perdían)
create table if not exists public.novedades_area (
  id            text primary key,
  emp_id        text,
  fecha         date,
  tipo          text,
  horas         numeric,
  descripcion   text default '',
  reportado_por text default '',
  area_id       text,
  created_at    timestamptz default now()
);

-- 1.2 Auditoría: todo cambio importante queda registrado
create table if not exists public.auditoria (
  id          bigint generated always as identity primary key,
  usuario     text,
  usuario_id  text,
  rol         text,
  area_id     text,
  accion      text,      -- login | crear | cambio_estado | eliminar | subir | exportar
  entidad     text,      -- permiso | incapacidad | vacaciones | novedad_area | nomina_formato | reporteria | sesion
  entidad_id  text,
  detalle     text default '',
  created_at  timestamptz default now()
);

-- 1.3 Formatos mensuales de nómina (carga exclusiva Financiera + RRHH)
create table if not exists public.nomina_formatos (
  id          text primary key,
  periodo     text not null,          -- 'YYYY-MM'
  file_name   text default '',
  file_data   text,                   -- base64 si Drive no está conectado
  drive_url   text,
  subido_por  text default '',
  rol         text default '',
  area_nombre text default '',
  fecha       text default '',
  created_at  timestamptz default now()
);

create index if not exists idx_novarea_fecha   on public.novedades_area (fecha);
create index if not exists idx_novarea_emp     on public.novedades_area (emp_id);
create index if not exists idx_auditoria_fecha on public.auditoria (created_at);
create index if not exists idx_nomf_periodo    on public.nomina_formatos (periodo);

-- ─────────────────────────────────────────────────────────────
-- PARTE 2 · SEGURIDAD REAL EN EL SERVIDOR (RLS)
--
-- ⚠️ IMPORTANTE: hoy la app usa la clave "anon" sin autenticación
-- de usuarios, así que Supabase no puede distinguir quién consulta.
-- Estas políticas están listas para cuando se conecte Supabase Auth.
-- NO ejecutar los "enable row level security" antes de migrar el
-- login a Auth, porque la app dejaría de leer datos.
-- ─────────────────────────────────────────────────────────────

-- 2.1 Perfiles: vincula cada usuario de Auth con su rol y área
create table if not exists public.perfiles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  rol      text not null check (rol in
           ('superadmin','analista_rrhh','lider_rrhh','lider_area',
            'gerencia','juridico','empleado')),
  area_id  text,          -- obligatorio si rol = lider_area ('5' = Financiera)
  emp_id   text,          -- obligatorio si rol = empleado
  nombre   text default ''
);

-- Helpers para las políticas
create or replace function public.fn_rol() returns text
language sql stable security definer as
$$ select rol from public.perfiles where user_id = auth.uid() $$;

create or replace function public.fn_area() returns text
language sql stable security definer as
$$ select area_id from public.perfiles where user_id = auth.uid() $$;

create or replace function public.fn_emp() returns text
language sql stable security definer as
$$ select emp_id from public.perfiles where user_id = auth.uid() $$;

-- ¿El empleado X pertenece al área del líder conectado?
create or replace function public.fn_emp_en_mi_area(p_emp_id text) returns boolean
language sql stable security definer as
$$ select exists (
     select 1 from public.empleados e
     where e.id = p_emp_id and e.area_id::text = public.fn_area()
   ) $$;

-- 2.2 Activar RLS (SOLO cuando el login use Supabase Auth)
-- alter table public.empleados        enable row level security;
-- alter table public.permisos         enable row level security;
-- alter table public.incapacidades    enable row level security;
-- alter table public.vacaciones       enable row level security;
-- alter table public.disciplinarios   enable row level security;
-- alter table public.novedades_area   enable row level security;
-- alter table public.nomina_formatos  enable row level security;
-- alter table public.auditoria        enable row level security;

-- 2.3 Políticas de LECTURA
-- Jurídica ve TODO (igual que gerencia): lectura total, sin escritura.
-- RRHH (superadmin, analista, líder RRHH) ve todo.
-- Líder de área: solo registros de empleados de su área (fail-closed).

create policy sel_permisos on public.permisos for select using (
  public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh','gerencia','juridico')
  or (public.fn_rol() = 'lider_area' and public.fn_emp_en_mi_area(emp_id))
  or (public.fn_rol() = 'empleado'   and emp_id = public.fn_emp())
);

create policy sel_incap on public.incapacidades for select using (
  public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh','gerencia','juridico')
  or (public.fn_rol() = 'lider_area' and public.fn_emp_en_mi_area(emp_id))
  or (public.fn_rol() = 'empleado'   and emp_id = public.fn_emp())
);

create policy sel_vac on public.vacaciones for select using (
  public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh','gerencia','juridico')
  or (public.fn_rol() = 'lider_area' and public.fn_emp_en_mi_area(emp_id))
  or (public.fn_rol() = 'empleado'   and emp_id = public.fn_emp())
);

create policy sel_empleados on public.empleados for select using (
  public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh','gerencia','juridico')
  or (public.fn_rol() = 'lider_area' and area_id::text = public.fn_area())
  or (public.fn_rol() = 'empleado'   and id = public.fn_emp())
);

create policy sel_disc on public.disciplinarios for select using (
  public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh','gerencia','juridico')
  or (public.fn_rol() = 'lider_area' and (
        public.fn_emp_en_mi_area(emp_id)
        or area_id_solicitante = public.fn_area()
        or lider_otra_area_id  = public.fn_area()))
);

create policy sel_novarea on public.novedades_area for select using (
  public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh','gerencia','juridico')
  or (public.fn_rol() = 'lider_area' and area_id = public.fn_area())
);

create policy sel_nomf on public.nomina_formatos for select using (
  public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh','gerencia','juridico')
  or (public.fn_rol() = 'lider_area' and public.fn_area() = '5')   -- Financiera
);

-- Auditoría: solo la ven superadmin, gerencia y jurídica
create policy sel_auditoria on public.auditoria for select using (
  public.fn_rol() in ('superadmin','gerencia','juridico')
);

-- 2.4 Políticas de ESCRITURA
-- Gerencia y Jurídica: NUNCA escriben (no se crean políticas de insert/update para ellos).

-- Permisos: RRHH escribe todo; líder de área solo sobre su área; empleado solo crea los suyos.
create policy ins_permisos on public.permisos for insert with check (
  public.fn_rol() in ('superadmin','analista_rrhh')
  or (public.fn_rol() = 'lider_area' and public.fn_emp_en_mi_area(emp_id))
  or (public.fn_rol() = 'empleado'   and emp_id = public.fn_emp())
);
create policy upd_permisos on public.permisos for update using (
  public.fn_rol() in ('superadmin','analista_rrhh')
  or (public.fn_rol() = 'lider_area' and public.fn_emp_en_mi_area(emp_id))
);

-- Novedades de área: RRHH o el líder de la propia área
create policy ins_novarea on public.novedades_area for insert with check (
  public.fn_rol() in ('superadmin','analista_rrhh')
  or (public.fn_rol() = 'lider_area' and area_id = public.fn_area())
);
create policy del_novarea on public.novedades_area for delete using (
  public.fn_rol() in ('superadmin','analista_rrhh')
  or (public.fn_rol() = 'lider_area' and area_id = public.fn_area())
);

-- ★ FORMATOS DE NÓMINA: SOLO Financiera (área '5') y RRHH pueden INSERTAR.
--   Nadie los modifica ni elimina (registro inmutable). ★
create policy ins_nomf on public.nomina_formatos for insert with check (
  public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh')
  or (public.fn_rol() = 'lider_area' and public.fn_area() = '5')
);

-- Auditoría: cualquier usuario autenticado inserta; NADIE actualiza ni borra.
create policy ins_auditoria on public.auditoria for insert with check (auth.uid() is not null);

-- (Replicar el patrón de permisos para incapacidades, vacaciones y
--  disciplinarios cambiando el nombre de la política y la tabla.)
