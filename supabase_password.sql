-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — MÓDULO DE RESTABLECER CONTRASEÑA
--
--   · El empleado solicita el restablecimiento desde el login
--   · RRHH restablece desde la ficha del empleado
--   · La clave queda marcada como temporal: el empleado está
--     obligado a cambiarla en su siguiente ingreso
--
-- Ejecutar en: Supabase → SQL Editor (una sola vez)
-- ═══════════════════════════════════════════════════════════════

-- ─── 1 · CLAVE TEMPORAL ────────────────────────────────────────
-- Cuando RRHH restablece una contraseña, esta marca queda en true
-- y la app obliga al empleado a cambiarla antes de seguir.
alter table public.perfiles
  add column if not exists debe_cambiar_password boolean default false;

alter table public.perfiles
  add column if not exists password_cambiado_at timestamptz;

-- ─── 2 · SOLICITUDES DE RESTABLECIMIENTO ───────────────────────
-- Las crea la Edge Function cuando un empleado dice que olvidó su
-- contraseña y no tiene un correo real al que enviarle el enlace.
-- Aparecen en el centro de pendientes de Recursos Humanos.
create table if not exists public.solicitudes_password (
  id             text primary key,
  emp_id         text,
  cedula         text default '',
  nombre         text default '',
  correo         text default '',
  -- email_enviado | pendiente_rrhh | atendida | rechazada
  estado         text default 'pendiente_rrhh',
  via            text default 'rrhh',     -- email | rrhh
  fecha          text default '',
  atendida_por   text default '',
  fecha_atencion text default '',
  observaciones  text default '',
  created_at     timestamptz default now()
);

create index if not exists idx_solpass_estado on public.solicitudes_password (estado);
create index if not exists idx_solpass_emp    on public.solicitudes_password (emp_id);

-- ─── 3 · EL EMPLEADO MARCA SU CLAVE COMO YA CAMBIADA ───────────
-- La tabla `perfiles` tiene RLS y solo permite lectura del perfil
-- propio. En vez de abrir un UPDATE general, exponemos una función
-- que únicamente puede apagar su propia marca.
create or replace function public.fn_password_cambiado()
  returns void language sql security definer set search_path = public as
$$
  update public.perfiles
  set debe_cambiar_password = false,
      password_cambiado_at  = now()
  where user_id = auth.uid();
$$;

revoke all on function public.fn_password_cambiado() from public;
grant execute on function public.fn_password_cambiado() to authenticated;

-- ─── 4 · ¿QUIÉN PUEDE RESTABLECER CONTRASEÑAS? ─────────────────
-- La usa la Edge Function para autorizar a quien llama.
create or replace function public.fn_puede_restablecer_password()
  returns boolean language sql stable security definer set search_path = public as
$$
  select public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh');
$$;

grant execute on function public.fn_puede_restablecer_password() to authenticated;

-- ─── 5 · RLS DE LAS SOLICITUDES ────────────────────────────────
-- Comentado hasta que actives RLS en el resto del sistema, igual
-- que en los demás módulos.
--
-- alter table public.solicitudes_password enable row level security;
--
-- Solo RRHH las ve y las gestiona. El empleado no necesita leerlas:
-- la Edge Function las crea con la clave de servicio.
-- create policy sel_solpass on public.solicitudes_password for select
--   using (public.fn_puede_restablecer_password());
-- create policy upd_solpass on public.solicitudes_password for update
--   using (public.fn_puede_restablecer_password());
-- create policy del_solpass on public.solicitudes_password for delete
--   using (public.fn_rol() = 'superadmin');

-- ─── 6 · VERIFICACIÓN ──────────────────────────────────────────
-- select column_name from information_schema.columns
--  where table_name = 'perfiles' and column_name like '%password%';
-- select * from public.solicitudes_password order by created_at desc;
