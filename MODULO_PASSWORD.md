# Módulo de restablecer contraseña

Dos caminos: el colaborador que olvidó su clave y el administrador que se la
restablece. La clave `service_role` nunca toca el navegador.

---

## Puesta en marcha

### Paso 1 · Base de datos

Ejecuta `supabase_password.sql` en Supabase → SQL Editor. Agrega la marca de
contraseña temporal a `perfiles`, crea la tabla `solicitudes_password` y dos
funciones de apoyo.

### Paso 2 · Desplegar la Edge Function

Aquí vive la clave de servicio, del lado del servidor. Desde la carpeta del
proyecto, con el [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref qivcmhjlmbgeeajfuxyv
supabase functions deploy password-admin --no-verify-jwt
```

El `--no-verify-jwt` es necesario porque la acción *solicitar* se llama sin
sesión: alguien que olvidó su contraseña no puede estar autenticado. La
autorización se valida dentro de la función, acción por acción.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta
Supabase sola. Las otras dos son opcionales:

```bash
supabase secrets set SITIO_URL=https://intranet.specialcar.com.co
supabase secrets set ORIGENES_PERMITIDOS=https://intranet.specialcar.com.co
```

`ORIGENES_PERMITIDOS` es la lista de sitios autorizados a llamar la función.
Si la dejas por defecto ya incluye el dominio de la intranet.

### Paso 3 · Correo de recuperación (opcional)

Para que el enlace por correo funcione de verdad hace falta SMTP propio en
Authentication → Emails → SMTP Settings. Sin configurarlo, Supabase envía con
su remitente de pruebas, limitado a unos pocos correos por hora — sirve para
probar, no para producción.

También agrega `https://intranet.specialcar.com.co` en Authentication → URL
Configuration → Redirect URLs, o el enlace del correo no devolverá a la app.

**Importante:** la mayoría de tus colaboradores usa el correo interno
`<cédula>@empleados.specialcar.com.co`, que no es un buzón real. Para ellos el
camino por correo no existe y la solicitud va derecho a Recursos Humanos. Eso
es lo normal, no una falla.

### Paso 4 · Subir los archivos

`password.js` (nuevo), `index.html`, `app.js` y `pendientes.js`.

---

## El colaborador olvidó su contraseña

En la pantalla de ingreso, debajo del botón, aparece **¿Olvidaste tu
contraseña?** — está tanto en el acceso de empleados como en el administrativo.
Escribe su documento o su correo y el sistema decide solo:

- **Tiene correo real y cuenta creada** → le llega un enlace. Al abrirlo vuelve
  a la intranet con una pantalla para definir su contraseña nueva, y después
  entra normal.
- **No tiene correo real, o no tiene cuenta** → la solicitud aparece en el
  centro de pendientes de Recursos Humanos.

En ambos casos la respuesta en pantalla es la misma. Es a propósito: si dijera
"esa cédula no existe", cualquiera podría averiguar desde afuera qué cédulas
están registradas en la empresa.

---

## El administrador restablece

Disponible para superadmin, analista de RRHH y líder de RRHH. Un líder de área
no puede: el botón no le aparece y la función lo rechaza si lo intenta.

Hay dos puntos de entrada: el botón **🔑 Restablecer contraseña** en la cabecera
de la ficha del colaborador, y el botón directo desde la categoría
*Restablecer contraseña* del centro de pendientes.

El modal consulta primero el estado de la cuenta y avisa de lo que encuentre:
si nunca ha ingresado, si no está confirmada, si el perfil no está enlazado a
la ficha, o si la cuenta ni siquiera existe. Luego puedes dejar que genere una
contraseña temporal — del estilo `ABCD-2345-EFGH`, sin caracteres que se
confundan como O y 0 — o escribir una tú.

Al confirmar, la función hace todo de una vez: cambia la contraseña, confirma
la cuenta si estaba pendiente, repara el perfil, cierra la solicitud que lo
originó y deja rastro en auditoría. **Si la cuenta no existía, la crea**, que
es justo el caso de los colaboradores que quedaron fuera de la migración.

La contraseña se muestra una sola vez, con botón de copiar. Entrégala por un
canal seguro.

---

## Contraseña temporal

Toda clave puesta por un administrador queda marcada como temporal. En el
siguiente ingreso el colaborador se encuentra una ventana sin botón de cerrar
que le exige definir una propia: mínimo 8 caracteres, no solo números. Hasta
que no la cambie no puede usar la plataforma.

Esto resuelve el problema de fondo de la contraseña inicial igual a la cédula,
que hoy cualquiera que conozca el documento de un compañero puede adivinar.

---

## Por qué una Edge Function y no código en la app

Cambiar la contraseña de otro usuario exige la clave `service_role` de
Supabase. Quien la tenga controla toda la base de datos: puede leer, modificar
y borrar cualquier tabla, saltándose las políticas de seguridad.

`app.js` lo descarga el navegador de cualquiera que abra la intranet, y el
repositorio es público. Una clave ahí es una clave filtrada. Por eso vive en el
servidor, en la Edge Function, y el navegador solo la invoca mandando el JWT de
quien está conectado. La función verifica ese token contra Supabase, consulta
el rol en `perfiles` y solo entonces actúa.

---

## Verificación

61 pruebas automáticas en `tests/test_password.js` cubren permisos por rol,
solicitud sin sesión, restablecimiento con sesión, manejo de errores de la
función, el cambio obligatorio y sus validaciones, el enlace de recuperación
(incluido el vencido), las solicitudes pendientes, y una comprobación explícita
de que ningún archivo que llega al navegador usa la clave de servicio.

```bash
npm install jsdom
node tests/test_password.js
```
