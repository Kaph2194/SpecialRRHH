-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — FIX DE GUARDADO + STORAGE
-- Ejecutar COMPLETO en: Supabase → SQL Editor → Run
--
-- Resuelve: cambios de empleados/estados que no se guardaban
-- Agrega:   bucket 'documentos' para reemplazar Google Drive
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. DESACTIVAR RLS EN TODAS LAS TABLAS ───────────────────
-- (la app usa la clave anónima; con RLS activo y sin Auth, los
--  guardados fallan con 401 en silencio)
alter table if exists public.empleados        disable row level security;
alter table if exists public.permisos         disable row level security;
alter table if exists public.incapacidades    disable row level security;
alter table if exists public.vacaciones       disable row level security;
alter table if exists public.disciplinarios   disable row level security;
alter table if exists public.candidatos       disable row level security;
alter table if exists public.bodega           disable row level security;
alter table if exists public.novedades_area   disable row level security;
alter table if exists public.nomina_formatos  disable row level security;
alter table if exists public.auditoria        disable row level security;

-- ─── 2. COLUMNAS QUE LA APP ESCRIBE EN "empleados" ───────────
-- Si falta UNA sola columna, Supabase rechaza TODO el guardado
-- del empleado (error 400) y el cambio se pierde al recargar.
-- Esto agrega solo las que falten, sin tocar las existentes.
alter table public.empleados add column if not exists name                       text;
alter table public.empleados add column if not exists cedula                     text;
alter table public.empleados add column if not exists email                      text default '';
alter table public.empleados add column if not exists phone                      text default '';
alter table public.empleados add column if not exists area_id                    text;
alter table public.empleados add column if not exists cargo                      text default '';
alter table public.empleados add column if not exists empresa_id                 text;
alter table public.empleados add column if not exists fecha_ingreso              text default '';
alter table public.empleados add column if not exists contrato_tipo              text default 'indefinido';
alter table public.empleados add column if not exists salario                    bigint default 0;
alter table public.empleados add column if not exists dir                        text default '';
alter table public.empleados add column if not exists status                     text default 'activo';
alter table public.empleados add column if not exists tipo_vinculacion           text default 'directo';
alter table public.empleados add column if not exists docs                       jsonb default '{}'::jsonb;
alter table public.empleados add column if not exists contratos                  jsonb default '[]'::jsonb;
alter table public.empleados add column if not exists nomina                     jsonb default '[]'::jsonb;
alter table public.empleados add column if not exists extractos                  jsonb default '[]'::jsonb;
alter table public.empleados add column if not exists fecha_retiro               text;
alter table public.empleados add column if not exists foto_data                  text;
alter table public.empleados add column if not exists eps                        text;
alter table public.empleados add column if not exists afp                        text;
alter table public.empleados add column if not exists arl                        text;
alter table public.empleados add column if not exists pct_arl                    text;
alter table public.empleados add column if not exists caja_com                   text;
alter table public.empleados add column if not exists fondo_ces                  text;
alter table public.empleados add column if not exists banco                      text;
alter table public.empleados add column if not exists numero_cuenta              text;
alter table public.empleados add column if not exists tipo_cuenta                text;
alter table public.empleados add column if not exists subsidio_transporte        boolean default true;
alter table public.empleados add column if not exists dotacion                   boolean default true;
alter table public.empleados add column if not exists area_fisica                text;
alter table public.empleados add column if not exists vac_pendientes_importados  numeric;
alter table public.empleados add column if not exists vac_fecha_limite           text;
alter table public.empleados add column if not exists created_at                 timestamptz default now();

-- ─── 3. COLUMNAS DEL FLUJO DE PERMISOS (visto bueno líderes) ─
alter table public.permisos add column if not exists creado_por_rol        text default '';
alter table public.permisos add column if not exists solicitado_por_lider  boolean default false;
alter table public.permisos add column if not exists area_id_solicitante   text;
alter table public.permisos add column if not exists lider_otra_area_id    text;
alter table public.permisos add column if not exists lider_otra_area_nombre text;
alter table public.permisos add column if not exists visto_bueno_lider     boolean;
alter table public.permisos add column if not exists respuesta_lider_area  text default '';
alter table public.permisos add column if not exists dias_descontables     numeric;
alter table public.permisos add column if not exists dias_no_descontables  numeric;

-- ─── 4. BUCKET DE DOCUMENTOS (reemplaza Google Drive) ────────
-- Aquí quedarán: permisos, incapacidades, carpetas de vida,
-- bodega documental, contratos y formatos de nómina.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', true)
on conflict (id) do update set public = true;

-- Políticas del bucket: la app (clave anónima) puede subir y leer.
drop policy if exists "anon_upload_documentos" on storage.objects;
create policy "anon_upload_documentos" on storage.objects
  for insert to anon with check (bucket_id = 'documentos');

drop policy if exists "anon_update_documentos" on storage.objects;
create policy "anon_update_documentos" on storage.objects
  for update to anon using (bucket_id = 'documentos');

drop policy if exists "anon_read_documentos" on storage.objects;
create policy "anon_read_documentos" on storage.objects
  for select to anon using (bucket_id = 'documentos');

-- ─── 5. VERIFICACIÓN ─────────────────────────────────────────
-- Ejecuta esto después y revisa que rowsecurity = false en todas:
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- Y que el bucket exista:
-- select id, public from storage.buckets;

-- ─── 6. TABLAS DE DESCUENTOS Y DENUNCIAS ─────────────────────
-- (antes vivían solo en localStorage del navegador → se perdían)
create table if not exists public.descuentos (
  id             text primary key,
  emp_id         text,
  tipo           text,
  monto          numeric default 0,
  cuotas         int default 1,
  cuotas_pagadas int default 0,
  descripcion    text default '',
  fecha          text default '',
  estado         text default 'activo',
  aprobado_por   text,
  creado_por     text default '',
  created_at     timestamptz default now()
);

create table if not exists public.denuncias (
  id             text primary key,
  emp_id         text,
  emp_name       text default '—',
  tipo           text,
  descripcion    text default '',
  fecha_hechos   text default '',
  involucrados   text default '',
  anonimo        boolean default false,
  estado         text default 'pendiente',
  fecha          text default '',
  respuesta_rh   text default '',
  gestionado_por text default '',
  created_at     timestamptz default now()
);

alter table public.descuentos disable row level security;
alter table public.denuncias  disable row level security;

select pg_notify('pgrst', 'reload schema');
