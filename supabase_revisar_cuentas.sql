-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — REVISIÓN Y CORRECCIÓN DE CUENTAS DE ACCESO
--
-- Detecta y repara los problemas que impiden entrar a la plataforma:
-- cuentas que no existen, perfiles vacíos o incompletos, cuentas sin
-- confirmar, enlaces rotos con la ficha del empleado.
--
-- CÓMO USARLO
--   1. Ejecuta la PARTE 1 completa y revisa los resultados.
--   2. Ejecuta la PARTE 2 (corrige lo que se puede corregir con SQL).
--   3. Ejecuta la PARTE 3 para verificar que quedó limpio.
--
-- La PARTE 2 es idempotente: puedes correrla varias veces sin daño.
-- NO toca contraseñas ni cuentas administrativas.
-- ═══════════════════════════════════════════════════════════════


-- ─── PREPARACIÓN ───────────────────────────────────────────────
-- Vista de diagnóstico en un esquema aparte. NO se crea en `public`
-- a propósito: una vista sobre auth.users en `public` quedaría
-- expuesta por la API REST y filtraría los correos de todos.
create schema if not exists diag;

create or replace view diag.cuentas as
select
  u.id                      as user_id,
  lower(u.email)            as correo,
  u.email_confirmed_at,
  u.last_sign_in_at,
  u.raw_user_meta_data      as metadata,
  p.user_id is not null     as tiene_perfil,
  p.rol, p.area_id, p.emp_id, p.cedula, p.nombre, p.activo,
  e.id                      as emp_encontrado,
  e.name                    as emp_nombre,
  e.cedula                  as emp_cedula,
  e.status                  as emp_status
from auth.users u
left join public.perfiles p on p.user_id = u.id
-- Busca la ficha de empleado que corresponde al correo de la cuenta:
-- su correo propio, o el correo interno derivado de la cédula.
left join lateral (
  select e2.*
  from public.empleados e2
  where lower(trim(e2.email)) = lower(u.email)
     or regexp_replace(e2.cedula, '[.\s,]', '', 'g')
        || '@empleados.specialcar.com.co' = lower(u.email)
  order by (e2.status = 'activo') desc
  limit 1
) e on true;


-- ═══════════════════════════════════════════════════════════════
-- PARTE 1 · DIAGNÓSTICO
-- ═══════════════════════════════════════════════════════════════

-- 1.1 · Resumen general ────────────────────────────────────────
select
  (select count(*) from public.empleados where status = 'activo')      as empleados_activos,
  (select count(*) from auth.users)                                    as cuentas_auth,
  (select count(*) from public.perfiles)                               as perfiles,
  (select count(*) from diag.cuentas where not tiene_perfil)           as sin_perfil,
  (select count(*) from diag.cuentas
     where rol = 'empleado' and emp_id is null)                        as empleado_sin_ficha,
  (select count(*) from diag.cuentas where email_confirmed_at is null) as sin_confirmar,
  (select count(*) from diag.cuentas where activo = false)             as perfiles_inactivos;


-- 1.2 · Empleados activos SIN cuenta de acceso ─────────────────
-- No pueden entrar de ninguna forma. Se corrigen en la PARTE 3.
select e.name, e.cedula, e.email, e.area_id,
       case when coalesce(trim(e.email),'') = '' then 'correo interno por cédula'
            else 'correo propio' end as tipo_correo
from public.empleados e
where e.status = 'activo'
  and not exists (
    select 1 from auth.users u
    where lower(u.email) = lower(nullif(trim(e.email), ''))
       or lower(u.email) = regexp_replace(e.cedula, '[.\s,]', '', 'g')
                           || '@empleados.specialcar.com.co')
order by e.name;


-- 1.3 · Cuentas SIN perfil ─────────────────────────────────────
-- Entran a Auth pero la app las rechaza: "Tu cuenta no tiene
-- un perfil asignado". Las repara la PARTE 2.
select correo, metadata, emp_nombre, emp_status
from diag.cuentas
where not tiene_perfil
order by correo;


-- 1.4 · Perfiles de empleado SIN enlace a su ficha ─────────────
-- La app los rechaza: "No se encontró tu ficha de empleado".
-- Es el caso que acabamos de ver. Los repara la PARTE 2.
select correo, rol, emp_id, cedula, nombre,
       emp_encontrado as emp_id_correcto, emp_nombre, emp_status
from diag.cuentas
where rol = 'empleado'
  and (emp_id is null or coalesce(cedula,'') = '' or coalesce(nombre,'') = '')
