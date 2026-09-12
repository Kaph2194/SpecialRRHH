-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — BUZÓN DE SUGERENCIAS, PETICIONES Y CONSULTAS
-- Ejecutar en: Supabase → SQL Editor (una sola vez)
--
-- Canal interno tipo correo: el colaborador escribe a Recursos
-- Humanos, a su líder, a otra área, a Gerencia o a un comité.
-- El destinatario responde y el hilo queda registrado.
--
-- NOTA: este buzón NO reemplaza el Canal de Denuncias
-- (tabla `denuncias`), que sigue siendo el canal confidencial
-- para acoso laboral y faltas graves.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.buzon_mensajes (
  id              text primary key,

  -- Remitente. Si el mensaje es anónimo, emp_id queda en null
  -- y no se guarda el nombre (igual que en el canal de denuncias).
  emp_id          text,
  remitente       text default '',
  anonimo         boolean default false,

  -- Destinatario: rrhh | gerencia | area | copasst | cocolab
  destino         text not null default 'rrhh',
  destino_area_id text,                       -- solo cuando destino = 'area'

  -- sugerencia | peticion | queja | reclamo | felicitacion | consulta | idea
  categoria       text default 'sugerencia',
  asunto          text not null,
  mensaje         text default '',
  prioridad       text default 'normal',      -- normal | alta

  -- nuevo | leido | en_gestion | respondido | cerrado
  estado          text default 'nuevo',
  fecha           text default '',
  fecha_lectura   text default '',
  leido_por       text default '',
  cerrado_por     text default '',
  fecha_cierre    text default '',

  archivo_url     text,
  archivo_nombre  text default '',

  -- Hilo de respuestas:
  -- [{ autor, rol, fecha, texto, interna }]
  -- interna = true → nota visible solo para quien gestiona
  respuestas      jsonb default '[]'::jsonb,

  created_at      timestamptz default now()
);

create index if not exists idx_buzon_emp     on public.buzon_mensajes (emp_id);
create index if not exists idx_buzon_destino on public.buzon_mensajes (destino, destino_area_id);
create index if not exists idx_buzon_estado  on public.buzon_mensajes (estado);

-- ─────────────────────────────────────────────────────────────
-- POLÍTICAS RLS — comentadas hasta activar RLS en el resto del
-- sistema, igual que en supabase_setup.sql y el módulo HSEQ.
--
-- Lectura:  el remitente ve SUS mensajes; el destinatario ve los
--           dirigidos a él (RRHH, su área, gerencia o su comité).
-- Escritura: cualquier colaborador puede enviar; solo el
--           destinatario responde y cambia el estado.
-- ─────────────────────────────────────────────────────────────
-- alter table public.buzon_mensajes enable row level security;

-- ¿El usuario conectado es destinatario de este mensaje?
-- create or replace function public.fn_buzon_destinatario(
--   p_destino text, p_area text) returns boolean
-- language sql stable security definer as
-- $$ select
--      (p_destino = 'rrhh'     and public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh'))
--   or (p_destino = 'gerencia' and public.fn_rol() in ('superadmin','gerencia','ceo','juridico'))
--   or (p_destino = 'area'     and public.fn_rol() = 'lider_area' and public.fn_area() = p_area)
--   or (p_destino in ('copasst','cocolab') and public.fn_miembro_comite(p_destino))
--   or  public.fn_rol() = 'superadmin' $$;

-- create policy sel_buzon on public.buzon_mensajes for select using (
--   (emp_id is not null and emp_id = public.fn_emp())
--   or public.fn_buzon_destinatario(destino, destino_area_id)
-- );
-- Cualquier colaborador puede enviar un mensaje a su nombre o anónimo
-- create policy ins_buzon on public.buzon_mensajes for insert with check (
--   emp_id = public.fn_emp() or (anonimo and emp_id is null)
-- );
-- Solo el destinatario responde y cambia el estado
-- create policy upd_buzon on public.buzon_mensajes for update using (
--   public.fn_buzon_destinatario(destino, destino_area_id)
-- );
-- create policy del_buzon on public.buzon_mensajes for delete using (
--   public.fn_rol() = 'superadmin'
-- );
