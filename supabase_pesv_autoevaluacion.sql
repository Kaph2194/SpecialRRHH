-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — PESV AUTOGESTIONADO + ALERTAS DE KPI
-- Ejecutar completo en: Supabase → SQL Editor → Run
-- Requiere haber ejecutado antes:
--   supabase_permisos_aclaraciones.sql  (tabla notificaciones)
--   supabase_sig_pesv.sql               (PESV y KPI por área)
--
-- Qué hace:
--  1. Gestión por paso del PESV (responsable, fecha, estado, evidencias)
--     y un resumen del cumplimiento que la app guarda en cada cambio.
--  2. Autoevaluación mensual: el día 5 de cada mes a las 8:00 a. m.
--     (hora Colombia) guarda el % de cumplimiento del PESV y avisa a
--     RRHH, HSEQ, Gerencia y Super Admin por la campana 🔔.
--     El día 1 recuerda actualizar evidencias antes del corte.
--  3. Alertas de KPI y documentos el día 5: KPI sin medir, KPI fuera
--     de meta, documentos con revisión vencida o próxima, y acciones
--     del PESV vencidas. Llegan al área responsable.
--  4. Notificaciones por rol y por área (gerencia, superadmin, hseq,
--     area-<id>), además de las que ya existían.
-- ═══════════════════════════════════════════════════════════════

do $$ begin
  if to_regclass('public.notificaciones') is null then
    raise exception 'Primero ejecuta supabase_permisos_aclaraciones.sql (crea la tabla notificaciones).';
  end if;
  if to_regclass('public.pesv_evaluaciones') is null then
    raise exception 'Primero ejecuta supabase_sig_pesv.sql (crea el PESV y los KPI por área).';
  end if;
end $$;

-- ─── 1. Columnas nuevas del PESV ─────────────────────────────
alter table public.pesv_evaluaciones add column if not exists resumen jsonb default '{}'::jsonb;
alter table public.pesv_evaluaciones add column if not exists gestion jsonb default '{}'::jsonb;

-- ─── 2. Historial de autoevaluaciones mensuales ──────────────
create table if not exists public.pesv_autoevaluaciones (
  id         text primary key,
  eval_id    text not null,
  anio       int,
  periodo    text not null,               -- 'AAAA-MM'
  pct        numeric,                     -- % de cumplimiento
  avance     numeric,                     -- % de criterios calificados
  resumen    jsonb default '{}'::jsonb,
  origen     text default 'automatica',   -- automatica · app · manual
  creada_por text default '',
  created_at timestamptz default now(),
  unique (eval_id, periodo)
);
alter table public.pesv_autoevaluaciones enable row level security;
drop policy if exists "pesv_auto_sel" on public.pesv_autoevaluaciones;
drop policy if exists "pesv_auto_del" on public.pesv_autoevaluaciones;
create policy "pesv_auto_sel" on public.pesv_autoevaluaciones for select to authenticated using (public.fn_pesv_puede_ver());
create policy "pesv_auto_del" on public.pesv_autoevaluaciones for delete to authenticated using (public.fn_pesv_puede_editar());
-- Las inserciones se hacen solo a través de pesv_autoevaluacion_mensual()

-- ─── 3. Notificaciones por rol y por área ────────────────────
drop policy if exists "notif_sel" on public.notificaciones;
drop policy if exists "notif_upd" on public.notificaciones;
create policy "notif_sel" on public.notificaciones for select to authenticated using (
     (para_emp_id is not null and para_emp_id in (select public.fn_mis_emp_ids()))
  or (para_user_id = auth.uid())
  or (para_rol = 'rrhh'       and public.fn_rol_notif() in ('superadmin','analista_rrhh','lider_rrhh'))
  or (para_rol = 'gerencia'   and public.fn_rol_notif() = 'gerencia')
  or (para_rol = 'superadmin' and public.fn_rol_notif() = 'superadmin')
  or (para_rol = 'hseq'       and public.fn_rol_notif() = 'lider_area' and public.fn_sig_area() = '14')
  or (para_rol like 'area-%'  and public.fn_rol_notif() = 'lider_area' and para_rol = 'area-' || public.fn_sig_area())
);
create policy "notif_upd" on public.notificaciones for update to authenticated using (
     (para_emp_id is not null and para_emp_id in (select public.fn_mis_emp_ids()))
  or (para_user_id = auth.uid())
  or (para_rol = 'rrhh'       and public.fn_rol_notif() in ('superadmin','analista_rrhh','lider_rrhh'))
  or (para_rol = 'gerencia'   and public.fn_rol_notif() = 'gerencia')
  or (para_rol = 'superadmin' and public.fn_rol_notif() = 'superadmin')
  or (para_rol = 'hseq'       and public.fn_rol_notif() = 'lider_area' and public.fn_sig_area() = '14')
  or (para_rol like 'area-%'  and public.fn_rol_notif() = 'lider_area' and para_rol = 'area-' || public.fn_sig_area())
);

