-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — PASO FINAL DE AUTH: ACTIVAR RLS
--
-- ⚠️ EJECUTAR SOLO CUANDO NO HAYA USUARIOS CONECTADOS (no durante
--    la capacitación). Si algo falla, revertir la tabla afectada con:
--    alter table <tabla> disable row level security;
--
-- Este script:
--   1. Crea las funciones auxiliares (si no existen)
--   2. Crea TODAS las políticas
--   3. Activa RLS tabla por tabla
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. FUNCIONES AUXILIARES ─────────────────────────────────
create or replace function public.fn_rol() returns text
  language sql stable security definer set search_path = public as
$$ select rol from public.perfiles where user_id = auth.uid() and coalesce(activo,true) $$;

create or replace function public.fn_area() returns text
  language sql stable security definer set search_path = public as
$$ select area_id from public.perfiles where user_id = auth.uid() and coalesce(activo,true) $$;

create or replace function public.fn_emp() returns text
  language sql stable security definer set search_path = public as
$$ select emp_id from public.perfiles where user_id = auth.uid() and coalesce(activo,true) $$;

create or replace function public.fn_es_rrhh() returns boolean
  language sql stable security definer set search_path = public as
$$ select public.fn_rol() in ('superadmin','analista_rrhh','juridico') $$;

create or replace function public.fn_lee_todo() returns boolean
  language sql stable security definer set search_path = public as
$$ select public.fn_rol() in ('superadmin','analista_rrhh','lider_rrhh','gerencia','juridico') $$;

create or replace function public.fn_emp_en_mi_area(p_emp_id text)
  returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.empleados e
     where e.id = p_emp_id and e.area_id::text = public.fn_area()) $$;

-- ─── 2. PERFILES ─────────────────────────────────────────────
drop policy if exists "perfil_propio"       on public.perfiles;
drop policy if exists "perfiles_rrhh_lee"   on public.perfiles;
drop policy if exists "perfiles_rrhh_edita" on public.perfiles;
drop policy if exists "perfiles_rrhh_crea"  on public.perfiles;

create policy "perfil_propio" on public.perfiles
  for select using (auth.uid() = user_id or public.fn_lee_todo());
create policy "perfiles_rrhh_edita" on public.perfiles
  for update using (public.fn_es_rrhh());
create policy "perfiles_rrhh_crea" on public.perfiles
  for insert with check (public.fn_es_rrhh() or auth.uid() = user_id);

-- ─── 3. EMPLEADOS ────────────────────────────────────────────
drop policy if exists "emp_sel" on public.empleados;
drop policy if exists "emp_wri" on public.empleados;
create policy "emp_sel" on public.empleados for select using (
  public.fn_lee_todo()
  or (public.fn_rol()='lider_area' and area_id::text = public.fn_area())
  or (public.fn_rol()='empleado'   and id = public.fn_emp())
);
create policy "emp_wri" on public.empleados for all using (public.fn_es_rrhh())
  with check (public.fn_es_rrhh());

-- ─── 4. TABLAS CON emp_id (permisos, incapacidades, vacaciones) ─
-- Lectura: RRHH todo · líder su área · empleado lo suyo
-- Escritura: RRHH, el líder de su área, y el empleado sus propias solicitudes
do $$
declare t text;
begin
  foreach t in array array['permisos','incapacidades','vacaciones'] loop
    execute format('drop policy if exists "%s_sel" on public.%I', t, t);
    execute format('drop policy if exists "%s_wri" on public.%I', t, t);
    execute format($f$create policy "%s_sel" on public.%I for select using (
        public.fn_lee_todo()
        or (public.fn_rol()='lider_area' and public.fn_emp_en_mi_area(emp_id))
        or (public.fn_rol()='empleado'   and emp_id = public.fn_emp())
      )$f$, t, t);
    execute format($f$create policy "%s_wri" on public.%I for all using (
        public.fn_es_rrhh()
        or (public.fn_rol()='lider_area' and public.fn_emp_en_mi_area(emp_id))
        or (public.fn_rol()='empleado'   and emp_id = public.fn_emp())
      ) with check (
        public.fn_es_rrhh()
        or (public.fn_rol()='lider_area' and public.fn_emp_en_mi_area(emp_id))
        or (public.fn_rol()='empleado'   and emp_id = public.fn_emp())
      )$f$, t, t);
  end loop;
end $$;

-- ─── 5. DISCIPLINARIOS ───────────────────────────────────────
drop policy if exists "disc_sel" on public.disciplinarios;
drop policy if exists "disc_wri" on public.disciplinarios;
create policy "disc_sel" on public.disciplinarios for select using (
  public.fn_lee_todo() or (public.fn_rol()='lider_area' and public.fn_emp_en_mi_area(emp_id))
);
create policy "disc_wri" on public.disciplinarios for all using (
  public.fn_es_rrhh() or public.fn_rol()='lider_area'
) with check (
  public.fn_es_rrhh() or public.fn_rol()='lider_area'
);

