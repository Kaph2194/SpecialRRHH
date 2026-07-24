-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — ALMACENAMIENTO DE DOCUMENTOS (Supabase Storage)
-- Ejecutar completo en: SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- Dos buckets según quién debe ver el contenido:
--  · documentos → carpetas de vida, permisos, incapacidades, contratos, NÓMINA
--                 (rutas con token aleatorio; el acceso lo controla la app)
--  · bodega     → documentos institucionales visibles para TODOS los empleados
insert into storage.buckets (id, name, public) values ('documentos','documentos', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('bodega','bodega', true)
  on conflict (id) do update set public = true;

-- Permisos para que la app (clave anónima) pueda subir y leer
drop policy if exists "app_insert_docs" on storage.objects;
create policy "app_insert_docs" on storage.objects
  for insert to anon with check (bucket_id in ('documentos','bodega'));

drop policy if exists "app_update_docs" on storage.objects;
create policy "app_update_docs" on storage.objects
  for update to anon using (bucket_id in ('documentos','bodega'));

drop policy if exists "app_read_docs" on storage.objects;
create policy "app_read_docs" on storage.objects
  for select to anon using (bucket_id in ('documentos','bodega'));

-- Verificar:
-- select id, public from storage.buckets;

-- ─── TABLA DE HORARIOS (antes solo en el navegador) ──────────
create table if not exists public.horarios (
  emp_id         text primary key,
  tipo           text default 'fijo',
  dias_laborales text default '[]',
  entrada        text default '',
  salida         text default '',
  descanso       int default 0,
  horas_semana   int default 0,
  descripcion    text default '',
  modificado_por text default '',
  modificado_rol text default '',
  fecha          timestamptz default now()
);
alter table public.horarios disable row level security;
select pg_notify('pgrst', 'reload schema');

-- ─── SOLICITUDES DE CERTIFICADOS ─────────────────────────────
create table if not exists public.solicitudes_certificados (
  id             text primary key,
  emp_id         text,
  tipo           text,
  estado         text default 'solicitado',
  motivo         text default '',
  dirigido_a     text default '',
  fecha          text default '',
  emitido_por    text default '',
  fecha_emision  text default '',
  archivo_url    text,
  archivo_nombre text default '',
  created_at     timestamptz default now()
);
alter table public.solicitudes_certificados disable row level security;
select pg_notify('pgrst', 'reload schema');