-- Nombre del mes en español a partir de 'AAAA-MM'
create or replace function public.fn_mes_es(p text)
  returns text language sql immutable as
$$ select (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])
          [split_part(p, '-', 2)::int] || ' ' || split_part(p, '-', 1) $$;

-- ─── 4. Autoevaluación mensual del PESV ──────────────────────
-- Toma el resumen que la app guardó en la evaluación más reciente y lo
-- deja como foto del mes. p_forzar = true reemplaza la foto del mes.
create or replace function public.pesv_autoevaluacion_mensual(p_origen text default 'automatica', p_forzar boolean default false)
  returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  ev  record;
  per text := to_char(now() at time zone 'America/Bogota', 'YYYY-MM');
  pct numeric;
  n   int := 0;
begin
  -- Desde la app solo quienes gestionan el PESV; pg_cron no tiene usuario
  if auth.uid() is not null and not public.fn_pesv_puede_editar() then
    raise exception 'Sin permiso para registrar la autoevaluación del PESV';
  end if;
  select * into ev from public.pesv_evaluaciones order by anio desc, updated_at desc limit 1;
  if ev.id is null or coalesce(ev.resumen ->> 'pct', '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_resumen');
  end if;
  pct := round((ev.resumen ->> 'pct')::numeric, 1);

  if p_forzar then
    insert into public.pesv_autoevaluaciones (id, eval_id, anio, periodo, pct, avance, resumen, origen, creada_por)
    values (ev.id || '-' || per, ev.id, ev.anio, per, pct, (ev.resumen ->> 'avance')::numeric, ev.resumen, p_origen, coalesce(ev.actualizado_por, ''))
    on conflict (eval_id, periodo) do update
      set pct = excluded.pct, avance = excluded.avance, resumen = excluded.resumen, origen = excluded.origen, created_at = now();
    n := 1;
  else
    insert into public.pesv_autoevaluaciones (id, eval_id, anio, periodo, pct, avance, resumen, origen, creada_por)
    values (ev.id || '-' || per, ev.id, ev.anio, per, pct, (ev.resumen ->> 'avance')::numeric, ev.resumen, p_origen, 'Sistema')
    on conflict (eval_id, periodo) do nothing;
    get diagnostics n = row_count;
  end if;

  if n > 0 then
    insert into public.notificaciones (id, para_rol, titulo, mensaje, tipo, ref_tabla, ref_id, vista, creada_por)
    select 'pesv-auto-' || per || '-' || r || case when p_forzar then '-' || extract(epoch from now())::bigint else '' end, r,
           '📊 Autoevaluación PESV ' || public.fn_mes_es(per) || ': ' || pct || '%',
           coalesce(ev.resumen ->> 'pasosCumplen', '0') || ' de ' || coalesce(ev.resumen ->> 'pasosAplican', '24') || ' pasos cumplen · '
             || coalesce(ev.resumen ->> 'noCumple', '0') || ' criterios en "no cumple" · '
             || coalesce(ev.resumen ->> 'accVencidas', '0') || ' acciones vencidas',
           'pesv', 'pesv', ev.id, 'pesv', 'Sistema'
    from unnest(array['rrhh', 'hseq', 'gerencia', 'superadmin']) r
    on conflict (id) do nothing;
  end if;
  return jsonb_build_object('ok', true, 'periodo', per, 'pct', pct, 'nueva', n > 0);
end
$$;

-- Recordatorio del día 1
create or replace function public.pesv_recordatorio()
  returns int language plpgsql security definer set search_path = public as
