-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — SISTEMA DE GESTIÓN POR ÁREA + PESV
-- Ejecutar completo en: Supabase → SQL Editor → Run
--
-- 1. sig_documentos    manuales, procesos, procedimientos… por área
-- 2. sig_kpis          KPI de cada área con sus mediciones
-- 3. pesv_evaluaciones evaluación de los 24 pasos (Res. 40595/2022)
-- 4. bucket privado 'sig' (10 MB por archivo) para documentos y
--    evidencias del PESV. Sin enlaces públicos: la app pide un
--    enlace temporal cada vez que alguien autorizado abre un archivo.
--
-- Claves de área (area_key): 'gerencia', 'rrhh' y 'area-<id del área>'.
-- Quién gestiona (crea, edita, borra):
--   superadmin → todas · analista_rrhh / lider_rrhh → 'rrhh'
--   gerencia → 'gerencia' · lider_area → 'area-<su área>'
-- Quién consulta todo: superadmin, gerencia, juridico, analista_rrhh, lider_rrhh.
-- PESV: editan superadmin, RRHH y el líder HSEQ (área 14);
--       consultan además gerencia y jurídica.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Funciones de permiso ─────────────────────────────────
create or replace function public.fn_sig_rol()
  returns text language sql stable security definer set search_path = public as
$$ select rol from public.perfiles where user_id = auth.uid() and coalesce(activo, true) $$;

create or replace function public.fn_sig_area()
  returns text language sql stable security definer set search_path = public as
$$ select area_id::text from public.perfiles where user_id = auth.uid() and coalesce(activo, true) $$;

create or replace function public.fn_sig_puede_gestionar(k text)
  returns boolean language sql stable security definer set search_path = public as
$$
  select coalesce(case public.fn_sig_rol()
    when 'superadmin'    then true
    when 'analista_rrhh' then k = 'rrhh'
    when 'lider_rrhh'    then k = 'rrhh'
    when 'gerencia'      then k = 'gerencia'
    when 'lider_area'    then public.fn_sig_area() is not null and k = 'area-' || public.fn_sig_area()
    else false end, false)
$$;

create or replace function public.fn_sig_puede_ver(k text)
  returns boolean language sql stable security definer set search_path = public as
$$
  select coalesce(public.fn_sig_rol() in ('superadmin','gerencia','juridico','analista_rrhh','lider_rrhh'), false)
      or public.fn_sig_puede_gestionar(k)
$$;

create or replace function public.fn_pesv_puede_editar()
  returns boolean language sql stable security definer set search_path = public as
$$
  select coalesce(public.fn_sig_rol() in ('superadmin','analista_rrhh','lider_rrhh'), false)
      or coalesce(public.fn_sig_rol() = 'lider_area' and public.fn_sig_area() = '14', false)
$$;

create or replace function public.fn_pesv_puede_ver()
  returns boolean language sql stable security definer set search_path = public as
$$ select public.fn_pesv_puede_editar() or coalesce(public.fn_sig_rol() in ('gerencia','juridico'), false) $$;

revoke all on function public.fn_sig_rol(), public.fn_sig_area(), public.fn_sig_puede_gestionar(text),
  public.fn_sig_puede_ver(text), public.fn_pesv_puede_editar(), public.fn_pesv_puede_ver() from public;
grant execute on function public.fn_sig_rol(), public.fn_sig_area(), public.fn_sig_puede_gestionar(text),
  public.fn_sig_puede_ver(text), public.fn_pesv_puede_editar(), public.fn_pesv_puede_ver() to authenticated;

