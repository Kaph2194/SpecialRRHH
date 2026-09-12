# Centro de Pendientes del Dashboard

El dashboard ahora reúne en un solo lugar todo lo que espera gestión o visto
bueno, en vez de mostrar únicamente los permisos. Vive en `pendientes.js`.

---

## Puesta en marcha

Sube `pendientes.js` (nuevo), `index.html` y `app.js` (modificados).
No hay cambios en la base de datos: el módulo lee lo que ya está en `SC`.

---

## Qué muestra

La pantalla tiene tres partes:

1. **Tarjetas de resumen.** La primera es *Pendientes de gestión*, con el total
   y un color que cambia según la carga (verde si no hay nada, ámbar hasta 20,
   rojo por encima). Al pulsarla baja al centro de pendientes.
2. **Chips por categoría.** Una fila de botones con el icono, el nombre y el
   conteo de cada categoría. Al pulsar uno se filtra el detalle a esa sola
   categoría y se despliegan todos sus registros.
3. **Fichas de detalle.** Una por categoría, con los cinco casos más antiguos,
   botones de acción rápida y un enlace *Abrir módulo →*.

Cada registro muestra el nombre del colaborador, el detalle, y una etiqueta de
antigüedad: gris el mismo día, ⏳ ámbar a partir de tres días y 🔥 rojo a partir
de siete. Dentro de cada categoría lo más antiguo aparece primero.

---

## Las 21 categorías

| Categoría | Qué recoge | Quién la ve |
|---|---|---|
| Permisos por aprobar | Permisos en estado pendiente | RRHH y líderes |
| Vacaciones · visto bueno del jefe | Solicitudes sin VB del jefe directo | Líderes y RRHH |
| Vacaciones · aprobación final | Ya con VB del jefe | RRHH |
| Incapacidades por revisar | Pendientes, avisando si falta epicrisis o FURAT | RRHH y líderes |
| Préstamos y descuentos | Solicitados o pendientes de RRHH | RRHH |
| Préstamos · visto bueno Financiera | Aprobados por RRHH | Líder de Financiera |
| Préstamos · validar cuotas | Con comprobante cargado | RRHH |
| Certificados laborales | Solicitudes por emitir | RRHH |
| Certificaciones de retirados | Pedidas desde el portal de retiro | RRHH |
| Cambios de datos | EPS, pensión, cesantías, caja, banco | RRHH |
| Documentos por revisar | Cargados por el colaborador | RRHH y líderes |
| Carpetas de vida incompletas | Documentos obligatorios faltantes | RRHH y líderes |
| Procesos disciplinarios | En curso | RRHH y líderes |
| Disciplinarios · visto bueno | Esperan al líder del área del empleado | Líderes |
| Denuncias y reportes | Canal confidencial sin atender | RRHH |
| Novedades de nómina | Sin procesar | RRHH |
| Candidatos en evaluación | Proceso de selección abierto | RRHH |
| Horarios del mes | Activos sin horario del mes en curso | RRHH y líderes |
| Retroalimentaciones por firmar | Memorandos pendientes de firma | RRHH y líderes |
| Certificados de capacitación | Cargados por el colaborador, sin validar | HSEQ |
| Capacitaciones vencidas o por vencer | Según la vigencia de cada curso | HSEQ |
| Certificaciones por renovar | ISO y otras a menos de 90 días | HSEQ |
| Períodos de prueba por vencer | Terminan en 15 días o menos | RRHH y líderes |

Las categorías vacías no se muestran. Si no hay nada pendiente aparece un estado
"Todo al día".

---

## Quién ve qué

El centro respeta el rol y el área del usuario:

- **RRHH y superadmin**: todas las categorías, de todos los colaboradores.
- **Líder de área**: solo su equipo, y solo lo que le compete (permisos cortos,
  visto bueno de vacaciones, documentos, horarios, disciplinarios de su área).
  No ve certificados laborales, cambios de datos ni novedades de nómina.
- **Líder de Financiera**: además, los préstamos que esperan su visto bueno.
- **HSEQ**: la capacitación de *toda* la empresa, no solo de su área, porque el
  seguimiento del SG-SST es transversal.
- **Gerencia y jurídica**: ven todas las categorías con un aviso de seguimiento,
  pero sin un solo botón de acción.

---

## Acciones rápidas

Donde la decisión no necesita revisar un archivo, se resuelve desde el propio
dashboard con ✅ y ✕: permisos, visto bueno y aprobación de vacaciones,
préstamos, cambios de datos, documentos de carpeta y validación de certificados
de capacitación.

Donde sí hace falta revisar soportes o adjuntar un archivo —incapacidades,
certificados laborales, denuncias, disciplinarios— el botón lleva al módulo
correspondiente en vez de decidir a ciegas.

Las acciones reutilizan las funciones que ya existían en el sistema, así que la
trazabilidad, la auditoría y el guardado en Supabase funcionan igual que si se
hicieran desde el módulo.

---

## Verificación

62 pruebas automáticas cubren agrupación, cálculo de antigüedad, lectura de
fechas en ambos formatos del sistema, visibilidad por rol y por área, filtros,
acciones rápidas y escape de HTML. Las 62 pasan.

Dos fallos reales salieron de esas pruebas y quedaron corregidos: gerencia no
veía ninguna categoría porque todas las puertas de rol la excluían, y HSEQ solo
veía la capacitación de su propia área en vez de la de toda la empresa.
