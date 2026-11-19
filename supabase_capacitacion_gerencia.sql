-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — PESV (CAPACITACIONES · ALCOHOL Y DROGAS · EQUIPOS)
--                + DELEGACIÓN DESDE GERENCIA
-- Ejecutar completo en: Supabase → SQL Editor → Run
-- Requiere haber ejecutado antes:
--   supabase_hseq_capacitaciones.sql   (tabla capacitaciones)
--   supabase_sig_pesv.sql              (permisos PESV y bucket 'sig')
--   supabase_pesv_autoevaluacion.sql   (notificaciones por rol y área)
--
-- 1. Capacitaciones del PESV en la misma tabla de capacitaciones de
--    HSEQ: tema PESV, estado, fecha realizada, lugar y soportes
--    (actas, asistencia, evidencias) en el bucket privado 'sig'.
-- 2. Pruebas de alcohol y sustancias psicoactivas con sus evidencias.
--    Son datos sensibles de salud (Ley 1581 de 2012): el detalle solo
--    lo ven quienes gestionan el PESV; Gerencia ve cifras agregadas.
-- 3. Equipos de medición (alcohosensores, kits) con certificados de
--    calibración y alerta de vencimiento.
-- 4. Delegaciones: Gerencia (solo lectura en todo lo demás) asigna
--    tareas a cada área, el área las cumple y Gerencia las valida.
-- 5. Gerencia deja de poder editar documentos y KPI: solo consulta.
-- ═══════════════════════════════════════════════════════════════

do $$ begin
  if to_regclass('public.capacitaciones') is null then
    raise exception 'Primero ejecuta supabase_hseq_capacitaciones.sql (crea la tabla capacitaciones).';
  end if;
  if to_regprocedure('public.fn_pesv_puede_editar()') is null then
    raise exception 'Primero ejecuta supabase_sig_pesv.sql.';
  end if;
  if to_regprocedure('public.fn_mes_es(text)') is null then
    raise exception 'Primero ejecuta supabase_pesv_autoevaluacion.sql.';
  end if;
end $$;

-- ─── 1. Capacitaciones del PESV ──────────────────────────────
alter table public.capacitaciones add column if not exists pesv_tema           text default '';
alter table public.capacitaciones add column if not exists estado_ejecucion    text default 'programada';  -- programada · realizada · cancelada
alter table public.capacitaciones add column if not exists fecha_realizada     text default '';
alter table public.capacitaciones add column if not exists lugar               text default '';
alter table public.capacitaciones add column if not exists asistentes_objetivo int  default 0;
alter table public.capacitaciones add column if not exists pesv_soportes       jsonb default '[]'::jsonb;  -- [{id, tipo, nombre, ruta, tamano, por, fecha}]
create index if not exists capacitaciones_pesv_idx on public.capacitaciones (categoria) where categoria = 'PESV';

-- ─── 2. Pruebas de alcohol y sustancias psicoactivas ─────────
create table if not exists public.pesv_pruebas (
  id           text primary key,
  fecha        date not null,
  hora         text default '',
  tipo         text not null default 'alcohol' check (tipo in ('alcohol','drogas')),
  emp_id       text,
  persona      text default '',            -- nombre si no es colaborador (contratista, visitante)
  resultado    text not null default 'negativo' check (resultado in ('negativo','positivo','no_concluyente')),
  valor        text default '',            -- lectura del equipo (p. ej. 0.00 mg/L)
  equipo_id    text,
  motivo       text default 'aleatoria',   -- aleatoria · preoperacional · sospecha · post_siniestro · programada
  lugar        text default '',
  realizada_por text default '',
  observaciones text default '',
  soportes     jsonb default '[]'::jsonb,  -- foto de la lectura, formato firmado…
  registrada_por text default '',
  created_at   timestamptz default now()
);
create index if not exists pesv_pruebas_fecha_idx on public.pesv_pruebas (fecha desc);
alter table public.pesv_pruebas enable row level security;
drop policy if exists "pesv_pru_all" on public.pesv_pruebas;
create policy "pesv_pru_all" on public.pesv_pruebas for all to authenticated
  using (public.fn_pesv_puede_editar()) with check (public.fn_pesv_puede_editar());

