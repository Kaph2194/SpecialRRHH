# Migración a Supabase Auth — Guía paso a paso

La app ya trae el código listo. Falta configurar Supabase y crear las cuentas.
**Sigue el orden.** El último paso (RLS) es el que activa la seguridad real.

---

## Paso 1 · Revisar los correos de los empleados

Antes de decidir cómo entra cada quien, mira cómo están tus datos.
En **SQL Editor**, ejecuta:

```sql
-- ¿Cuántos tienen correo y cuántos no?
select
  count(*) filter (where email is null or email = '')            as sin_correo,
  count(*) filter (where email is not null and email <> '')      as con_correo,
  count(*)                                                        as total
from empleados where status = 'activo';

-- ¿Hay correos repetidos? (dos personas NO pueden compartir cuenta)
select lower(trim(email)) as correo, count(*) as veces, string_agg(name, ' | ') as personas
from empleados
where email is not null and email <> '' and status = 'activo'
group by 1 having count(*) > 1 order by 2 desc;
```

**Importante:** si aparecen correos repetidos (por ejemplo un correo de cargo como
`directortransporte@specialcar.com.co` usado por varias personas), esas cuentas
deben corregirse antes de migrar: Supabase exige un correo único por usuario.

## Paso 2 · Configurar Authentication

En **Authentication → Sign In / Providers → Email**:

- **Confirm email**: DESACTIVADO. (Si queda activo, las cuentas nacen bloqueadas
  esperando un correo de confirmación que nunca llegará a los correos internos.)
- **Minimum password length**: 8.
- Deja habilitado "Enable email provider".

## Paso 3 · Crear la estructura

Ejecuta `supabase_auth_paso1.sql` completo en el SQL Editor.
Crea la tabla `perfiles`, las funciones de rol/área y el disparador que
genera el perfil automáticamente cada vez que nace una cuenta.

## Paso 4 · Crear las cuentas administrativas

**Authentication → Users → Add user** (marca "Auto Confirm User"), una por una.
En *User Metadata* pega el JSON correspondiente:

| Cuenta | Correo sugerido | Metadata |
|---|---|---|
| Super Admin | `admin@specialcar.com.co` | `{"rol":"superadmin","nombre":"Administrador"}` |
| Analista RRHH | `analista.rh@specialcar.com.co` | `{"rol":"analista_rrhh","nombre":"Analista RRHH"}` |
| Líder RRHH | `lider.rh@specialcar.com.co` | `{"rol":"lider_rrhh","nombre":"Líder RRHH"}` |
| Gerencia | `gerencia@specialcar.com.co` | `{"rol":"gerencia","nombre":"Gerencia"}` |
| Jurídica | `juridica@specialcar.com.co` | `{"rol":"juridico","nombre":"Jurídica"}` |
| Líder Financiera | `lider.financiera@specialcar.com.co` | `{"rol":"lider_area","area_id":"5","nombre":"Líder Financiera"}` |

Para los demás líderes de área, usa `"rol":"lider_area"` con el `area_id` que
corresponda (1 Taller, 2 Ventas, 3 Logística, 4 TI, 5 Finanzas, 6 RRHH,
7 Marketing, 8 Seguros, 9 Legal, 10 Infraestructura, 11 Academy,
12 Operaciones, 13 Gerencia, 14 HSEQ).

Verifica que los perfiles se hayan creado solos:

```sql
select p.rol, p.area_id, p.nombre, u.email
from perfiles p join auth.users u on u.id = p.user_id
order by p.rol;
```

## Paso 5 · Crear las cuentas de los 132 empleados

Se hace **una sola vez** con el script `crear_usuarios.js` (incluido).
Necesita la clave `service_role`, que **nunca** debe subirse a GitHub ni
ponerse en `app.js`: quien la tenga controla toda la base de datos.

```bash
# En tu PC, en la carpeta del proyecto:
npm init -y
npm install @supabase/supabase-js

# Copia la clave desde Supabase → Settings → API → service_role
# (Windows PowerShell)
$env:SB_SERVICE_KEY="eyJhbGciOi..."
node crear_usuarios.js
```

Cada empleado queda con:
- **Usuario**: su cédula (o su correo, si lo tiene registrado y es único)
- **Contraseña inicial**: su cédula

