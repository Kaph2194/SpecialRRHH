-- ═══════════════════════════════════════════════════════════════
-- FIX: columnas faltantes en la tabla permisos
-- Sin estas columnas, al guardar un permiso por horas se pierde
-- el dato y al recargar aparece como "día". Ejecutar en SQL Editor.
-- (add column if not exists = NO borra ni afecta datos existentes)
-- ═══════════════════════════════════════════════════════════════

alter table public.permisos add column if not exists es_por_horas         boolean default false;
alter table public.permisos add column if not exists hora_inicio          text;
alter table public.permisos add column if not exists hora_fin             text;
alter table public.permisos add column if not exists dias_descontables    numeric;
alter table public.permisos add column if not exists dias_no_descontables numeric;
alter table public.permisos add column if not exists tratamiento          text default 'pendiente';
alter table public.permisos add column if not exists descontable          text default 'pendiente';
alter table public.permisos add column if not exists es_licencia          boolean default false;
alter table public.permisos add column if not exists aprobado_por         text;
alter table public.permisos add column if not exists aprobado_por_rol     text;
alter table public.permisos add column if not exists aprobado_por_jefe    boolean default false;
alter table public.permisos add column if not exists notificado_rrhh      boolean default false;
alter table public.permisos add column if not exists fecha_decision       text;
alter table public.permisos add column if not exists file_url             text;
alter table public.permisos add column if not exists fecha_hora           text;

select pg_notify('pgrst', 'reload schema');

-- Verificar las columnas de la tabla:
-- select column_name, data_type from information_schema.columns
-- where table_name = 'permisos' order by column_name;