order by correo;


-- 1.5 · Perfiles que apuntan a una ficha inexistente ───────────
-- emp_id quedó colgando (la ficha se borró o el id está mal).
select c.correo, c.rol, c.emp_id, c.nombre, c.emp_encontrado as emp_id_sugerido
from diag.cuentas c
where c.emp_id is not null
  and not exists (select 1 from public.empleados e where e.id = c.emp_id)
order by c.correo;


-- 1.6 · Cuentas SIN confirmar ──────────────────────────────────
-- Nacieron esperando un correo de confirmación que nunca llegó.
-- No pueden iniciar sesión. Las repara la PARTE 2.
select correo, nombre, rol, email_confirmed_at
from diag.cuentas
where email_confirmed_at is null
order by correo;


-- 1.7 · Metadata vacío ─────────────────────────────────────────
-- Cuentas creadas a mano sin pegar el JSON. Funcionan si el perfil
-- está bien, pero conviene dejarlas consistentes (PARTE 2).
select correo, rol, metadata
from diag.cuentas
where metadata - 'email_verified' = '{}'::jsonb
   or metadata->>'rol' is null
order by correo;


-- 1.8 · Líderes de área sin área asignada ──────────────────────
-- Entran, pero no ven a su equipo. Se corrige a mano: hay que
-- saber qué área le toca a cada quien.
select correo, nombre, rol, area_id
from diag.cuentas
where rol = 'lider_area' and coalesce(area_id,'') = ''
order by correo;


-- 1.9 · Perfiles desactivados ──────────────────────────────────
-- activo = false bloquea el acceso. Revisa si es intencional
-- (personal retirado) o un error.
select c.correo, c.nombre, c.rol, c.emp_id, e.status as estado_ficha
from diag.cuentas c
left join public.empleados e on e.id = c.emp_id
where c.activo = false
order by c.correo;


-- 1.10 · Cuentas de personal YA RETIRADO que siguen activas ────
-- Riesgo de seguridad: alguien que ya no trabaja aquí puede entrar.
select c.correo, c.nombre, e.name as empleado, e.status
from diag.cuentas c
join public.empleados e on e.id = c.emp_id
where e.status <> 'activo' and c.activo = true
order by c.correo;


-- 1.11 · Correos repetidos en las fichas ───────────────────────
-- Dos personas no pueden compartir cuenta. A las repetidas el
-- script de creación les asigna el correo interno por cédula.
select lower(trim(email)) as correo, count(*) as personas,
       string_agg(name, ' | ') as quienes
from public.empleados
where status = 'activo' and coalesce(trim(email),'') <> ''
group by 1 having count(*) > 1
order by 2 desc;


-- 1.12 · Fichas activas sin cédula ─────────────────────────────
-- Sin cédula no hay usuario ni contraseña inicial posible.
select id, name, email, area_id
from public.empleados
where status = 'activo' and coalesce(trim(cedula),'') = ''
order by name;



-- ═══════════════════════════════════════════════════════════════
-- PARTE 2 · CORRECCIÓN AUTOMÁTICA
--
-- Ejecuta este bloque completo. Solo toca perfiles de empleado;
-- las cuentas administrativas quedan intactas. No cambia ninguna
-- contraseña.
-- ═══════════════════════════════════════════════════════════════

begin;

-- 2.1 · Crear los perfiles que faltan ──────────────────────────
insert into public.perfiles (user_id, rol, area_id, emp_id, cedula, nombre, activo)
select
  c.user_id,
  coalesce(c.metadata->>'rol', 'empleado'),
  c.metadata->>'area_id',
  coalesce(c.metadata->>'emp_id', c.emp_encontrado),
  coalesce(nullif(c.metadata->>'cedula',''),
           regexp_replace(c.emp_cedula, '[.\s,]', '', 'g')),
  coalesce(nullif(c.metadata->>'nombre',''), c.emp_nombre, ''),
  true
from diag.cuentas c
where not c.tiene_perfil
on conflict (user_id) do nothing;


-- 2.2 · Completar los perfiles de empleado incompletos ─────────
-- Rellena solo lo que está vacío; no pisa datos ya correctos.
update public.perfiles p
set emp_id = coalesce(p.emp_id, c.emp_encontrado),
    cedula = coalesce(nullif(p.cedula,''),
                      regexp_replace(c.emp_cedula, '[.\s,]', '', 'g')),
    nombre = coalesce(nullif(p.nombre,''), c.emp_nombre, '')