-- ─── 2. Documentos por área ──────────────────────────────────
create table if not exists public.sig_documentos (
  id             text primary key,
  area_key       text not null,
  tipo           text not null default 'procedimiento'
                 check (tipo in ('manual','proceso','procedimiento','instructivo','formato','politica','otro')),
  codigo         text default '',
  nombre         text not null,
  version        text default '1',
  fecha_emision  date,
  fecha_revision date,
  responsable    text default '',
  estado         text not null default 'vigente' check (estado in ('borrador','revision','vigente','obsoleto')),
  descripcion    text default '',
  archivo_ruta   text,
  archivo_nombre text,
  archivo_tamano bigint default 0,
  subido_por     text default '',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists sig_documentos_area_idx on public.sig_documentos (area_key, tipo);
alter table public.sig_documentos enable row level security;
drop policy if exists "sig_doc_sel" on public.sig_documentos;
drop policy if exists "sig_doc_ins" on public.sig_documentos;
drop policy if exists "sig_doc_upd" on public.sig_documentos;
drop policy if exists "sig_doc_del" on public.sig_documentos;
create policy "sig_doc_sel" on public.sig_documentos for select to authenticated using (public.fn_sig_puede_ver(area_key));
create policy "sig_doc_ins" on public.sig_documentos for insert to authenticated with check (public.fn_sig_puede_gestionar(area_key));
create policy "sig_doc_upd" on public.sig_documentos for update to authenticated
  using (public.fn_sig_puede_gestionar(area_key)) with check (public.fn_sig_puede_gestionar(area_key));
create policy "sig_doc_del" on public.sig_documentos for delete to authenticated using (public.fn_sig_puede_gestionar(area_key));

-- ─── 3. KPI por área ─────────────────────────────────────────
create table if not exists public.sig_kpis (
  id          text primary key,
  area_key    text not null,
  nombre      text not null,
  objetivo    text default '',
  formula     text default '',
  meta        numeric,
  unidad      text default '%',
  sentido     text default 'mayor' check (sentido in ('mayor','menor')),
  frecuencia  text default 'mensual',
  responsable text default '',
  mediciones  jsonb default '[]'::jsonb,   -- [{periodo:'2026-10', valor, nota, por, fecha}]
  activo      boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists sig_kpis_area_idx on public.sig_kpis (area_key);
alter table public.sig_kpis enable row level security;
drop policy if exists "sig_kpi_sel" on public.sig_kpis;
drop policy if exists "sig_kpi_ins" on public.sig_kpis;
drop policy if exists "sig_kpi_upd" on public.sig_kpis;
drop policy if exists "sig_kpi_del" on public.sig_kpis;
create policy "sig_kpi_sel" on public.sig_kpis for select to authenticated using (public.fn_sig_puede_ver(area_key));
create policy "sig_kpi_ins" on public.sig_kpis for insert to authenticated with check (public.fn_sig_puede_gestionar(area_key));
create policy "sig_kpi_upd" on public.sig_kpis for update to authenticated
  using (public.fn_sig_puede_gestionar(area_key)) with check (public.fn_sig_puede_gestionar(area_key));
create policy "sig_kpi_del" on public.sig_kpis for delete to authenticated using (public.fn_sig_puede_gestionar(area_key));

-- ─── 4. Evaluaciones PESV ────────────────────────────────────
create table if not exists public.pesv_evaluaciones (
  id              text primary key,
  anio            int  not null,
  nivel           text not null default 'avanzado' check (nivel in ('basico','estandar','avanzado')),
  misionalidad    text default '2',
  vehiculos       int  default 0,
  conductores     int  default 0,
  responsable     text default '',
  estado          text default 'en_curso',
  respuestas      jsonb default '{}'::jsonb,   -- {'1.1': {estado, obs, evidencias:[…], por, fecha}}
  acciones        jsonb default '[]'::jsonb,   -- plan de acción (paso 23)
  indicadores     jsonb default '{}'::jsonb,   -- paso 20: {tsv: {meta, T1:{num,den}, …}}
  actualizado_por text default '',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists pesv_evaluaciones_anio_idx on public.pesv_evaluaciones (anio desc);
alter table public.pesv_evaluaciones enable row level security;
drop policy if exists "pesv_sel" on public.pesv_evaluaciones;
drop policy if exists "pesv_ins" on public.pesv_evaluaciones;
drop policy if exists "pesv_upd" on public.pesv_evaluaciones;
drop policy if exists "pesv_del" on public.pesv_evaluaciones;
create policy "pesv_sel" on public.pesv_evaluaciones for select to authenticated using (public.fn_pesv_puede_ver());
create policy "pesv_ins" on public.pesv_evaluaciones for insert to authenticated with check (public.fn_pesv_puede_editar());
create policy "pesv_upd" on public.pesv_evaluaciones for update to authenticated
  using (public.fn_pesv_puede_editar()) with check (public.fn_pesv_puede_editar());
create policy "pesv_del" on public.pesv_evaluaciones for delete to authenticated using (public.fn_pesv_puede_editar());

-- ─── 5. Bucket privado 'sig' ─────────────────────────────────
-- Rutas: pesv/<evaluación>/<criterio>/archivo   (evidencias PESV)
--        <area_key>/<tipo>/archivo              (documentos por área)
insert into storage.buckets (id, name, public, file_size_limit)
values ('sig', 'sig', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "sig_storage_sel" on storage.objects;
drop policy if exists "sig_storage_ins" on storage.objects;
drop policy if exists "sig_storage_del" on storage.objects;
create policy "sig_storage_sel" on storage.objects for select to authenticated using (
  bucket_id = 'sig' and (
       (split_part(name, '/', 1) = 'pesv' and public.fn_pesv_puede_ver())
    or (split_part(name, '/', 1) <> 'pesv' and public.fn_sig_puede_ver(split_part(name, '/', 1)))
  ));
create policy "sig_storage_ins" on storage.objects for insert to authenticated with check (
  bucket_id = 'sig' and (
       (split_part(name, '/', 1) = 'pesv' and public.fn_pesv_puede_editar())
    or (split_part(name, '/', 1) <> 'pesv' and public.fn_sig_puede_gestionar(split_part(name, '/', 1)))
  ));
create policy "sig_storage_del" on storage.objects for delete to authenticated using (
  bucket_id = 'sig' and (
       (split_part(name, '/', 1) = 'pesv' and public.fn_pesv_puede_editar())
    or (split_part(name, '/', 1) <> 'pesv' and public.fn_sig_puede_gestionar(split_part(name, '/', 1)))
  ));

select pg_notify('pgrst', 'reload schema');

-- ─── Verificar ───────────────────────────────────────────────
-- select id, public, file_size_limit from storage.buckets where id = 'sig';   → public=false, 10485760
-- select count(*) from public.sig_documentos;    → 0
-- select count(*) from public.sig_kpis;          → 0
-- select count(*) from public.pesv_evaluaciones; → 0
