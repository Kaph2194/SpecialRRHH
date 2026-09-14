# Buzón de Sugerencias, Peticiones y Consultas

Canal interno tipo correo: el colaborador escribe desde su portal, el
destinatario responde y el hilo queda registrado. Vive en `buzon.js`.

---

## Puesta en marcha

1. Ejecuta `supabase_buzon.sql` en Supabase → SQL Editor. Crea una sola tabla,
   `buzon_mensajes`, con el hilo de respuestas en un campo `jsonb`.
2. Sube `buzon.js` (nuevo), `index.html`, `app.js` y `pendientes.js`.

Las políticas RLS van escritas al final del SQL pero comentadas, igual que en
el resto del sistema.

---

## Cómo escribe el colaborador

En su portal aparece la pestaña **✉️ Buzón**, con un formulario de correo:

- **Para**: Recursos Humanos, su propio líder de área, cualquier otra área,
  Gerencia, el Comité de Convivencia o el COPASST.
- **Tipo**: sugerencia, idea de mejora, petición, consulta, queja, reclamo o
  felicitación.
- **Asunto** y **mensaje**, con una casilla para marcarlo urgente.

Debajo ve el historial de lo que ha enviado, con el estado de cada mensaje y
las respuestas que le hayan dado.

### Anónimo

Hay casilla para enviar sin nombre. Cuando se marca, el sistema avisa del
efecto real antes de enviar: no se guarda ni el nombre ni el identificador, así
que el mensaje **no aparece en el historial del remitente y no hay forma de
responderle**. Es el mismo criterio del canal de denuncias que ya existía.

El formulario también recuerda que para acoso laboral o faltas graves el canal
correcto es **🔒 Denuncias**, que tiene otro tratamiento.

---

## Cómo lo gestiona el destinatario

Quien recibe mensajes ve en el menú lateral **✉️ Buzón**, con el número de
pendientes entre paréntesis. Cada mensaje se despliega al pulsarlo y ahí puede:

- **Responder** al colaborador, que lo verá en su portal.
- Dejar una **nota interna**, visible solo para quien gestiona el buzón.
- Marcarlo **en gestión**, **cerrarlo** o **reabrirlo**.

Los estados son: nuevo → leído (automático al abrirlo) → en gestión →
respondido → cerrado. La bandeja ordena primero los urgentes y después lo más
antiguo sin atender, y filtra por estado, tipo y texto libre.

---

## Quién recibe qué

| Destinatario elegido | Lo ve |
|---|---|
| Recursos Humanos | Analista y líder de RRHH, superadmin |
| Un área concreta | El líder de esa área |
| Gerencia | Gerencia, CEO y jurídica |
| COPASST / Comité de Convivencia | Los integrantes activos de ese comité |

Cada quien ve solo lo dirigido a él. Un líder de Taller no ve lo que va a
Financiera, y nadie puede responder ni cambiar el estado de un mensaje que no
le corresponde: el módulo lo valida en cada acción, no solo al pintar.

### El superadministrador va siempre en copia oculta

El superadmin recibe **todos** los mensajes del buzón, vayan dirigidos a quien
vayan: RRHH, cualquier área, Gerencia o los comités. Su bandeja lo indica con un
aviso y marca cada mensaje ajeno con el distintivo *👁 Copia oculta*, y cuenta
con un filtro extra por destinatario para moverse entre bandejas o quedarse solo
con lo dirigido a él.

Dos detalles de ese acceso:

- **Abrir un mensaje ajeno no lo marca como leído.** El acuse de lectura es del
  destinatario real; un observador no se lo consume. Si el superadmin lo abre,
  para RRHH o para el líder el mensaje sigue apareciendo como nuevo.
- **Si responde, la respuesta queda a su nombre**, y el sistema se lo advierte
  antes. El colaborador ve quién le respondió, así que no hay respuestas sin
  autor identificable.

---

## Integración con el dashboard

El centro de pendientes suma la categoría **✉️ Mensajes del buzón por atender**,
con los que están en nuevo, leído o en gestión, ordenados por antigüedad y con
la misma etiqueta de días de espera que el resto. Los anónimos aparecen como
"Remitente anónimo".

---

## Verificación

55 pruebas automáticas cubren envío, validaciones, enrutamiento por
destinatario, lectura y respuesta, separación entre respuesta pública y nota
interna, estados, anonimato, filtros, menú, integración con pendientes y escape
de HTML. Las 55 pasan, y las 62 del centro de pendientes siguen pasando.