from diag.cuentas c
where c.user_id = p.user_id
  and p.rol = 'empleado'
  and c.emp_encontrado is not null
  and (p.emp_id is null or coalesce(p.cedula,'') = '' or coalesce(p.nombre,'') = '');


-- 2.3 · Reparar emp_id que apunta a una ficha inexistente ──────
update public.perfiles p
set emp_id = c.emp_encontrado
from diag.cuentas c
where c.user_id = p.user_id
  and p.rol = 'empleado'
  and p.emp_id is not null
  and c.emp_encontrado is not null
  and not exists (select 1 from public.empleados e where e.id = p.emp_id);


-- 2.4 · Confirmar las cuentas que quedaron pendientes ──────────
-- Son cuentas internas creadas por la empresa, no registros
-- públicos: confirmarlas es el comportamiento esperado.
update auth.users u
set email_confirmed_at = coalesce(u.email_confirmed_at, now())
where u.email_confirmed_at is null
  and exists (select 1 from public.perfiles p where p.user_id = u.id);


-- 2.5 · Sincronizar el metadata con el perfil ──────────────────
-- Deja las cuentas creadas a mano iguales a las del script.
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
       'rol',     p.rol,
       'area_id', p.area_id,
       'emp_id',  p.emp_id,
       'cedula',  p.cedula,
       'nombre',  nullif(p.nombre, '')))
from public.perfiles p
where p.user_id = u.id
  and (u.raw_user_meta_data->>'rol' is distinct from p.rol
    or u.raw_user_meta_data->>'emp_id' is distinct from p.emp_id
    or u.raw_user_meta_data->>'cedula' is distinct from p.cedula);

commit;


-- 2.6 · OPCIONAL · Desactivar el acceso del personal retirado ──
-- Revisa primero el resultado de 1.10. Descomenta si estás de
-- acuerdo con cerrarles el acceso.
--
-- update public.perfiles p
-- set activo = false
-- from public.empleados e
-- where e.id = p.emp_id and e.status <> 'activo' and p.activo = true;



-- ═══════════════════════════════════════════════════════════════
-- PARTE 3 · LO QUE NO SE PUEDE ARREGLAR CON SQL
-- ═══════════════════════════════════════════════════════════════
--
-- Las cuentas que NO EXISTEN (consulta 1.2) no se pueden crear
-- desde aquí: insertar a mano en auth.users exige escribir el hash
-- de la contraseña y es fácil dejar la cuenta inservible.
--
-- Hay dos caminos:
--
-- A) Pocas cuentas → créalas en Authentication → Users → Add user,
--    con "Auto Confirm User" marcado y este metadata:
--      {"rol":"empleado","emp_id":"<id de la ficha>",
--       "cedula":"<cédula>","nombre":"<nombre completo>"}
--    Si se te olvida el metadata, vuelve a correr la PARTE 2:
--    detecta el perfil vacío y lo completa sola.
--
-- B) Varias → vuelve a correr `crear_usuarios.js`. Es seguro
--    repetirlo: las cuentas que ya existen las salta sin tocarlas,
--    solo crea las que faltan, y genera de nuevo el CSV con las
--    credenciales iniciales (cédula como contraseña).
--
-- Después de cualquiera de los dos, ejecuta otra vez la PARTE 2
-- y luego la verificación de abajo.


-- ─── VERIFICACIÓN FINAL ────────────────────────────────────────
-- Todo debe quedar en cero menos las dos primeras columnas.
select
  (select count(*) from public.empleados where status = 'activo') as empleados_activos,
  (select count(*) from auth.users)                               as cuentas_auth,
  (select count(*) from diag.cuentas where not tiene_perfil)      as sin_perfil,
  (select count(*) from diag.cuentas
     where rol = 'empleado' and emp_id is null)                   as empleado_sin_ficha,
  (select count(*) from diag.cuentas
     where email_confirmed_at is null)                            as sin_confirmar,
  (select count(*) from public.empleados e
     where e.status = 'activo' and not exists (
       select 1 from auth.users u
       where lower(u.email) = lower(nullif(trim(e.email), ''))
          or lower(u.email) = regexp_replace(e.cedula,'[.\s,]','','g')
                              || '@empleados.specialcar.com.co'))  as activos_sin_cuenta;


-- ─── LIMPIEZA (cuando termines) ────────────────────────────────
-- La vista de diagnóstico no estorba y sirve para revisar más
-- adelante, pero si prefieres no dejarla:
-- drop schema diag cascade;