-- ─── 3. Equipos de medición y calibración ────────────────────
create table if not exists public.pesv_equipos (
  id                  text primary key,
  nombre              text not null,
  tipo                text default 'alcohosensor',   -- alcohosensor · kit_drogas · otro
  marca               text default '',
  serial              text default '',
  proveedor           text default '',
  fecha_calibracion   date,
  proxima_calibracion date,
  estado              text default 'operativo' check (estado in ('operativo','en_calibracion','fuera_servicio')),
  observaciones       text default '',
  soportes            jsonb default '[]'::jsonb,     -- certificados de calibración (historial)
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table public.pesv_equipos enable row level security;
drop policy if exists "pesv_eq_sel" on public.pesv_equipos;
drop policy if exists "pesv_eq_mod" on public.pesv_equipos;
create policy "pesv_eq_sel" on public.pesv_equipos for select to authenticated using (public.fn_pesv_puede_ver());
create policy "pesv_eq_mod" on public.pesv_equipos for all to authenticated
  using (public.fn_pesv_puede_editar()) with check (public.fn_pesv_puede_editar());

-- Cifras agregadas para quien consulta el PESV sin ver el detalle (Gerencia)
create or replace function public.pesv_resumen_pruebas(p_desde date default (current_date - 365))
  returns jsonb language plpgsql stable security definer set search_path = public as
$$
begin
  if not public.fn_pesv_puede_ver() then raise exception 'Sin permiso'; end if;
  return (select jsonb_build_object(
    'total', count(*),
    'alcohol', count(*) filter (where tipo = 'alcohol'),
    'drogas', count(*) filter (where tipo = 'drogas'),
    'positivas', count(*) filter (where resultado = 'positivo'),
    'no_concluyentes', count(*) filter (where resultado = 'no_concluyente'),
    'con_soporte', count(*) filter (where jsonb_array_length(coalesce(soportes, '[]'::jsonb)) > 0),
    'por_mes', coalesce((select jsonb_object_agg(m, n) from (select to_char(fecha, 'YYYY-MM') m, count(*) n
                         from public.pesv_pruebas where fecha >= p_desde group by 1) x), '{}'::jsonb))
    from public.pesv_pruebas where fecha >= p_desde);
end
$$;
revoke all on function public.pesv_resumen_pruebas(date) from public;
grant execute on function public.pesv_resumen_pruebas(date) to authenticated;

-- Alertas de calibración (vencida o en los próximos 30 días) y de pruebas sin soporte
create or replace function public.pesv_alertas_equipos()
  returns int language plpgsql security definer set search_path = public as
$$
declare hoy date := (now() at time zone 'America/Bogota')::date; mes text := to_char(hoy, 'YYYY-MM'); total int := 0; c int;
begin
  if auth.uid() is not null and not public.fn_pesv_puede_editar() then raise exception 'Sin permiso'; end if;
  insert into public.notificaciones (id, para_rol, titulo, mensaje, tipo, ref_tabla, ref_id, vista, creada_por)
  select 'pesv-cal-' || e.id || '-' || mes || '-' || r, r,
         case when e.proxima_calibracion < hoy then '⛔ Calibración vencida: ' else '📅 Calibración próxima: ' end || e.nombre,
         coalesce(nullif(e.serial, '') || ' · ', '') || 'vence el ' || to_char(e.proxima_calibracion, 'DD/MM/YYYY')
           || case when e.proxima_calibracion < hoy then '. No uses el equipo hasta recalibrarlo.' else '.' end,
         'alerta', 'pesv', e.id, 'pesv', 'Sistema'
  from public.pesv_equipos e cross join lateral unnest(array['hseq', 'rrhh']) r
  where e.estado <> 'fuera_servicio' and e.proxima_calibracion is not null and e.proxima_calibracion <= hoy + 30
  on conflict (id) do nothing;
  get diagnostics c = row_count; total := total + c;
  return total;
end
$$;
revoke all on function public.pesv_alertas_equipos() from public;
grant execute on function public.pesv_alertas_equipos() to authenticated;

-- Sumarlo a la tarea programada del día 5 (si pg_cron está activo)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sc-pesv-autoevaluacion';
    perform cron.schedule('sc-pesv-autoevaluacion', '0 13 5 * *',
      'select public.pesv_autoevaluacion_mensual(''automatica''); select public.sig_alertas_mensuales(); select public.pesv_alertas_equipos();');
  end if;
end $$;

-- ─── 4. Gerencia: solo consulta en documentos y KPI ──────────
create or replace function public.fn_sig_puede_gestionar(k text)
  returns boolean language sql stable security definer set search_path = public as
$$
  select coalesce(case public.fn_sig_rol()
    when 'superadmin'    then true
    when 'analista_rrhh' then k = 'rrhh'
    when 'lider_rrhh'    then k = 'rrhh'
    when 'lider_area'    then public.fn_sig_area() is not null and k = 'area-' || public.fn_sig_area()
    else false end, false)
$$;

-- ─── 5. Delegaciones ─────────────────────────────────────────
create table if not exists public.delegaciones (
  id              text primary key,
  area_key        text not null,                 -- 'rrhh' · 'area-<id>'
  titulo          text not null,
  descripcion     text default '',
  prioridad       text default 'media' check (prioridad in ('alta','media','baja')),
  fecha_limite    date,
  estado          text not null default 'asignada'
                  check (estado in ('asignada','en_progreso','cumplida','validada','devuelta')),
  modulo          text default '',               -- origen: kpi, pesv, permisos, documentos…
  ref_id          text default '',
  respuesta       text default '',               -- lo que el área informa al cumplir
  observacion     text default '',               -- lo que Gerencia anota al validar o devolver
  creada_por      text default '',
  creada_por_id   uuid,
  actualizada_por text default '',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists delegaciones_area_idx on public.delegaciones (area_key, estado);
alter table public.delegaciones enable row level security;
drop policy if exists "deleg_sel" on public.delegaciones;
drop policy if exists "deleg_ins" on public.delegaciones;
drop policy if exists "deleg_upd" on public.delegaciones;
drop policy if exists "deleg_del" on public.delegaciones;
create policy "deleg_sel" on public.delegaciones for select to authenticated
  using (coalesce(public.fn_sig_rol() in ('superadmin','gerencia'), false) or public.fn_sig_puede_gestionar(area_key));
create policy "deleg_ins" on public.delegaciones for insert to authenticated
  with check (coalesce(public.fn_sig_rol() in ('superadmin','gerencia'), false));
create policy "deleg_upd" on public.delegaciones for update to authenticated
  using (coalesce(public.fn_sig_rol() in ('superadmin','gerencia'), false) or public.fn_sig_puede_gestionar(area_key))
  with check (coalesce(public.fn_sig_rol() in ('superadmin','gerencia'), false) or public.fn_sig_puede_gestionar(area_key));
create policy "deleg_del" on public.delegaciones for delete to authenticated
  using (coalesce(public.fn_sig_rol() in ('superadmin','gerencia'), false));

-- El área solo puede pasar la tarea a "en progreso" o "cumplida" y escribir su respuesta
create or replace function public.fn_delegacion_control()
  returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and coalesce(public.fn_sig_rol(), '') not in ('superadmin', 'gerencia') then
    if new.estado is distinct from old.estado and new.estado not in ('en_progreso', 'cumplida') then
      raise exception 'Solo Gerencia puede validar o devolver una tarea delegada';
    end if;
    if new.titulo is distinct from old.titulo or new.descripcion is distinct from old.descripcion
       or new.area_key is distinct from old.area_key or new.prioridad is distinct from old.prioridad
       or new.fecha_limite is distinct from old.fecha_limite or new.observacion is distinct from old.observacion then
      raise exception 'El área solo puede actualizar el estado y su respuesta';
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$$;
drop trigger if exists trg_delegacion_control on public.delegaciones;
create trigger trg_delegacion_control before update on public.delegaciones
  for each row execute function public.fn_delegacion_control();

-- Avisos por la campana en cada paso del flujo
create or replace function public.fn_delegacion_avisar()
  returns trigger language plpgsql security definer set search_path = public as
$$
declare destino text; tit text; msg text; sufijo text := extract(epoch from clock_timestamp())::bigint::text;
begin
  if tg_op = 'INSERT' then
    destino := new.area_key;
    tit := '📤 Gerencia te asignó: ' || new.titulo;
    msg := 'Prioridad ' || new.prioridad || coalesce(' · fecha límite ' || to_char(new.fecha_limite, 'DD/MM/YYYY'), '')
           || coalesce(' · ' || nullif(left(new.descripcion, 120), ''), '');
  elsif new.estado is distinct from old.estado then
    if new.estado = 'cumplida' then
      destino := 'gerencia'; tit := '✅ Tarea cumplida, por validar: ' || new.titulo;
      msg := coalesce(nullif(left(new.respuesta, 160), ''), 'El área marcó la tarea como cumplida.');
    elsif new.estado = 'validada' then
      destino := new.area_key; tit := '🏁 Gerencia validó: ' || new.titulo;
      msg := coalesce(nullif(left(new.observacion, 160), ''), 'La tarea quedó cerrada.');
    elsif new.estado = 'devuelta' then
      destino := new.area_key; tit := '↩️ Gerencia devolvió: ' || new.titulo;
      msg := coalesce(nullif(left(new.observacion, 160), ''), 'Revisa las observaciones y vuelve a gestionarla.');
    end if;
  end if;
  if destino is not null then
    insert into public.notificaciones (id, para_rol, titulo, mensaje, tipo, ref_tabla, ref_id, vista, creada_por)
    select 'del-' || new.id || '-' || new.estado || '-' || d || '-' || sufijo, d, tit, msg, 'delegacion', 'delegaciones', new.id,
           'delegaciones', coalesce(nullif(new.actualizada_por, ''), new.creada_por, '')
    from unnest(array[destino]) d
    on conflict (id) do nothing;
  end if;
  return new;
end
$$;
drop trigger if exists trg_delegacion_avisar on public.delegaciones;
create trigger trg_delegacion_avisar after insert or update on public.delegaciones
  for each row execute function public.fn_delegacion_avisar();

select pg_notify('pgrst', 'reload schema');

-- ─── Verificar ───────────────────────────────────────────────
-- select column_name from information_schema.columns where table_name = 'capacitaciones' and column_name like 'pesv%';  → 2 filas
-- select count(*) from public.pesv_pruebas;   select count(*) from public.pesv_equipos;   select count(*) from public.delegaciones;
