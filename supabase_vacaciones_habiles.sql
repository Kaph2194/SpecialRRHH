-- ─── VACACIONES: columnas de período y días calendario ──────
alter table public.vacaciones add column if not exists periodo         text;
alter table public.vacaciones add column if not exists dias_calendario numeric;
alter table public.horarios   add column if not exists horas_semana    numeric;
select pg_notify('pgrst', 'reload schema');

-- ─── HORARIOS: mes de última actualización (alerta mensual) ──
alter table public.horarios add column if not exists mes_actualizado text;
select pg_notify('pgrst', 'reload schema');

-- ─── HORARIOS: detalle por día (entrada/salida/almuerzo) ─────
alter table public.horarios add column if not exists dias_detalle text;
select pg_notify('pgrst', 'reload schema');

-- ─── RETROALIMENTACIONES Y MEMORANDOS ────────────────────────
create table if not exists public.retroalimentaciones (
  id             text primary key,
  emp_id         text,
  tipo           text,
  titulo         text default '',
  descripcion    text default '',
  fecha          text default '',
  creado_por     text default '',
  archivo_url    text,
  archivo_nombre text default '',
  requiere_firma boolean default false,
  firmado        boolean default false,
  created_at     timestamptz default now()
);
alter table public.retroalimentaciones disable row level security;
select pg_notify('pgrst', 'reload schema');