-- ─── 6. SOLICITUDES DEL EMPLEADO (certificados, cambios, descuentos) ─
do $$
declare t text;
begin
  foreach t in array array['solicitudes_certificados','solicitudes_cambio','descuentos'] loop
    execute format('drop policy if exists "%s_sel" on public.%I', t, t);
    execute format('drop policy if exists "%s_wri" on public.%I', t, t);
    execute format($f$create policy "%s_sel" on public.%I for select using (
        public.fn_lee_todo() or emp_id = public.fn_emp()
        or (public.fn_rol()='lider_area' and public.fn_emp_en_mi_area(emp_id))
      )$f$, t, t);
    execute format($f$create policy "%s_wri" on public.%I for all using (
        public.fn_es_rrhh() or emp_id = public.fn_emp()
        or public.fn_rol()='lider_area'
      ) with check (
        public.fn_es_rrhh() or emp_id = public.fn_emp()
        or public.fn_rol()='lider_area'
      )$f$, t, t);
  end loop;
end $$;

-- ─── 7. TABLAS COMPARTIDAS / SOLO RRHH ───────────────────────
-- Bodega: todos leen; RRHH y HSEQ escriben
drop policy if exists "bodega_sel" on public.bodega;
drop policy if exists "bodega_wri" on public.bodega;
create policy "bodega_sel" on public.bodega for select using (auth.uid() is not null);
create policy "bodega_wri" on public.bodega for all using (
  public.fn_es_rrhh() or (public.fn_rol()='lider_area' and public.fn_area()='14')
) with check (
  public.fn_es_rrhh() or (public.fn_rol()='lider_area' and public.fn_area()='14')
);

-- Horarios: RRHH y líder de su área
drop policy if exists "hor_sel" on public.horarios;
drop policy if exists "hor_wri" on public.horarios;
create policy "hor_sel" on public.horarios for select using (auth.uid() is not null);
create policy "hor_wri" on public.horarios for all using (
  public.fn_es_rrhh() or (public.fn_rol()='lider_area' and public.fn_emp_en_mi_area(emp_id))
) with check (
  public.fn_es_rrhh() or (public.fn_rol()='lider_area' and public.fn_emp_en_mi_area(emp_id))
);

-- Nómina, novedades, candidatos: solo RRHH escribe; RRHH y roles de lectura ven
do $$
declare t text;
begin
  foreach t in array array['nomina_formatos','novedades_area','candidatos'] loop
    execute format('drop policy if exists "%s_sel" on public.%I', t, t);
    execute format('drop policy if exists "%s_wri" on public.%I', t, t);
    execute format('create policy "%s_sel" on public.%I for select using (public.fn_lee_todo() or public.fn_rol()=''lider_area'')', t, t);
    execute format('create policy "%s_wri" on public.%I for all using (public.fn_es_rrhh()) with check (public.fn_es_rrhh())', t, t);
  end loop;
end $$;

-- Denuncias: el empleado crea la suya; solo RRHH/gerencia/jurídica las leen
drop policy if exists "den_sel" on public.denuncias;
drop policy if exists "den_ins" on public.denuncias;
create policy "den_sel" on public.denuncias for select using (
  public.fn_rol() in ('superadmin','analista_rrhh','gerencia','juridico') or emp_id = public.fn_emp()
);
create policy "den_ins" on public.denuncias for insert with check (auth.uid() is not null);
drop policy if exists "den_wri" on public.denuncias;
create policy "den_wri" on public.denuncias for update using (
  public.fn_rol() in ('superadmin','analista_rrhh','juridico','gerencia')
);

-- Auditoría: cualquiera inserta; solo superadmin/gerencia/jurídica leen
drop policy if exists "aud_sel" on public.auditoria;
drop policy if exists "aud_ins" on public.auditoria;
create policy "aud_sel" on public.auditoria for select using (
  public.fn_rol() in ('superadmin','gerencia','juridico')
);
create policy "aud_ins" on public.auditoria for insert with check (auth.uid() is not null);

-- ─── 8. ACTIVAR RLS ──────────────────────────────────────────
alter table public.perfiles                 enable row level security;
alter table public.empleados                enable row level security;
alter table public.permisos                 enable row level security;
alter table public.incapacidades            enable row level security;
alter table public.vacaciones               enable row level security;
alter table public.disciplinarios           enable row level security;
alter table public.solicitudes_certificados enable row level security;
alter table public.solicitudes_cambio       enable row level security;
alter table public.descuentos               enable row level security;
alter table public.bodega                   enable row level security;
alter table public.horarios                 enable row level security;
alter table public.nomina_formatos          enable row level security;
alter table public.novedades_area           enable row level security;
alter table public.candidatos               enable row level security;
alter table public.denuncias                enable row level security;
alter table public.auditoria                enable row level security;

select pg_notify('pgrst', 'reload schema');

-- ─── VERIFICACIÓN ────────────────────────────────────────────
-- Todas deben quedar en true:
-- select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename;
