# Despliegue del módulo de contraseñas en Supabase

Tres pasos. El segundo tiene dos caminos: por el panel (sin instalar nada) o
por consola. Si nunca has usado el CLI de Supabase, usa el panel.

---

## Paso 1 · Base de datos

Supabase → **SQL Editor** → New query. Pega el contenido de
**`supabase_password.sql`** y dale Run.

Crea:
- `perfiles.debe_cambiar_password` — la marca de contraseña temporal
- `perfiles.password_cambiado_at`
- la tabla `solicitudes_password`
- las funciones `fn_password_cambiado()` y `fn_puede_restablecer_password()`

Verifica que quedó:

```sql
select column_name from information_schema.columns
 where table_name = 'perfiles' and column_name like '%password%';
```

Deben salir dos filas.

---

## Paso 2 · La Edge Function

### Camino A · Por el panel (recomendado si no tienes el CLI)

1. Supabase → **Edge Functions** → **Deploy a new function** → *Via Editor*.
2. Nombre: **`password-admin`** (exacto, la app lo llama por ese nombre).
3. Borra el código de ejemplo y pega completo el contenido de
   **`functions/password-admin/index.ts`**.
4. **Importante:** busca la opción **Verify JWT** y déjala **desactivada**.
   Si queda activa, el colaborador que olvidó su contraseña no podrá pedir el
   restablecimiento, porque para eso no tiene sesión. La autorización se
   valida dentro de la función: `restablecer` y `estado` sí verifican el token
   y el rol antes de hacer nada.
5. Deploy.

### Camino B · Por consola

```bash
npm install -g supabase
supabase login
supabase link --project-ref qivcmhjlmbgeeajfuxyv
supabase functions deploy password-admin
```

El `verify_jwt = false` ya está en `config.toml`, así que no hace falta pasar
la bandera a mano. Ejecuta el comando desde la carpeta que contiene `supabase/`.

### Variables de entorno

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta
Supabase sola: **no las configures ni las escribas en ningún archivo**.

Estas dos son opcionales — Edge Functions → password-admin → Secrets:

| Variable | Para qué | Valor |
|---|---|---|
| `SITIO_URL` | A dónde devuelve el enlace del correo | `https://intranet.specialcar.com.co` |
| `ORIGENES_PERMITIDOS` | Sitios autorizados a llamar la función | `https://intranet.specialcar.com.co` |

Si no las pones, los valores por defecto ya apuntan a la intranet.

---

## Paso 3 · Probar que responde

```bash
curl -i -X POST \
  https://qivcmhjlmbgeeajfuxyv.supabase.co/functions/v1/password-admin \
  -H "Content-Type: application/json" \
  -H "apikey: <tu anon key>" \
  -d '{"accion":"solicitar","usuario":"00000000"}'
```

Debe responder **200** con un mensaje genérico. Esa cédula no existe y aun así
responde lo mismo: es a propósito, para que nadie pueda averiguar desde afuera
qué cédulas están registradas.

Si responde **401**, el *Verify JWT* quedó activado — vuelve al paso 2.
Si responde **404**, la función no quedó desplegada o el nombre no coincide.

Después, desde la app: entra como RRHH, abre la ficha de un colaborador y usa
**🔑 Restablecer contraseña**. El modal debe mostrarte el estado de la cuenta.

---

## Opcional · Correo de recuperación

Solo si quieres que el enlace por correo funcione de verdad. La mayoría de tus
colaboradores usa el correo interno `<cédula>@empleados.specialcar.com.co`, que
no es un buzón real; para ellos la solicitud va directo a Recursos Humanos y
eso es lo esperado.

Para quienes sí tienen correo propio:

1. Authentication → **Emails** → SMTP Settings → configura tu servidor.
   Sin SMTP propio, Supabase envía con su remitente de pruebas, limitado a unos
   pocos correos por hora: sirve para probar, no para producción.
2. Authentication → **URL Configuration** → Redirect URLs → agrega
   `https://intranet.specialcar.com.co`. Sin esto el enlace del correo no
   devuelve a la app.

---

## Aparte · Revisar las cuentas existentes

**`supabase_revisar_cuentas.sql`** es independiente del módulo. Detecta y
repara las cuentas que están mal: empleados activos sin cuenta, cuentas sin
perfil, perfiles sin enlace a la ficha, cuentas sin confirmar, accesos de
personal ya retirado.

Córrelo por partes: primero el diagnóstico, revisas los resultados, y después
la corrección. Está comentado paso a paso dentro del archivo.

---

## Si algo sale mal

**"El módulo de contraseñas no está desplegado"** en la app → la función no
existe o se llama distinto. Debe ser exactamente `password-admin`.

**401 al restablecer desde la app** → la sesión del administrador expiró.
Cierra sesión y vuelve a entrar.

**403 "Tu rol no permite restablecer contraseñas"** → la cuenta con la que
entraste no es superadmin, analista de RRHH ni líder de RRHH. Revisa su fila
en `perfiles`.

**Error de CORS en la consola del navegador** → el dominio desde el que abres
la app no está en `ORIGENES_PERMITIDOS`. Agrégalo como secret.

Los registros de cada llamada están en Edge Functions → password-admin → Logs.