$$
declare per text := to_char(now() at time zone 'America/Bogota', 'YYYY-MM');
begin
  insert into public.notificaciones (id, para_rol, titulo, mensaje, tipo, ref_tabla, vista, creada_por)
  select 'pesv-rec-' || per || '-' || r, r, '🗓 Actualiza el PESV antes del día 5',
         'El 5 de ' || public.fn_mes_es(per) || ' se registra la autoevaluación mensual. Califica los criterios y carga las evidencias pendientes.',
         'recordatorio', 'pesv', 'pesv', 'Sistema'
  from unnest(array['rrhh', 'hseq']) r
  on conflict (id) do nothing;
  return 1;
end
$$;

-- ─── 5. Alertas de KPI, documentos y acciones ────────────────
create or replace function public.sig_alertas_mensuales()
  returns int language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
  mes text := to_char((now() at time zone 'America/Bogota')::date, 'YYYY-MM');
  total int := 0; c int;
begin
  if auth.uid() is not null and coalesce(public.fn_sig_rol(), '') <> 'superadmin' then
    raise exception 'Solo el Super Admin puede generar las alertas manualmente';
  end if;

  -- KPI sin medición en el último periodo esperado según su frecuencia
  insert into public.notificaciones (id, para_rol, titulo, mensaje, tipo, ref_tabla, ref_id, vista, creada_por)
  select 'kpi-sin-' || k.id || '-' || x.esperado, k.area_key, '⏰ KPI sin medir: ' || k.nombre,
         'Falta registrar la medición de ' || public.fn_mes_es(x.esperado) || ' (frecuencia ' || coalesce(k.frecuencia, 'mensual') || ').',
         'alerta', 'sig_kpis', k.id, 'biblioteca', 'Sistema'
  from public.sig_kpis k
  cross join lateral (select case coalesce(k.frecuencia, 'mensual')
      when 'trimestral' then to_char(date_trunc('quarter', hoy) - interval '1 month', 'YYYY-MM')
      when 'semestral'  then case when extract(month from hoy) <= 6 then (extract(year from hoy)::int - 1) || '-12'
                                  else extract(year from hoy)::int || '-06' end
      when 'anual'      then (extract(year from hoy)::int - 1) || '-12'
      else to_char(hoy - interval '1 month', 'YYYY-MM') end as esperado) x
  where coalesce(k.activo, true)
    and not exists (select 1 from jsonb_array_elements(coalesce(k.mediciones, '[]'::jsonb)) m where m ->> 'periodo' >= x.esperado)
  on conflict (id) do nothing;
  get diagnostics c = row_count; total := total + c;

  -- KPI cuya última medición está fuera de meta (más de 15 % de desviación, igual que el semáforo de la app)
  insert into public.notificaciones (id, para_rol, titulo, mensaje, tipo, ref_tabla, ref_id, vista, creada_por)
  select 'kpi-rojo-' || u.id || '-' || (u.um ->> 'periodo') || '-' || r, r, '🔴 KPI fuera de meta: ' || u.nombre,
         'Valor ' || (u.um ->> 'valor') || coalesce(' ' || nullif(u.unidad, ''), '') || ' frente a meta ' || u.meta
           || coalesce(' ' || nullif(u.unidad, ''), '') || ' (' || public.fn_mes_es(u.um ->> 'periodo') || ').',
         'alerta', 'sig_kpis', u.id, 'biblioteca', 'Sistema'
  from (select k.*, (select m from jsonb_array_elements(coalesce(k.mediciones, '[]'::jsonb)) m
                     where (m ->> 'valor') ~ '^-?[0-9]+(\.[0-9]+)?$' order by m ->> 'periodo' desc limit 1) as um
        from public.sig_kpis k where k.meta is not null and coalesce(k.activo, true)) u
  cross join lateral unnest(array[u.area_key, 'gerencia']) r
  where u.um is not null
    and ((u.sentido = 'menor' and (u.um ->> 'valor')::numeric > u.meta * 1.15)
      or (coalesce(u.sentido, 'mayor') <> 'menor' and (u.um ->> 'valor')::numeric < u.meta * 0.85))
  on conflict (id) do nothing;
  get diagnostics c = row_count; total := total + c;

  -- Documentos con revisión vencida o en los próximos 30 días
  insert into public.notificaciones (id, para_rol, titulo, mensaje, tipo, ref_tabla, ref_id, vista, creada_por)
  select 'doc-rev-' || d.id || '-' || mes, d.area_key,
         case when d.fecha_revision < hoy then '⏰ Revisión vencida: ' else '📅 Revisión próxima: ' end
           || coalesce(nullif(d.codigo, '') || ' · ', '') || d.nombre,
         'Fecha de revisión: ' || to_char(d.fecha_revision, 'DD/MM/YYYY') || '. Actualiza el documento o confirma su vigencia.',
         'alerta', 'sig_documentos', d.id, 'biblioteca', 'Sistema'
  from public.sig_documentos d
  where d.estado <> 'obsoleto' and d.fecha_revision is not null and d.fecha_revision <= hoy + 30
  on conflict (id) do nothing;
  get diagnostics c = row_count; total := total + c;

  -- Acciones del plan PESV vencidas (evaluación más reciente)
  insert into public.notificaciones (id, para_rol, titulo, mensaje, tipo, ref_tabla, ref_id, vista, creada_por)
  select 'pesv-acc-' || ev.id || '-' || (a ->> 'id') || '-' || mes || '-' || r, r, '⏰ Acción PESV vencida (paso ' || coalesce(a ->> 'paso', '?') || ')',
         left(coalesce(a ->> 'descripcion', ''), 140) || ' · venció el ' || to_char((a ->> 'fechaLimite')::date, 'DD/MM/YYYY')
           || coalesce(' · ' || nullif(a ->> 'responsable', ''), ''),
         'alerta', 'pesv', ev.id, 'pesv', 'Sistema'
  from (select * from public.pesv_evaluaciones order by anio desc, updated_at desc limit 1) ev
  cross join lateral jsonb_array_elements(coalesce(ev.acciones, '[]'::jsonb)) a
  cross join lateral unnest(array['hseq', 'rrhh']) r
  where coalesce(a ->> 'estado', 'abierta') <> 'cerrada'
    and coalesce(a ->> 'fechaLimite', '') ~ '^\d{4}-\d{2}-\d{2}$'
    and (a ->> 'fechaLimite')::date < hoy
  on conflict (id) do nothing;
  get diagnostics c = row_count; total := total + c;

  return total;