De aquí en adelante, los empleados nuevos que registre RRHH desde la app
obtienen su cuenta automáticamente, sin volver a tocar Supabase.

## Paso 6 · Probar antes de blindar

Con RLS todavía apagado, entra con cada tipo de usuario y confirma que:

- El **superadmin** ve todo.
- El **analista RRHH** aprueba permisos, incapacidades y documentos.
- El **líder de área** ve solo su equipo y solo aprueba permisos < 2 h.
- **Gerencia** y **jurídica** ven todo pero sin botones de edición.
- Un **empleado** entra con su cédula y ve únicamente sus datos.

## Paso 7 · Activar RLS (el paso que blinda los datos)

Solo cuando el Paso 6 esté verificado. Ejecuta la **Parte 2** de
`supabase_setup.sql` (las políticas) y luego activa RLS tabla por tabla:

```sql
alter table public.empleados       enable row level security;
alter table public.permisos        enable row level security;
alter table public.incapacidades   enable row level security;
alter table public.vacaciones      enable row level security;
alter table public.disciplinarios  enable row level security;
alter table public.novedades_area  enable row level security;
alter table public.nomina_formatos enable row level security;
alter table public.descuentos      enable row level security;
alter table public.denuncias       enable row level security;
alter table public.auditoria       enable row level security;
```

**Si algo se rompe**, se revierte al instante con
`alter table ... disable row level security;` sobre la tabla afectada.

## Paso 8 · Cerrar la puerta de atrás

Cuando todo funcione con Auth:

1. Borra del `app.js` el arreglo `USERS` con las contraseñas en texto plano.
2. Quita los botones de acceso rápido del login, si quedan.
3. Cambia las contraseñas de las cuentas administrativas por unas reales.

---

### Qué gana cada quien con este cambio

Hoy la seguridad vive en la pantalla: cualquiera con la consola del navegador
puede leer toda la base. Después de la migración, el servidor mismo le niega
los datos a quien no le corresponden — un líder de Taller no puede obtener los
salarios de Ventas ni aunque manipule el código.

---

## ⚠️ Personas que son líder Y empleado a la vez

Un líder de área normalmente **también tiene ficha de empleado** (tiene sus
propias vacaciones, incapacidades y carpeta de vida). El sistema maneja
**una sola cuenta por persona**: no se crean dos accesos distintos.

### Cómo dejarlo bien

**1.** Deja que `crear_usuarios.js` cree la cuenta de TODOS los empleados,
   incluidos los que son líderes. Todos entran con su cédula.

**2.** Luego "promueve" a los que son líderes, cambiando su rol en el perfil.
   Reemplaza las cédulas por las reales:

```sql
-- Líder de Financiera (área 5)
update public.perfiles
set rol = 'lider_area', area_id = '5'
where cedula = '1032505160';

-- Líder de Operaciones (área 12)
update public.perfiles
set rol = 'lider_area', area_id = '12'
where cedula = '1019876543';
```

Consulta las cédulas y áreas así:

```sql
select e.cedula, e.name, e.area_id, p.rol
from empleados e join perfiles p on p.cedula = e.cedula
where e.status = 'activo' and e.cargo ilike '%lider%'
order by e.area_id;
```

**3.** Si en el Paso 4 creaste cuentas de líder con correo corporativo
   (`lider.financiera@specialcar.com.co`) y esa persona **también** es empleado,
   **elimina esa cuenta duplicada** en Authentication → Users. Se queda solo la
   de su cédula, ya promovida a `lider_area`.

### Resultado

Esa persona entra **una sola vez con su cédula** y ve las dos cosas:

- **🏠 Mi Portal** — sus documentos, permisos, vacaciones e incapacidades.
- **👥 Mi Equipo** — la gestión de su área.

Nadie puede aprobarse permisos a sí mismo: aunque sea líder del área, sus
propias solicitudes las decide RRHH.

### ¿Y gerencia, jurídica y RRHH?

Si esas cuentas corresponden a personas con ficha de empleado, aplica lo mismo:
crea la cuenta con su cédula y luego cambia el rol en `perfiles`. Si son cuentas
institucionales (no una persona concreta), déjalas con su correo corporativo tal
como quedaron en el Paso 4.
