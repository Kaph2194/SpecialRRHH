# Módulo HSEQ, Inducciones y Capacitaciones

Guía de puesta en marcha y de uso. Todo lo nuevo vive en `hseq.js`; los archivos
existentes solo recibieron enganches puntuales.

---

## 1. Puesta en marcha (10 minutos)

### Paso 1 · Crear las tablas en Supabase

Abre **Supabase → SQL Editor**, pega el contenido de
`supabase_hseq_capacitaciones.sql` y ejecútalo. Crea seis tablas:

| Tabla | Guarda |
|---|---|
| `capacitaciones` | Catálogo de inducciones y capacitaciones, con su material |
| `capacitacion_asignaciones` | Qué colaborador debe tomarla y su certificado |
| `hseq_documentos` | Políticas, formatos, procedimientos y documentos de comités |
| `hseq_certificaciones` | ISO 9001, 14001, 45001, RUC, BASC… |
| `comite_miembros` | Integrantes de COPASST y COCOLAB |
| `comite_actas` | Actas, reuniones e informes de los comités |

Las políticas RLS ya están escritas al final del archivo, **comentadas**, con el
mismo criterio de `supabase_setup.sql`: se activan el día que actives RLS en el
resto del sistema, no antes.

### Paso 2 · Subir los archivos

Sube al hosting: `hseq.js` (nuevo), `index.html` y `app.js` (modificados).
No hay que crear buckets nuevos: los archivos van al bucket `documentos` que ya
existe, en las carpetas `capacitaciones/`, `hseq/` y `comites/`.

### Paso 3 · Verificar el usuario de HSEQ

El módulo reconoce a HSEQ por el **área 14 (HSEQ & SIG)**. En
*Gestión de Usuarios*, el líder de HSEQ debe quedar con rol **Líder de Área** y
área **HSEQ & SIG**. Si ya existía, no hay que tocar nada.

---

## 2. Quién ve qué

| Rol | Módulo HSEQ | Capacitaciones | Certificados de todos | COPASST / COCOLAB | Certificaciones ISO |
|---|---|---|---|---|---|
| **Líder HSEQ** (área 14) | Completo | Crear, asignar, cargar material | Ver y validar | Crear y administrar | Crear y administrar |
| **RRHH** (superadmin, analista, líder) | Completo | Crear, asignar | Ver y validar | Crear y administrar | Crear y administrar |
| **Gerencia / Jurídica** | Solo lectura | Ver | Ver | Ver | Ver |
| **Integrante de COPASST** | No | — | — | Solo su comité, en lectura | — |
| **Integrante de COCOLAB** | No | — | — | Solo su comité, en lectura | — |
| **Colaborador** | No | Las suyas + cargar certificado | Solo el suyo | — | — |
| **Líder de área** | No | Las de su equipo, en la ficha | De su equipo | Solo si es integrante | — |

El acceso de los integrantes del comité es **automático**: en cuanto HSEQ
designa a alguien en *COPASST* o *COCOLAB*, ese comité aparece en su menú
lateral en modo lectura. Al retirarlo, el acceso desaparece.

---

## 3. Cómo se usa

### HSEQ — armar una capacitación

1. Menú lateral → **Módulo HSEQ** → pestaña *Inducciones y Capacitaciones*.
2. **+ Nueva Capacitación**: nombre, tipo (inducción, reinducción, capacitación,
   entrenamiento, SST), área destinataria, duración y **vigencia en meses**
   (0 = no vence).
3. En *Material*: sube presentaciones, documentos o videos, o pega el enlace de
   un video de YouTube, Drive o Vimeo. Se pueden mezclar ambos.
4. **👥 Asignar**: filtra por área, busca por nombre y marca colaboradores.
   Los que ya la tienen aparecen bloqueados para no duplicar.

### Colaborador — tomarla y certificarse

En su portal, pestaña **🎓 Mis Capacitaciones**: ve el material, lo abre, y al
terminar pulsa **📤 Cargar certificado**. El certificado queda *en revisión*
hasta que HSEQ lo valide. Si lo rechazan, ve el motivo y puede cargar otro.

En esa misma pestaña ve las **políticas y formatos** que HSEQ marcó como
visibles para colaboradores.

### HSEQ — validar y hacer seguimiento

Pestaña *Certificados de Colaboradores*: tabla con filtros por área,
capacitación y estado (por validar, completadas, pendientes, sin certificado,
vencidos), con botones ✅ validar y ✗ rechazar, y exportación a CSV.

El sistema calcula la vigencia sola: si la capacitación vence a los 12 meses,
marca 🟢 vigente, 🟡 por vencer (últimos 30 días) o 🔴 vencido.

### HSEQ — comités

Pestañas *COPASST* y *COCOLAB*, cada una con tres bloques:

- **Integrantes**: rol (presidente, secretario, principal, suplente),
  representación (empleador o trabajadores) y período de vigencia.
- **Documentos del comité**: reglamento, cronograma, matrices, lo que aplique.
- **Actas y reuniones**: número, fecha, tipo, desarrollo, compromisos,
  asistentes y el PDF del acta firmada.

### Gerencia

Panel de Gerencia → pestaña **🦺 HSEQ & Capacitación**: cumplimiento de
capacitación por área, certificaciones de la organización con alerta de
vencimiento a 60 días, composición de ambos comités con sus últimas actas, y
las políticas del sistema de gestión. Todo en lectura, sin un solo botón de
edición.

---

## 4. Cambios sobre los archivos existentes

**`index.html`**
- Carga de `hseq.js` después de `app.js`.
- Vistas nuevas: `view-hseq`, `view-comite-copasst`, `view-comite-cocolab`.
- Pestaña *🎓 Inducción y Capacitación* en la ficha del empleado (al final, para
  no alterar el orden de las anteriores).
- Pestaña *🎓 Mis Capacitaciones* en el portal del colaborador.
- Pestaña *🦺 HSEQ & Capacitación* en el panel de gerencia.
- Siete modales nuevos.

**`app.js`**
- `loadFromSupabase`: carga de las tablas nuevas, protegida con `try/catch`.
- `buildSidebar`: entradas de menú según el rol.
- `showView`: rutas, títulos y validación de acceso de las vistas nuevas.
- `VISTAS_LIDER_AREA`: se agregaron las vistas de comité; el líder HSEQ pasó de
  ver solo portal y bodega a ver también su módulo.
- `renderEmpTab`, `renderPortal`, `gerTab`: una rama nueva cada uno.

Todos los enganches verifican `typeof función === 'function'` antes de llamar,
así que si algún día se quita `hseq.js` el resto del sistema sigue funcionando.

---

## 5. Verificación

Se ejecutaron 64 pruebas automáticas sobre el módulo (permisos por rol, cálculo
de vigencias, renderizado de las seis pestañas, acceso de los integrantes de
comité, portal del colaborador, ficha del empleado, panel de gerencia, menú
lateral, guardado y validación, y escape de HTML). Las 64 pasan.

Antes de mostrarlo en producción conviene probar a mano el ciclo completo:
crear una capacitación con un video → asignarla a un colaborador → entrar como
ese colaborador y cargar el certificado → volver como HSEQ y validarlo →
comprobar que gerencia lo ve en su panel.
