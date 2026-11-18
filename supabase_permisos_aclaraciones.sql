-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — ACLARACIONES EN PERMISOS + NOTIFICACIONES
-- Ejecutar completo en: Supabase → SQL Editor → Run
--
-- 1. permisos.aclaraciones: historial de observaciones de RRHH y
--    respuestas del empleado (texto + adjuntos).
-- 2. notificaciones: la campana 🔔 de la barra superior.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Historial de aclaraciones en el permiso ──────────────
alter table public.permisos
  add column if not exists aclaraciones jsonb default '[]'::jsonb;

-- ─── 2. Fichas de empleado del usuario conectado ─────────────
-- Por emp_id del perfil o, si falta, por cédula (igual que la app).
create or replace function public.fn_mis_emp_ids()
  returns setof text language sql stable security definer set search_path = public as
$$
  select p.emp_id from public.perfiles p
   where p.user_id = auth.uid() and coalesce(p.activo, true) and p.emp_id is not null
  union
  select e.id from public.empleados e
    join public.perfiles p on p.user_id = auth.uid() and coalesce(p.activo, true)
   where p.cedula is not null and p.cedula <> ''
     and regexp_replace(coalesce(e.cedula,''), '[.\s,-]', '', 'g')
       = regexp_replace(p.cedula, '[.\s,-]', '', 'g')
$$;
revoke all on function public.fn_mis_emp_ids() from public;
grant execute on function public.fn_mis_emp_ids() to authenticated;

create or replace function public.fn_rol_notif()
  returns text language sql stable security definer set search_path = public as
$$ select rol from public.perfiles where user_id = auth.uid() and coalesce(activo, true) $$;
revoke all on function public.fn_rol_notif() from public;
grant execute on function public.fn_rol_notif() to authenticated;

-- ─── 3. Tabla de notificaciones ──────────────────────────────
-- Destinatario (uno de los tres):
--   para_emp_id  → un empleado (por su ficha)
--   para_user_id → un usuario concreto (p. ej. el líder que pidió la aclaración)
--   para_rol     → 'rrhh' = todo el equipo de RRHH y el Super Admin
create table if not exists public.notificaciones (
  id           text primary key,
  para_emp_id  text,
  para_user_id uuid,
  para_rol     text,
  titulo       text not null,
  mensaje      text default '',
  tipo         text default 'info',
  ref_tabla    text,
  ref_id       text,
  vista        text,
  creada_por   text default '',
  leida        boolean default false,
  leida_at     timestamptz,
  created_at   timestamptz default now()
);
create index if not exists notificaciones_emp_idx  on public.notificaciones (para_emp_id, leida);
create index if not exists notificaciones_user_idx on public.notificaciones (para_user_id, leida);
create index if not exists notificaciones_rol_idx  on public.notificaciones (para_rol, leida);

alter table public.notificaciones enable row level security;

drop policy if exists "notif_sel" on public.notificaciones;
drop policy if exists "notif_upd" on public.notificaciones;
drop policy if exists "notif_ins" on public.notificaciones;

-- Cada quien ve y marca como leídas solo las suyas
create policy "notif_sel" on public.notificaciones for select to authenticated using (
     (para_emp_id is not null and para_emp_id in (select public.fn_mis_emp_ids()))
  or (para_user_id = auth.uid())
  or (para_rol = 'rrhh' and public.fn_rol_notif() in ('superadmin','analista_rrhh','lider_rrhh'))
);
create policy "notif_upd" on public.notificaciones for update to authenticated using (
     (para_emp_id is not null and para_emp_id in (select public.fn_mis_emp_ids()))
  or (para_user_id = auth.uid())
  or (para_rol = 'rrhh' and public.fn_rol_notif() in ('superadmin','analista_rrhh','lider_rrhh'))
);

-- RRHH, Super Admin y líderes notifican a cualquiera;
-- el empleado solo puede notificar a RRHH o a un usuario concreto
-- (el que le pidió la aclaración), nunca a otros empleados.
create policy "notif_ins" on public.notificaciones for insert to authenticated with check (
     public.fn_rol_notif() in ('superadmin','analista_rrhh','lider_rrhh','lider_area','juridico')
  or (para_emp_id is null and (para_rol = 'rrhh' or para_user_id is not null))
);

select pg_notify('pgrst', 'reload schema');

-- ─── Verificar ───────────────────────────────────────────────
-- select column_name from information_schema.columns
--  where table_name = 'permisos' and column_name = 'aclaraciones';   → 1 fila
-- select count(*) from public.notificaciones;                         → 0
