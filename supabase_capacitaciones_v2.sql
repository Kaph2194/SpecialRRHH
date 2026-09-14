-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — CAPACITACIONES v2
-- Ajustes para el flujo real:
--   · Capacitaciones publicadas en YouTube
--   · Plataforma externa dedicada a la formación
--   · El certificado en PDF es lo que se carga aquí
--   · Certificados de cursos externos del colaborador
--
-- Ejecutar DESPUÉS de supabase_hseq_capacitaciones.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1 · Enlace al curso en la plataforma externa ──────────────
alter table public.capacitaciones
  add column if not exists plataforma_nombre text default '';
alter table public.capacitaciones
  add column if not exists plataforma_url    text default '';

-- ─── 2 · Certificados de cursos externos del colaborador ───────
-- Cursos, diplomados y certificaciones que el colaborador ya trae
-- o realiza por su cuenta. Siempre en PDF y validados por HSEQ.
create table if not exists public.certificados_externos (
  id                text primary key,
  emp_id            text,
  nombre            text not null,
  entidad           text default '',
  -- curso | diplomado | certificacion | licencia | taller | congreso | otro
  tipo              text default 'curso',
  fecha_emision     text default '',
  fecha_vencimiento text default '',
  horas             numeric default 0,
  codigo            text default '',
  archivo_url       text,
  archivo_nombre    text default '',
  -- pendiente | aprobado | rechazado
  estado            text default 'pendiente',
  validado_por      text default '',
  fecha_validacion  text default '',
  observaciones     text default '',
  registrado_por    text default '',
  created_at        timestamptz default now()
);

create index if not exists idx_certext_emp    on public.certificados_externos (emp_id);
create index if not exists idx_certext_estado on public.certificados_externos (estado);

-- ─── POLÍTICAS RLS — comentadas, igual que el resto del sistema ─
-- alter table public.certificados_externos enable row level security;

-- create policy sel_certext on public.certificados_externos for select using (
--   public.fn_gestiona_hseq()
--   or public.fn_rol() in ('gerencia','juridico')
--   or (public.fn_rol() = 'lider_area' and public.fn_emp_en_mi_area(emp_id))
--   or emp_id = public.fn_emp()
-- );
-- El colaborador carga los suyos; HSEQ y RRHH cargan los de cualquiera
-- create policy ins_certext on public.certificados_externos for insert with check (
--   public.fn_gestiona_hseq() or emp_id = public.fn_emp()
-- );
-- create policy upd_certext on public.certificados_externos for update using (
--   public.fn_gestiona_hseq() or (emp_id = public.fn_emp() and estado <> 'aprobado')
-- );
-- create policy del_certext on public.certificados_externos for delete using (
--   public.fn_gestiona_hseq()
-- );