end
$$;

revoke all on function public.pesv_autoevaluacion_mensual(text, boolean), public.pesv_recordatorio(),
  public.sig_alertas_mensuales() from public;
grant execute on function public.pesv_autoevaluacion_mensual(text, boolean), public.sig_alertas_mensuales() to authenticated;

-- ─── 6. Programación automática (pg_cron) ────────────────────
-- Día 5, 8:00 a. m. Colombia (13:00 UTC): autoevaluación + alertas.
-- Día 1, 8:00 a. m.: recordatorio de actualizar el PESV.
-- Si pg_cron no se puede activar, la app registra la autoevaluación
-- la primera vez que alguien del PESV entra a partir del día 5.
do $$
begin
  begin
    execute 'create extension if not exists pg_cron';
  exception when others then
    raise notice 'No se pudo activar pg_cron (%). Actívalo en Database → Extensions y vuelve a ejecutar este bloque.', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('sc-pesv-autoevaluacion', 'sc-pesv-recordatorio');
    perform cron.schedule('sc-pesv-autoevaluacion', '0 13 5 * *',
      'select public.pesv_autoevaluacion_mensual(''automatica''); select public.sig_alertas_mensuales();');
    perform cron.schedule('sc-pesv-recordatorio', '0 13 1 * *', 'select public.pesv_recordatorio();');
    raise notice 'Tareas programadas: autoevaluación el día 5 y recordatorio el día 1 (8:00 a. m. hora Colombia).';
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

-- ─── Verificar ───────────────────────────────────────────────
-- select jobname, schedule from cron.job where jobname like 'sc-pesv%';   → 2 filas
-- select * from public.pesv_autoevaluaciones order by periodo desc;
-- Probar ya, sin esperar al día 5:
--   select public.pesv_autoevaluacion_mensual('manual', true);
--   select public.sig_alertas_mensuales();
