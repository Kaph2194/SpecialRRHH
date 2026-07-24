# Lista de verificación — antes de la capacitación

## ⚠️ Decisión importante: NO actives RLS hoy

RLS (paso 7) es el candado final del servidor. Si algo queda mal configurado,
**los usuarios dejan de ver datos en mitad de la capacitación** y el diagnóstico
toma tiempo. La app ya funciona con autenticación real y con todas las reglas
aplicadas en la interfaz. Deja el paso 7 para un día tranquilo, sin público.

---

## 1. SQL pendiente (ejecutar ahora, 2 minutos)

```sql
-- Políticas de Storage para usuarios autenticados
drop policy if exists "app_insert_docs" on storage.objects;
drop policy if exists "app_update_docs" on storage.objects;
drop policy if exists "app_read_docs"   on storage.objects;
drop policy if exists "anon_upload_documentos" on storage.objects;
drop policy if exists "anon_update_documentos" on storage.objects;
drop policy if exists "anon_read_documentos"   on storage.objects;

create policy "docs_insert" on storage.objects
  for insert to public with check (bucket_id in ('documentos','bodega'));
create policy "docs_update" on storage.objects
  for update to public using (bucket_id in ('documentos','bodega'));
create policy "docs_select" on storage.objects
  for select to public using (bucket_id in ('documentos','bodega'));
create policy "docs_delete" on storage.objects
  for delete to public using (bucket_id in ('documentos','bodega'));

-- Confirmar que TODAS las tablas tengan RLS apagado por ahora
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by rowsecurity desc, tablename;
```

En la última consulta, `rowsecurity` debe ser **false** en todas.

## 2. Cambiar las contraseñas de las cuentas administrativas

Las que creaste son provisionales. En **Authentication → Users**, entra a cada
cuenta → *Reset password* o edita la contraseña. Hazlo al menos para
`admin@specialcar.com.co` antes de mostrar el sistema en público.

## 3. Prueba con cada rol (15 minutos, lo más importante)

Entra y sal con cada uno. Marca lo que verifiques:

| Rol | Debe ver | NO debe ver |
|---|---|---|
| **Empleado** | Solo "Mi Portal" con sus pestañas | Ningún módulo de gestión |
| **Líder de área** | Mi Portal + Mi Equipo, permisos/incapacidades/vacaciones de SU área | Dashboard, candidatos, bodega, nómina, otras áreas |
| **Líder HSEQ** | Mi Portal + Bodega (solo cargar) | Gestión de personal, botón eliminar en bodega |
| **Líder Financiera** | Lo de líder + Formatos de Nómina | Fichas de otras áreas |
| **Analista RRHH** | Todo el sistema, con botones de aprobar | — |
| **Gerencia / Jurídica** | Todo en lectura | Cualquier botón de crear/editar/aprobar |

Puntos concretos a revisar en cada uno:

- El nombre y rol correctos en la esquina inferior izquierda.
- Un líder **no** puede abrir "Editar" en la ficha de un empleado.
- Un líder solo aprueba permisos por horas menores a 2 h.
- El empleado **no** ve "Tratamiento en Nómina" al pedir un permiso.
- El empleado ve su salario, sus primas y sus desprendibles.

## 4. Datos que conviene revisar

- **Empleados de HSEQ**: siguen en el área "Recursos Humanos" (6). Muévelos al
  área "HSEQ & SIG" (14) o la reportería los mostrará mal.
- **Perfiles administrativos sin cédula**: solo pueden entrar con su correo.
  Si son personas con ficha de empleado, complétales `cedula` y `emp_id`.
- **Documentos huérfanos**: los que se subieron cuando fallaba el Storage
  quedaron sin archivo. Se identifican con el aviso rojo "El archivo no se
  guardó". Bórralos o pide que los suban de nuevo.

## 5. Qué decir en la capacitación sobre las contraseñas

Cada empleado entra con **su cédula** (o su correo registrado) y su contraseña
inicial, que es **su número de documento**. Pídeles que la cambien en
*Mi Perfil → Cambiar Contraseña*. Mínimo 8 caracteres.

---

## Después de la capacitación: paso 7 (RLS)

Cuando tengas tiempo sin usuarios conectados:

1. Ejecuta la Parte 2 de `supabase_setup.sql` (las políticas).
2. Agrega estas políticas de `perfiles`, que faltan y son necesarias para que
   la gestión de usuarios siga funcionando:

```sql
alter table public.perfiles enable row level security;

drop policy if exists "perfil_propio" on public.perfiles;
create policy "perfil_propio" on public.perfiles
  for select using (auth.uid() = user_id);

create policy "perfiles_rrhh_lee" on public.perfiles
  for select using (public.fn_rol() in ('superadmin','analista_rrhh','gerencia','juridico'));

create policy "perfiles_rrhh_edita" on public.perfiles
  for update using (public.fn_rol() in ('superadmin','analista_rrhh'));
```

3. Activa RLS **una tabla a la vez**, probando la app después de cada una.
   Si algo se rompe: `alter table X disable row level security;` y sigue.
4. Empieza por las menos críticas (`auditoria`, `bodega`) y deja `empleados`
   para el final.
