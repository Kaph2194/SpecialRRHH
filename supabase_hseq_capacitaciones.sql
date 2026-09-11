-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — MÓDULO HSEQ, INDUCCIONES Y CAPACITACIONES
-- Ejecutar en: Supabase → SQL Editor  (una sola vez)
--
-- Incluye:
--   1. capacitaciones             → catálogo de inducciones/capacitaciones
--   2. capacitacion_asignaciones  → quién debe tomarla + su certificado
--   3. hseq_documentos            → políticas, formatos, procedimientos, matrices
--   4. hseq_certificaciones       → ISO 9001 / 14001 / 45001 y otras
--   5. comite_miembros            → integrantes COPASST y COCOLAB
--   6. comite_actas               → actas, reuniones e informes de los comités
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1 · CATÁLOGO DE CAPACITACIONES E INDUCCIONES
--     materiales = [{tipo:'presentacion|documento|video|enlace|evaluacion',
--                    nombre:'...', url:'...'}]
-- ─────────────────────────────────────────────────────────────
create table if not exists public.capacitaciones (
  id              text primary key,
  titulo          text not null,
  tipo            text default 'capacitacion',  -- induccion|reinduccion|capacitacion|entrenamiento|sst
  categoria       text default '',
  descripcion     text default '',
  area_id         text,                          -- null = aplica a todas las áreas
  cargo           text default '',               -- opcional: cargo específico
  obligatoria     boolean default true,
  duracion_horas  numeric default 0,
  vigencia_meses  integer default 0,             -- 0 = no vence
  fecha           text default '',
  instructor      text default '',
  materiales      jsonb default '[]'::jsonb,
  creado_por      text default '',
  activo          boolean default true,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 2 · ASIGNACIONES POR COLABORADOR + CERTIFICADO
-- ─────────────────────────────────────────────────────────────
create table if not exists public.capacitacion_asignaciones (
  id                 text primary key,
  capacitacion_id    text,
  emp_id             text,
  estado             text default 'pendiente',   -- pendiente|en_curso|completada
  fecha_asignacion   text default '',
  fecha_completado   text default '',
  calificacion       numeric,
  certificado_url    text,
  certificado_nombre text default '',
  certificado_estado text default 'sin_cargar',  -- sin_cargar|pendiente|aprobado|rechazado
  validado_por       text default '',
  fecha_validacion   text default '',
  observaciones      text default '',
  asignado_por       text default '',
  created_at         timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 3 · DOCUMENTOS HSEQ (políticas, formatos, procedimientos…)
--     ambito: general | copasst | cocolab
-- ─────────────────────────────────────────────────────────────
create table if not exists public.hseq_documentos (
  id              text primary key,
  tipo            text default 'politica',  -- politica|formato|procedimiento|manual|matriz|programa|plan|instructivo|otro
  ambito          text default 'general',   -- general|copasst|cocolab
  titulo          text not null,
  codigo          text default '',
  version         text default '',
  descripcion     text default '',
  fecha_vigencia  text default '',
  visible_empleados boolean default true,   -- si el colaborador lo ve en su portal
  archivo_url     text,
  archivo_nombre  text default '',
  subido_por      text default '',
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 4 · CERTIFICACIONES ISO Y OTRAS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.hseq_certificaciones (
  id                text primary key,
  norma             text not null,          -- ISO 9001:2015, ISO 45001:2018, RUC, BASC…
  alcance           text default '',
  ente_certificador text default '',
  numero            text default '',
  empresa_id        text,
  fecha_emision     text default '',
  fecha_vencimiento text default '',
  estado            text default 'vigente', -- vigente|en_proceso|vencida|suspendida
  observaciones     text default '',
  archivo_url       text,
  archivo_nombre    text default '',
  registrado_por    text default '',
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 5 · MIEMBROS DE COPASST Y COCOLAB
-- ─────────────────────────────────────────────────────────────
create table if not exists public.comite_miembros (
  id             text primary key,
  comite         text not null,              -- copasst|cocolab
  emp_id         text,
  rol_comite     text default 'principal',   -- presidente|secretario|principal|suplente
  representacion text default 'trabajadores',-- empleador|trabajadores
  periodo_inicio text default '',
  periodo_fin    text default '',
  activo         boolean default true,
  designado_por  text default '',
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 6 · ACTAS Y REUNIONES DE LOS COMITÉS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.comite_actas (
  id             text primary key,
  comite         text not null,              -- copasst|cocolab
  numero         text default '',
  fecha          text default '',
  tipo           text default 'reunion',     -- reunion|constitucion|eleccion|investigacion|informe|capacitacion
  tema           text default '',
  descripcion    text default '',
  compromisos    text default '',
  asistentes     text default '',
  archivo_url    text,
  archivo_nombre text default '',
  registrado_por text default '',
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_capasig_emp    on public.capacitacion_asignaciones (emp_id);
create index if not exists idx_capasig_cap    on public.capacitacion_asignaciones (capacitacion_id);
create index if not exists idx_hseqdoc_ambito on public.hseq_documentos (ambito);
create index if not exists idx_comiemb_comite on public.comite_miembros (comite);
create index if not exists idx_comiemb_emp    on public.comite_miembros (emp_id);
create index if not exists idx_comactas_com   on public.comite_actas (comite);

-- ─────────────────────────────────────────────────────────────
-- POLÍTICAS RLS — dejar comentadas hasta activar RLS en el resto
-- del sistema (mismo criterio del archivo supabase_setup.sql).
--
-- Lectura:  HSEQ (líder área 14) + RRHH + gerencia + jurídica ven todo.
--           El colaborador ve solo SUS asignaciones.
--           El miembro del comité ve su comité en modo lectura.
-- Escritura: solo HSEQ y RRHH. Gerencia y jurídica NUNCA escriben.
-- ─────────────────────────────────────────────────────────────
-- alter table public.capacitaciones             enable row level security;
-- alter table public.capacitacion_asignaciones  enable row level security;
-- alter table public.hseq_documentos            enable row level security;
-- alter table public.hseq_certificaciones       enable row level security;
-- alter table public.comite_miembros            enable row level security;
-- alter table public.comite_actas               enable row level security;

-- ¿El usuario conectado gestiona HSEQ? (RRHH o líder del área 14)
-- create or replace function public.fn_gestiona_hseq() returns boolean
-- language sql stable security definer as
-- $$ select public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh')
--        or (public.fn_rol() = 'lider_area' and public.fn_area() = '14') $$;

-- ¿El usuario conectado es miembro activo del comité indicado?
-- create or replace function public.fn_miembro_comite(p_comite text) returns boolean
-- language sql stable security definer as
-- $$ select exists (
--      select 1 from public.comite_miembros m
--      where m.comite = p_comite and m.activo and m.emp_id = public.fn_emp()
--    ) $$;

-- create policy sel_capacitaciones on public.capacitaciones for select using (true);
-- create policy ins_capacitaciones on public.capacitaciones for insert
--   with check (public.fn_gestiona_hseq());
-- create policy upd_capacitaciones on public.capacitaciones for update
--   using (public.fn_gestiona_hseq());

-- create policy sel_capasig on public.capacitacion_asignaciones for select using (
--   public.fn_gestiona_hseq()
--   or public.fn_rol() in ('gerencia','juridico')
--   or (public.fn_rol() = 'lider_area' and public.fn_emp_en_mi_area(emp_id))
--   or (public.fn_rol() = 'empleado'   and emp_id = public.fn_emp())
-- );
-- El colaborador puede actualizar SU asignación (subir el certificado);
-- la validación la hace HSEQ.
-- create policy upd_capasig on public.capacitacion_asignaciones for update using (
--   public.fn_gestiona_hseq() or (public.fn_rol() = 'empleado' and emp_id = public.fn_emp())
-- );
-- create policy ins_capasig on public.capacitacion_asignaciones for insert
--   with check (public.fn_gestiona_hseq());

-- create policy sel_hseqdoc on public.hseq_documentos for select using (
--   public.fn_gestiona_hseq()
--   or public.fn_rol() in ('gerencia','juridico')
--   or (ambito = 'general' and visible_empleados)
--   or (ambito <> 'general' and public.fn_miembro_comite(ambito))
-- );
-- create policy ins_hseqdoc on public.hseq_documentos for insert with check (public.fn_gestiona_hseq());
-- create policy upd_hseqdoc on public.hseq_documentos for update using (public.fn_gestiona_hseq());
-- create policy del_hseqdoc on public.hseq_documentos for delete using (public.fn_gestiona_hseq());

-- create policy sel_hseqcert on public.hseq_certificaciones for select using (true);
-- create policy ins_hseqcert on public.hseq_certificaciones for insert with check (public.fn_gestiona_hseq());
-- create policy upd_hseqcert on public.hseq_certificaciones for update using (public.fn_gestiona_hseq());
-- create policy del_hseqcert on public.hseq_certificaciones for delete using (public.fn_gestiona_hseq());

-- create policy sel_comiemb on public.comite_miembros for select using (true);
-- create policy ins_comiemb on public.comite_miembros for insert with check (public.fn_gestiona_hseq());
-- create policy upd_comiemb on public.comite_miembros for update using (public.fn_gestiona_hseq());
-- create policy del_comiemb on public.comite_miembros for delete using (public.fn_gestiona_hseq());

-- create policy sel_comactas on public.comite_actas for select using (
--   public.fn_gestiona_hseq()
--   or public.fn_rol() in ('gerencia','juridico')
--   or public.fn_miembro_comite(comite)
-- );
-- create policy ins_comactas on public.comite_actas for insert with check (public.fn_gestiona_hseq());
-- create policy upd_comactas on public.comite_actas for update using (public.fn_gestiona_hseq());
-- create policy del_comactas on public.comite_actas for delete using (public.fn_gestiona_hseq());
