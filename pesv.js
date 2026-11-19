// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH · MÓDULO PESV
// Plan Estratégico de Seguridad Vial · Resolución 40595 de 2022
// (MinTransporte). 24 pasos en ciclo PHVA, niveles básico (18 pasos),
// estándar (22) y avanzado (24).
//
// Evaluación por criterio con los estados de la lista de verificación
// de la resolución: CUMPLE · NO CUMPLE · NO APLICA · NO VERIFICADO.
// La resolución no fija un puntaje: el % de cumplimiento es interno
// (criterios que cumplen / criterios aplicables sin "no aplica").
//
// Datos: tabla pesv_evaluaciones + evidencias en bucket privado 'sig'
// (carpeta pesv/). Ver supabase_sig_pesv.sql.
// Editan: Super Admin, RRHH y líder HSEQ. Consultan: Gerencia y Jurídica.
// ═══════════════════════════════════════════════════════════════

// Nivel de aplicación por paso: T = todos, EA = estándar y avanzado, A = solo avanzado
const PESV_FASES = [
  { key: 'P', nombre: 'Planear',   desc: 'Planificación',              color: '#2563eb', pasos: [1, 8] },
  { key: 'H', nombre: 'Hacer',     desc: 'Implementación y ejecución', color: '#0d9488', pasos: [9, 19] },
  { key: 'V', nombre: 'Verificar', desc: 'Seguimiento',                color: '#f59e0b', pasos: [20, 22] },
  { key: 'A', nombre: 'Actuar',    desc: 'Mejora continua',            color: '#7c3aed', pasos: [23, 24] },
];

const PESV_PASOS = [
  { n: 1, nivel: 'T', titulo: 'Líder del diseño e implementación del PESV', crit: [
    'Se designó formalmente un líder del PESV con capacidad de decisión (acta o documento de designación).',
    'El líder vela por la planificación, implementación, seguimiento y mejora del PESV.',
    'El líder diligencia el reporte de autogestión y los indicadores ante la autoridad.',
    'El líder cuenta con la competencia definida para el rol (paso 10).' ] },
  { n: 2, nivel: 'EA', titulo: 'Comité de seguridad vial', crit: [
    'Comité conformado por mínimo 3 integrantes con poder de decisión, incluido el líder del PESV.',
    'Acto de conformación con objetivo, visión y alcance del comité.',
    'El comité diseña, implementa y mejora el PESV y promueve la participación de los colaboradores.',
    'Define áreas de acompañamiento y analiza la siniestralidad y las investigaciones de siniestros.',
    'Se reúne y revisa el PESV al menos una vez por trimestre (actas).' ] },
  { n: 3, nivel: 'T', titulo: 'Política de seguridad vial', crit: [
    'Política documentada con alcance a desplazamientos laborales e in itinere.',
    'Incluye compromisos del nivel directivo y es adecuada al tamaño y riesgos viales de la organización.',
    'Da el marco para los objetivos e incluye cumplimiento legal y mejora continua.',
    'Firmada por el representante legal.',
    'Revisada al menos cada 3 años y comunicada a todos los colaboradores.' ] },
  { n: 4, nivel: 'T', titulo: 'Liderazgo, compromiso y corresponsabilidad del nivel directivo', crit: [
    'El nivel directivo define y aprueba la política y los objetivos del PESV.',
    'Asigna recursos financieros, técnicos y humanos para el PESV.',
    'Promueve la formación en hábitos y comportamientos seguros.',
    'Considera especificaciones de seguridad en la compra o contratación de vehículos.',
    'Hace seguimiento a contratistas y al cumplimiento del plan anual de trabajo.',
    'Atiende las visitas de verificación y participa al menos una vez al año en el comité.' ] },
  { n: 5, nivel: 'T', titulo: 'Diagnóstico', crit: [
    'Diagnóstico documentado de sedes, servicios y contratistas.',
    'Caracterización de colaboradores: perfil, licencias, infracciones y siniestros.',
    'Inventario de vehículos (propios, contratados y de colaboradores) con documentación y mantenimiento.',
    'Rutas y desplazamientos frecuentes identificados.',
    'Capacitación y simulacros de emergencia vial registrados.',
    'Diagnóstico actualizado al menos una vez al año.' ] },
  { n: 6, nivel: 'T', titulo: 'Caracterización, evaluación y control de riesgos', crit: [
    'Procedimiento documentado de identificación, análisis y valoración de riesgos viales.',
    'Riesgos identificados por rol, desplazamiento y actividad.',
    'Análisis de exposición y probabilidad; valoración con mapa de calor.',
    'Tratamiento definido: evitar, eliminar la fuente o modificar exposición y probabilidad.',
    'Actualización anual y después de siniestros graves o cambios en la operación.' ] },
  { n: 7, nivel: 'T', titulo: 'Objetivos y metas del PESV', crit: [
    'Objetivos enfocados en prevención, medibles y cuantificables.',
    'Coherentes con la política, el plan anual, los riesgos y los factores de desempeño.',
    'Metas definidas con indicadores asociados.',
    'Revisados al menos una vez al año.' ] },
  { n: 8, nivel: 'T', titulo: 'Programas de gestión de riesgos críticos y factores de desempeño', crit: [
    'Programa de gestión de la velocidad segura.',
    'Programa de prevención de la fatiga.',
    'Programa de prevención de distracciones.',
    'Programa de cero tolerancia al alcohol y sustancias psicoactivas.',
    'Programa de protección de actores viales vulnerables.',
    'Programas adicionales según los riesgos identificados.',
    'Cada programa documenta alcance, línea base, objetivos, metas, indicadores, responsables, presupuesto y cronograma.' ] },
  { n: 9, nivel: 'T', titulo: 'Plan anual de trabajo', crit: [
    'Plan anual documentado, construido a partir de los pasos 3 a 8.',
    'Actividades con responsables, recursos y cronograma.',
    'Alineado con el Plan Nacional de Seguridad Vial y articulado con el SG-SST.',
    'Seguimiento periódico a la ejecución del plan.' ] },
  { n: 10, nivel: 'T', titulo: 'Competencia y plan anual de formación', crit: [
    'Competencias definidas (educación, formación, experiencia) para los roles clave: líder, comité, capacitadores, planificadores de rutas, mantenimiento, auditores, brigadistas, investigadores y conductores.',
    'Plan anual de formación en seguridad vial para todos los colaboradores.',
    'Registros de asistencia y evaluación de la formación.',
    'Inducción y reinducción con contenidos de seguridad vial.' ] },
  { n: 11, nivel: 'A', titulo: 'Responsabilidad y comportamiento seguro', crit: [
    'Procesos de selección y contratación con criterios de seguridad vial.',
    'Funciones documentadas: reporte de siniestros, capacitación, cumplimiento de normas y reporte de condiciones de salud.',
    'Evaluación anual del comportamiento (siniestros, infracciones, quejas y capacitaciones).',
    'Estrategia para gestionar comportamientos que afectan la seguridad vial.' ] },
  { n: 12, nivel: 'T', titulo: 'Plan de preparación y respuesta ante emergencias viales', crit: [
    'Plan de preparación y respuesta ante emergencias viales documentado.',
    'Protocolo de reporte de siniestros y cadena de llamadas.',
    'Ubicación de centros médicos y protocolo de primer respondiente.',
    'Equipos de emergencia disponibles.',
    'Simulacro realizado al menos una vez al año.' ] },
  { n: 13, nivel: 'EA', titulo: 'Investigación interna de siniestros viales', crit: [
    'Procedimiento para reportar, registrar, investigar, analizar y divulgar siniestros viales.',
    'Análisis de factor humano, vehículo e infraestructura, con causas raíz.',
    'Planes de acción derivados y evaluación de su eficacia.',
    'Lecciones aprendidas divulgadas.' ] },
  { n: 14, nivel: 'T', titulo: 'Vías seguras administradas por la organización', crit: [
    'Protocolo de operación y mantenimiento de las vías internas.',
    'Zonas de conflicto identificadas y señalizadas.',
    'Inspección anual y mantenimiento preventivo de vías y señalización.' ] },
  { n: 15, nivel: 'T', titulo: 'Planificación de desplazamientos laborales', crit: [
    'Procedimiento de planificación de desplazamientos laborales.',
    'Tiempos de antelación, horarios de conducción y pausas definidos.',
    'Velocidades seguras, paradas seguras y controles en ruta.',
    'Uso de tecnología (GPS u OBC) cuando aplique y capacitación sobre rutas.' ] },
  { n: 16, nivel: 'T', titulo: 'Inspección de vehículos y equipos', crit: [
    'Procedimiento y formato de inspección preoperacional diaria.',
    'Responsables definidos y registros del último año.',
    'Revisión de documentos, luces, llantas, fluidos, cinturones, espejos y equipo de carretera (casco en motos).',
    'Tratamiento de hallazgos: un vehículo no apto no sale a operar.' ] },
  { n: 17, nivel: 'T', titulo: 'Mantenimiento y control de vehículos seguros y equipos', crit: [
    'Plan de mantenimiento preventivo por vehículo.',
    'Hoja de vida de cada vehículo con sus intervenciones.',
    'Control del mantenimiento de vehículos de colaboradores al servicio de la organización.',
    'Mantenimiento correctivo registrado y verificado.' ] },
  { n: 18, nivel: 'EA', titulo: 'Gestión del cambio y gestión de contratistas', crit: [
    'Procedimiento de gestión del cambio que evalúa el impacto en seguridad vial.',
    'Requisitos de seguridad vial para contratistas: vehículos, conductores y documentación.',
    'Capacitación, inspección preoperacional y reporte de siniestros exigidos a contratistas.',
    'Evaluación del cumplimiento de contratistas y responsables de supervisión designados.' ] },
  { n: 19, nivel: 'EA', titulo: 'Archivo y retención documental', crit: [
    'Procedimiento de control documental del PESV.',
    'Registros conservados al menos 5 años (inspecciones preoperacionales: 1 año).',
    'Registros identificables, legibles, accesibles y protegidos contra daño o pérdida.',
    'Tratamiento de datos personales conforme a la Ley 1581 de 2012.' ] },
  { n: 20, nivel: 'T', titulo: 'Indicadores y reporte de autogestión', crit: [
    'Protocolo de gestión de indicadores: medición, análisis y evaluación.',
    'Indicadores obligatorios calculados con línea base y metas.',
    'Cortes trimestrales (31 mar, 30 jun, 30 sep, 31 dic) analizados por el comité.',
    'Reporte anual de autogestión presentado antes del 31 de enero.' ] },
  { n: 21, nivel: 'A', titulo: 'Registro y análisis estadístico de siniestros viales', crit: [
    'Siniestros clasificados por nivel de pérdida (pirámide de Hydén) y matriz de nivel de pérdida.',
    'Histórico (preferiblemente 5 años), tendencia y límite máximo tolerable.',
    'Estadísticas laborales y no laborales separadas, con proyección estadística.',
    'Análisis de correlaciones y causas por el comité; los resultados alimentan los pasos 9 y 10.' ] },
  { n: 22, nivel: 'T', titulo: 'Auditoría anual', crit: [
    'Procedimiento de auditoría documentado.',
    'Auditoría interna al menos una vez al año, planificada con el comité.',
    'Auditores competentes e independientes del líder del PESV.',
    'Informe con hallazgos y seguimiento a no conformidades.' ] },
  { n: 23, nivel: 'T', titulo: 'Mejora continua, acciones preventivas y correctivas', crit: [
    'Acciones preventivas y correctivas definidas a partir de indicadores, auditorías y visitas.',
    'Seguimiento al cierre y a la eficacia de las acciones.',
    'Evidencia de mejora en la evolución de los pasos del PESV.' ] },
  { n: 24, nivel: 'T', titulo: 'Mecanismos de comunicación y participación', crit: [
    'Mecanismos para comunicar políticas y actividades a todos los niveles.',
    'Canales para recibir sugerencias y propuestas de mejora de los colaboradores.',
    'Atención a comunicaciones internas y externas del PESV.',
    'Promoción de hábitos seguros y divulgación de lecciones aprendidas.',
    'Comunicaciones al menos trimestrales: promoción, indicadores, resultados, riesgos y controles.' ] },
];

// Indicadores obligatorios del paso 20 (num ÷ den × factor)
const PESV_INDICADORES = [
  { id: 'tsv',   nivel: 'T',  nombre: 'Tasa de siniestros viales',                num: 'Siniestros viales',                den: 'Km recorridos',                  factor: 5000000, unidad: 'x 5M km', sentido: 'menor' },
  { id: 'csv',   nivel: 'EA', nombre: 'Costos de siniestros viales',              num: 'Costos directos + indirectos ($)', den: null,                             factor: 1,       unidad: '$',       sentido: 'menor' },
  { id: 'grv',   nivel: 'T',  nombre: 'Gestión de riesgos viales',                num: 'Riesgos con controles',            den: 'Riesgos identificados',          factor: 100,     unidad: '%',       sentido: 'mayor' },
  { id: 'cm',    nivel: 'T',  nombre: 'Cumplimiento de metas del PESV',           num: 'Metas alcanzadas',                 den: 'Metas definidas',                factor: 100,     unidad: '%',       sentido: 'mayor' },
  { id: 'cp',    nivel: 'T',  nombre: 'Cumplimiento del plan anual',              num: 'Actividades ejecutadas',           den: 'Actividades programadas',        factor: 100,     unidad: '%',       sentido: 'mayor' },
  { id: 'ejlc',  nivel: 'T',  nombre: 'Exceso de jornada laboral de conductores', num: 'Jornadas con exceso',              den: 'Jornadas totales',               factor: 100,     unidad: '%',       sentido: 'menor' },
  { id: 'gve',   nivel: 'EA', nombre: 'Cobertura del programa de velocidad',      num: 'Vehículos con monitoreo',          den: 'Vehículos en desplazamientos',   factor: 100,     unidad: '%',       sentido: 'mayor' },
  { id: 'elvl',  nivel: 'A',  nombre: 'Excesos del límite de velocidad',          num: 'Desplazamientos con exceso',       den: 'Desplazamientos laborales',      factor: 100,     unidad: '%',       sentido: 'menor' },
  { id: 'idp',   nivel: 'T',  nombre: 'Inspecciones diarias preoperacionales',    num: 'Vehículos inspeccionados',         den: 'Vehículos en operación',         factor: 100,     unidad: '%',       sentido: 'mayor' },
  { id: 'cpmvh', nivel: 'T',  nombre: 'Cumplimiento del mantenimiento preventivo', num: 'Mantenimientos ejecutados',       den: 'Mantenimientos programados',     factor: 100,     unidad: '%',       sentido: 'mayor' },
  { id: 'cpfsv', nivel: 'T',  nombre: 'Cumplimiento del plan de formación',       num: 'Capacitaciones ejecutadas',        den: 'Capacitaciones programadas',     factor: 100,     unidad: '%',       sentido: 'mayor' },
  { id: 'cfsv',  nivel: 'T',  nombre: 'Cobertura del plan de formación',          num: 'Colaboradores capacitados',        den: 'Colaboradores objetivo',         factor: 100,     unidad: '%',       sentido: 'mayor' },
  { id: 'ncac',  nivel: 'T',  nombre: 'No conformidades de auditoría cerradas',   num: 'No conformidades cerradas',        den: 'No conformidades identificadas', factor: 100,     unidad: '%',       sentido: 'mayor' },
];

const PESV_ESTADOS = [
  { k: 'cumple',        t: 'Cumple',        c: '#16a34a' },
  { k: 'no_cumple',     t: 'No cumple',     c: '#dc2626' },
  { k: 'no_aplica',     t: 'No aplica',     c: '#64748b' },
  { k: 'no_verificado', t: 'No verificado', c: '#f59e0b' },
];
const PESV_NIVELES = { basico: 'Básico', estandar: 'Estándar', avanzado: 'Avanzado' };
const PESV_NIVEL_TXT = { T: 'Todos los niveles', EA: 'Estándar y avanzado', A: 'Solo avanzado' };
const PESV_MAX_BYTES = 10 * 1024 * 1024;

// Estado del módulo
const PV = { evals: [], actual: null, tab: 'pasos', cargado: false, error: null, guardarT: null, filtroFase: 'todas',
             v2: null, autos: [], autoCheckHecho: false, creandoAuto: false };

// ─── Permisos ────────────────────────────────────────────────
function pesvPuedeEditar() {
  const r = SC.user?.role;
  return r === 'superadmin' || r === 'analista_rrhh' || r === 'lider_rrhh' || (typeof esLiderHSEQ === 'function' && esLiderHSEQ());
}
function pesvPuedeVer() { return pesvPuedeEditar() || ['gerencia', 'juridico'].includes(SC.user?.role); }
window.pesvPuedeVer = pesvPuedeVer;
window.pesvPuedeEditar = pesvPuedeEditar;

// ─── Reglas de nivel ─────────────────────────────────────────
function pesvAplica(nivelReq, nivelOrg) {
  if (nivelReq === 'EA') return nivelOrg === 'estandar' || nivelOrg === 'avanzado';
  if (nivelReq === 'A') return nivelOrg === 'avanzado';
  return true;
}
// Tabla 1 de la resolución: misionalidad 1 = transporte terrestre; 2 = otras
function pesvNivelSugerido(mis, veh, cond) {
  const v = Number(veh) || 0, c = Number(cond) || 0;
  if (mis === '1') {
    if (v > 50 || c > 50) return 'avanzado';
    if (v >= 20 || c >= 20) return 'estandar';
    if (v >= 11 || c >= 2) return 'basico';
  } else {
    if (v > 100 || c > 100) return 'avanzado';
    if (v >= 50 || c >= 50) return 'estandar';
    if (v >= 11 || c >= 2) return 'basico';
  }
  return null;
}
const pesvFaseDe = n => PESV_FASES.find(f => n >= f.pasos[0] && n <= f.pasos[1]);
const pesvCritId = (n, i) => `${n}.${i + 1}`;
const pesvDom = id => String(id).replace('.', '-');

// ─── Cálculos ────────────────────────────────────────────────
function pesvCalcPaso(ev, paso) {
  const nivel = ev?.nivel || 'avanzado';
  const r = { aplica: pesvAplica(paso.nivel, nivel), total: 0, cumple: 0, no_cumple: 0, no_aplica: 0, no_verificado: 0, pendiente: 0, evidencias: 0 };
  if (!r.aplica) return { ...r, pct: null, avance: null, estado: 'no_aplica_nivel' };
  paso.crit.forEach((_, i) => {
    const resp = ev?.respuestas?.[pesvCritId(paso.n, i)];
    r.total++;
    if (resp?.estado && r[resp.estado] != null) r[resp.estado]++; else r.pendiente++;
    r.evidencias += resp?.evidencias?.length || 0;
  });
  const base = r.total - r.no_aplica;
  r.pct = base && r.pendiente < r.total ? (r.cumple / base) * 100 : null;
  r.avance = r.total ? ((r.total - r.pendiente) / r.total) * 100 : 0;
  if (r.pendiente === r.total) r.estado = 'sin_evaluar';
  else if (base === 0) r.estado = 'no_aplica';
  else if (r.no_cumple > 0) r.estado = 'brechas';
  else if (r.pendiente > 0 || r.no_verificado > 0) r.estado = 'en_evaluacion';
  else r.estado = 'cumple';
  return r;
}

function pesvCalcGlobal(ev) {
  const g = { cumple: 0, no_cumple: 0, no_aplica: 0, no_verificado: 0, pendiente: 0, total: 0, pasosAplican: 0, pasosCumplen: 0, evidencias: 0 };
  const porPaso = {};
  PESV_PASOS.forEach(p => {
    const c = pesvCalcPaso(ev, p); porPaso[p.n] = c;
    if (!c.aplica) return;
    g.pasosAplican++;
    if (c.estado === 'cumple' || c.estado === 'no_aplica') g.pasosCumplen++;
    ['cumple', 'no_cumple', 'no_aplica', 'no_verificado', 'pendiente', 'total', 'evidencias'].forEach(k => g[k] += c[k]);
  });
  const base = g.total - g.no_aplica;
  g.pct = base ? (g.cumple / base) * 100 : 0;
  g.avance = g.total ? ((g.total - g.pendiente) / g.total) * 100 : 0;
  g.porFase = PESV_FASES.map(f => {
    const ps = PESV_PASOS.filter(p => p.n >= f.pasos[0] && p.n <= f.pasos[1] && porPaso[p.n].aplica);
    const cu = ps.reduce((s, p) => s + porPaso[p.n].cumple, 0);
    const bs = ps.reduce((s, p) => s + porPaso[p.n].total - porPaso[p.n].no_aplica, 0);
    return { ...f, pct: bs ? (cu / bs) * 100 : 0, nPasos: ps.length };
  });
  g.porPaso = porPaso;
  const hoy = new Date().toISOString().slice(0, 10);
  const acc = ev?.acciones || [];
  g.accAbiertas = acc.filter(a => a.estado !== 'cerrada').length;
  g.accVencidas = acc.filter(a => a.estado !== 'cerrada' && a.fechaLimite && a.fechaLimite < hoy).length;
  return g;
}
window.pesvCalcGlobal = pesvCalcGlobal;

const pesvColorPct = p => p == null ? '#94a3b8' : p >= 85 ? '#16a34a' : p >= 60 ? '#f59e0b' : '#dc2626';

// ─── Datos (Supabase) ────────────────────────────────────────
function pesvFila(ev) {
  return {
    id: ev.id, anio: ev.anio, nivel: ev.nivel, misionalidad: ev.misionalidad || '2',
    vehiculos: Number(ev.vehiculos) || 0, conductores: Number(ev.conductores) || 0,
    responsable: ev.responsable || '', estado: ev.estado || 'en_curso',
    respuestas: ev.respuestas || {}, acciones: ev.acciones || [], indicadores: ev.indicadores || {},
    actualizado_por: SC.user?.name || '', updated_at: new Date().toISOString(),
    // Columnas de supabase_pesv_autoevaluacion.sql: solo se envían si existen
    ...(PV.v2 ? { resumen: pesvResumen(ev), gestion: ev.gestion || {} } : {}),
  };
}
function pesvDesdeFila(r) {
  const js = v => { try { return typeof v === 'string' ? JSON.parse(v) : (v || null); } catch (e) { return null; } };
  return { id: r.id, anio: r.anio, nivel: r.nivel || 'avanzado', misionalidad: r.misionalidad || '2',
           vehiculos: r.vehiculos || 0, conductores: r.conductores || 0, responsable: r.responsable || '',
           estado: r.estado || 'en_curso', respuestas: js(r.respuestas) || {}, acciones: js(r.acciones) || [],
           indicadores: js(r.indicadores) || {}, gestion: js(r.gestion) || {},
           actualizadoPor: r.actualizado_por || '', updatedAt: r.updated_at || '' };
}

async function pesvCargar() {
  const rows = await sbFetch('pesv_evaluaciones', 'GET', null, '?select=*&order=anio.desc,updated_at.desc');
  PV.cargado = true;
  if (rows === null) { PV.error = 'tabla'; return; }
  PV.error = null;
  PV.evals = rows.map(pesvDesdeFila);
  if (!PV.actual || !PV.evals.some(e => e.id === PV.actual)) PV.actual = PV.evals[0]?.id || null;
  // Autoevaluaciones mensuales: si la tabla no existe, el script nuevo no se ha ejecutado
  const autos = await sbFetch('pesv_autoevaluaciones', 'GET', null, '?select=*&order=periodo.desc');
  PV.v2 = autos !== null;
  PV.autos = (autos || []).map(a => ({ ...a, resumen: typeof a.resumen === 'string' ? JSON.parse(a.resumen || '{}') : (a.resumen || {}) }));
}
const pesvEval = () => PV.evals.find(e => e.id === PV.actual) || null;

function pesvGuardar(ev, inmediato = false) {
  if (!pesvPuedeEditar() || !ev) return Promise.resolve(null);
  clearTimeout(PV.guardarT);
  const ejecutar = async () => {
    const r = await sbFetch('pesv_evaluaciones', 'POST', pesvFila(ev), '', { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
    ev.updatedAt = new Date().toISOString(); ev.actualizadoPor = SC.user?.name || '';
    const st = document.getElementById('pesv-guardado');
    if (st) st.textContent = r === null ? '⚠️ No se pudo guardar' : `✓ Guardado ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
    return r;
  };
  if (inmediato) return ejecutar();
  const st = document.getElementById('pesv-guardado'); if (st) st.textContent = 'Guardando…';
  PV.guardarT = setTimeout(ejecutar, 700);
  return Promise.resolve(true);
}

// ═══════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════════════════════════════
async function renderPESV(tab) {
  const root = document.getElementById('pesv-root');
  if (!root) return;
  if (!pesvPuedeVer()) { root.innerHTML = VZ.empty('No tienes acceso al módulo PESV.'); return; }
  if (tab) PV.tab = tab;
  if (!PV.cargado) { root.innerHTML = '<div class="vz-empty">Cargando PESV…</div>'; await pesvCargar(); }
  if (PV.error === 'tabla') {
    root.innerHTML = `<div class="glass-card p-4" style="border-left:4px solid var(--amber)">
      <b>El módulo PESV aún no está activado en la base de datos.</b>
      <div class="text-sm text-muted mt-2">Ejecuta el script <code>supabase_sig_pesv.sql</code> en Supabase → SQL Editor y vuelve a abrir esta sección.</div></div>`;
    return;
  }
  const ev = pesvEval();
  const editar = pesvPuedeEditar();
  const selector = PV.evals.length > 1 ? `<select class="form-select" style="width:auto;min-width:190px" onchange="PV.actual=this.value;renderPESV()">
      ${PV.evals.map(e => `<option value="${VZ.esc(e.id)}" ${e.id === PV.actual ? 'selected' : ''}>Evaluación ${e.anio} · ${PESV_NIVELES[e.nivel] || e.nivel}</option>`).join('')}</select>` : '';
  // Sin evaluación todavía: quien gestiona el PESV arranca con la del año en nivel avanzado
  if (!ev && editar && !PV.creandoAuto) {
    PV.creandoAuto = true;
    const ok = await pesvCrearSilenciosa();
    PV.creandoAuto = false;
    if (ok) return renderPESV(tab);
  }
  const alertasN = ev ? pesvAlertas(ev).filter(a => a.nivel !== 'info').length : 0;
  const tabs = [['pasos', '🧩 Los 24 pasos'], ['tablero', '📊 Tablero' + (alertasN ? ` · 🚨 ${alertasN}` : '')], ['evaluacion', '✅ Por criterio'],
                ['kanban', '▦ Kanban'], ['acciones', '🛠 Plan de acción'], ['indicadores', '📈 Indicadores'],
                ['autoeval', '📅 Autoevaluación mensual'], ['config', '⚙️ Nivel y datos']];
  root.innerHTML = `
    <div class="vz-head">
      <h2>Plan Estratégico de Seguridad Vial${ev ? ` · ${ev.anio}` : ''}<small>Resolución 40595 de 2022 · Ministerio de Transporte · ciclo PHVA${ev ? ` · nivel ${PESV_NIVELES[ev.nivel]}` : ''}</small></h2>
      <div class="vz-head-actions">
        <span class="vz-stamp" id="pesv-guardado">${ev?.updatedAt ? 'Actualizado ' + new Date(ev.updatedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) + (ev.actualizadoPor ? ' · ' + VZ.esc(ev.actualizadoPor) : '') : ''}</span>
        ${selector}
        ${ev ? `<button class="btn btn-ghost btn-sm" onclick="pesvExportarCSV()">⬇️ Exportar</button>` : ''}
        ${editar ? `<button class="btn btn-primary btn-sm" onclick="pesvNuevaEvaluacion()">+ Nueva evaluación</button>` : ''}
      </div>
    </div>
    ${!editar ? '<div class="readonly-banner mb-3"><span>🔒</span><span>Consulta de solo lectura</span></div>' : ''}
    ${editar && PV.v2 === false ? `<div class="info-box mb-3" style="border-left:3px solid var(--amber);font-size:12px">⚙️ Para activar la <b>autoevaluación mensual del día 5</b>, las alertas y la gestión por paso (responsable, fecha y evidencias del paso), ejecuta <code>supabase_pesv_autoevaluacion.sql</code> en Supabase → SQL Editor.</div>` : ''}
    ${ev ? `<div class="tabs mb-4">${tabs.map(([k, t]) => `<div class="tab ${PV.tab === k ? 'active' : ''}" onclick="renderPESV('${k}')">${t}</div>`).join('')}</div>
    <div id="pesv-body"></div>` : `
    <div class="glass-card p-4" style="text-align:center">
      <div style="font-size:40px">🚦</div>
      <div style="font-weight:700;color:var(--navy);margin-top:6px">Aún no hay evaluaciones del PESV</div>
      <div class="text-sm text-muted mt-2">Crea la evaluación del año para empezar a calificar los 24 pasos.</div>
      ${editar ? '<button class="btn btn-primary mt-3" onclick="pesvNuevaEvaluacion()">+ Crear evaluación</button>' : ''}
    </div>`}`;
  if (!ev) return;
  pesvPintarTab();
  pesvAutoCheck();
}
window.renderPESV = renderPESV;

function pesvPintarTab() {
  const body = document.getElementById('pesv-body'), ev = pesvEval();
  if (!body || !ev) return;
  ({ pasos: pesvPasos, tablero: pesvTablero, evaluacion: pesvEvaluacion, kanban: pesvKanban, acciones: pesvAcciones,
     indicadores: pesvIndicadores, autoeval: pesvAutoeval, config: pesvConfig })[PV.tab]?.(body, ev);
}

// ─── Tablero ────────────────────────────────────────────────
function pesvTablero(el, ev) {
  const g = pesvCalcGlobal(ev);
  const kpis = [
    VZ.kpi({ label: 'Cumplimiento global', value: VZ.num(g.pct, 1), unit: '%', icon: '🎯', tone: g.pct >= 85 ? 'green' : g.pct >= 60 ? 'amber' : 'red', sub: 'cumplen / aplicables' }),
    VZ.kpi({ label: 'Avance de la evaluación', value: VZ.num(g.avance, 0), unit: '%', icon: '📝', tone: 'blue', sub: `${g.total - g.pendiente} de ${g.total} criterios`, onclick: "renderPESV('evaluacion')" }),
    VZ.kpi({ label: 'Pasos que cumplen', value: `${g.pasosCumplen}/${g.pasosAplican}`, icon: '🧩', tone: 'teal', sub: `nivel ${PESV_NIVELES[ev.nivel]}`, onclick: "renderPESV('kanban')" }),
    VZ.kpi({ label: 'Criterios en "No cumple"', value: VZ.num(g.no_cumple), icon: '⛔', tone: g.no_cumple ? 'red' : 'green', sub: `${g.no_verificado} no verificados` }),
    VZ.kpi({ label: 'Acciones abiertas', value: VZ.num(g.accAbiertas), icon: '🛠', tone: g.accVencidas ? 'red' : 'purple', sub: g.accVencidas ? `${g.accVencidas} vencidas` : 'ninguna vencida', onclick: "renderPESV('acciones')" }),
    VZ.kpi({ label: 'Evidencias cargadas', value: VZ.num(g.evidencias), icon: '📎', tone: 'navy', sub: 'soportes documentales' }),
  ].join('');
  const fases = g.porFase.map(f => `
    <div class="vz-span-3 pesv-fase" style="background:linear-gradient(135deg, ${f.color}, ${f.color}cc)" onclick="PV.filtroFase='${f.key}';renderPESV('evaluacion')">
      <h4>${f.key} · ${f.nombre}</h4><div class="big">${VZ.num(f.pct, 0)}%</div>
      <div style="font-size:11px;opacity:.9">${f.desc} · ${f.nPasos} pasos</div>${VZ.progress(f.pct, '#fff')}
    </div>`).join('');
  const aplican = PESV_PASOS.filter(p => g.porPaso[p.n].aplica);
  const heat = `<div class="vz-heat" style="grid-template-columns:repeat(auto-fill,minmax(64px,1fr))">${aplican.map(p => {
    const c = g.porPaso[p.n];
    const col = c.estado === 'sin_evaluar' ? '#cbd5e1' : c.estado === 'no_aplica' ? '#94a3b8' : pesvColorPct(c.pct);
    return `<div class="vz-heat-cell" style="background:${col}" title="Paso ${p.n}. ${VZ.esc(p.titulo)}" onclick="pesvAbrirPaso(${p.n})">
      P${p.n}<small>${c.estado === 'sin_evaluar' ? '—' : c.pct == null ? 'N/A' : VZ.num(c.pct, 0) + '%'}</small></div>`;
  }).join('')}</div>
  <div class="vz-legend"><span><i style="background:#16a34a"></i>≥ 85%</span><span><i style="background:#f59e0b"></i>60–84%</span><span><i style="background:#dc2626"></i>&lt; 60%</span><span><i style="background:#cbd5e1"></i>Sin calificar</span></div>`;
  const estados = VZ.donut(PESV_ESTADOS.map(s => ({ label: s.t, value: g[s.k], color: s.c })).concat([{ label: 'Sin calificar', value: g.pendiente, color: '#cbd5e1' }]), { centerSub: 'criterios' });
  const brechas = aplican.map(p => ({ p, c: g.porPaso[p.n] })).filter(x => x.c.no_cumple).sort((a, b) => b.c.no_cumple - a.c.no_cumple).slice(0, 8);
  const top = brechas.length ? VZ.bars(brechas.map(x => ({ label: `P${x.p.n} · ${x.p.titulo}`, value: x.c.no_cumple, color: 'red', onclick: `pesvAbrirPaso(${x.p.n})` })), { sort: false })
                             : VZ.empty('No hay criterios en "No cumple"');
  el.innerHTML = `
    <div class="vz-kpis">${kpis}</div>
    <div class="vz-grid">${fases}</div>
    <div class="vz-grid">
      ${VZ.panel('Mapa de calor por paso', heat, { sub: 'Haz clic en un paso para calificarlo', span: 8 })}
      ${VZ.panel('Estado de los criterios', estados, { span: 4 })}
    </div>
    <div class="vz-grid">
      ${VZ.panel('Cumplimiento por paso', VZ.columns(aplican.map(p => 'P' + p.n), [{ name: '% cumplimiento', values: aplican.map(p => Math.round(g.porPaso[p.n].pct || 0)), color: 'blue' }], { unit: '%', h: 200 }), { sub: 'Porcentaje de criterios que cumplen en cada paso', span: 7 })}
      ${VZ.panel('Brechas prioritarias', top, { sub: 'Pasos con más criterios en "No cumple"', span: 5 })}
    </div>
    <div class="vz-grid">
      ${VZ.panel('Evolución mensual del cumplimiento', pesvGraficoAutos(ev), { sub: 'Autoevaluación registrada el día 5 de cada mes', span: 7 })}
      ${VZ.panel('🚨 Alertas', pesvListaAlertas(ev), { sub: 'Lo que requiere atención antes del próximo corte', span: 5 })}
    </div>`;
}

// ─── Evaluación (lista de pasos por fase) ───────────────────
function pesvEvaluacion(el, ev) {
  const g = pesvCalcGlobal(ev);
  const f = PV.filtroFase || 'todas';
  const pills = `<div class="vz-pills mb-3">
    <button class="vz-pill ${f === 'todas' ? 'on' : ''}" onclick="PV.filtroFase='todas';renderPESV('evaluacion')">Todas las fases</button>
    ${PESV_FASES.map(x => `<button class="vz-pill ${f === x.key ? 'on' : ''}" onclick="PV.filtroFase='${x.key}';renderPESV('evaluacion')">${x.key} · ${x.nombre}</button>`).join('')}</div>`;
  const bloques = PESV_FASES.filter(x => f === 'todas' || f === x.key).map(fase => {
    const pasos = PESV_PASOS.filter(p => p.n >= fase.pasos[0] && p.n <= fase.pasos[1]);
    return `<div style="margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:3px;background:${fase.color}"></span>
        <b style="color:var(--navy);font-size:13px">${fase.key} · ${fase.nombre}</b><span class="text-xs text-muted">${fase.desc}</span></div>
      ${pasos.map(p => {
        const c = g.porPaso[p.n];
        if (!c.aplica) return `<div class="pesv-paso-row is-off"><div class="pesv-num" style="background:#94a3b8">${p.n}</div>
          <div style="flex:1"><div style="font-weight:600;font-size:13px">${VZ.esc(p.titulo)}</div><div class="text-xs text-muted">No aplica para nivel ${PESV_NIVELES[ev.nivel]} · ${PESV_NIVEL_TXT[p.nivel]}</div></div></div>`;
        const chips = [
          c.cumple ? `<span class="vz-chip c-green">✓ ${c.cumple}</span>` : '',
          c.no_cumple ? `<span class="vz-chip c-red">✗ ${c.no_cumple}</span>` : '',
          c.no_verificado ? `<span class="vz-chip c-amber">? ${c.no_verificado}</span>` : '',
          c.no_aplica ? `<span class="vz-chip">N/A ${c.no_aplica}</span>` : '',
          c.pendiente ? `<span class="vz-chip">${c.pendiente} sin calificar</span>` : '',
          c.evidencias ? `<span class="vz-chip c-blue">📎 ${c.evidencias}</span>` : '',
        ].join('');
        return `<div class="pesv-paso-row" onclick="pesvAbrirPaso(${p.n})">
          <div class="pesv-num" style="background:${fase.color}">${p.n}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;color:var(--navy)">${VZ.esc(p.titulo)}</div>
            <div class="vz-card-meta">${chips}<span class="text-xs text-muted">${PESV_NIVEL_TXT[p.nivel]}</span></div>
          </div>
          <div style="width:130px;flex-shrink:0;text-align:right">
            <div style="font-weight:800;font-size:16px;color:${pesvColorPct(c.pct)}">${c.pct == null ? (c.estado === 'sin_evaluar' ? '—' : 'N/A') : VZ.num(c.pct, 0) + '%'}</div>
            ${VZ.progress(c.pct || 0)}
          </div></div>`;
      }).join('')}</div>`;
  }).join('');
  el.innerHTML = pills + bloques;
}

// ─── Kanban de pasos ────────────────────────────────────────
function pesvKanban(el, ev) {
  const g = pesvCalcGlobal(ev);
  const col = (key, title, color) => ({ key, title, color, cards: PESV_PASOS.filter(p => g.porPaso[p.n].aplica && g.porPaso[p.n].estado === key).map(p => {
    const c = g.porPaso[p.n], fase = pesvFaseDe(p.n);
    return { id: 'p' + p.n, title: `Paso ${p.n} · ${p.titulo}`, color: fase.color,
             sub: `${fase.nombre} · ${c.total - c.pendiente}/${c.total} criterios calificados`,
             chips: [...(c.pct != null ? [{ t: VZ.num(c.pct, 0) + '%', c: c.pct >= 85 ? 'green' : c.pct >= 60 ? 'amber' : 'red' }] : []),
                     ...(c.no_cumple ? [{ t: `${c.no_cumple} no cumple`, c: 'red' }] : []),
                     ...(c.evidencias ? [{ t: `📎 ${c.evidencias}`, c: 'blue' }] : [])],
             onclick: `pesvAbrirPaso(${p.n})` };
  }) });
  el.innerHTML = `<div class="text-sm text-muted mb-3">Cada paso se ubica solo según la calificación de sus criterios. Haz clic en una tarjeta para abrirlo.</div>` +
    VZ.kanban([
      col('sin_evaluar', 'Sin evaluar', 'slate'),
      col('en_evaluacion', 'En evaluación', 'blue'),
      col('brechas', 'Con brechas', 'red'),
      col('cumple', 'Cumple', 'green'),
    ], { limit: 30 });
}

// ─── Modal ──────────────────────────────────────────────────
function pesvModal(titulo, html, ancho = 880) {
  let m = document.getElementById('modal-pesv');
  if (!m) {
    m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'modal-pesv';
    m.innerHTML = `<div class="modal" style="width:96vw">
      <div class="modal-header"><div class="modal-title" id="pesv-modal-titulo"></div>
      <button class="modal-close" onclick="closeModal('modal-pesv')">✕</button></div>
      <div class="modal-body" id="pesv-modal-body" style="max-height:74vh;overflow:auto"></div></div>`;
    document.body.appendChild(m);
  }
  m.querySelector('.modal').style.maxWidth = ancho + 'px';
  document.getElementById('pesv-modal-titulo').textContent = titulo;
  document.getElementById('pesv-modal-body').innerHTML = html;
  openModal('modal-pesv');
}

// ─── Paso: calificar criterios ──────────────────────────────
function pesvAbrirPaso(n) {
  const ev = pesvEval(); const p = PESV_PASOS.find(x => x.n === n);
  if (!ev || !p) return;
  const fase = pesvFaseDe(n), c = pesvCalcPaso(ev, p), editar = pesvPuedeEditar();
  if (!c.aplica) { showNotif(`El paso ${n} no aplica para el nivel ${PESV_NIVELES[ev.nivel]}`, 'error'); return; }
  const crits = p.crit.map((txt, i) => {
    const id = pesvCritId(n, i), dom = pesvDom(id), r = ev.respuestas[id] || {};
    const seg = PESV_ESTADOS.map(s => `<button class="${r.estado === s.k ? 'on-' + s.k : ''}" ${editar ? `onclick="pesvCalificar('${id}','${s.k}')"` : 'disabled'}>${s.t}</button>`).join('');
    const evid = (r.evidencias || []).map(f => `<span class="vz-chip c-blue" style="cursor:pointer" onclick="pesvVerEvidencia('${id}','${VZ.esc(f.id)}')">📄 ${VZ.esc(f.nombre)}
      ${editar ? `<b style="margin-left:4px" title="Quitar" onclick="event.stopPropagation();pesvQuitarEvidencia('${id}','${VZ.esc(f.id)}')">✕</b>` : ''}</span>`).join('');
    const acc = (ev.acciones || []).filter(a => a.criterio === id);
    return `<div class="pesv-crit">
      <div class="pesv-crit-top">
        <div style="flex:1;min-width:240px"><b style="color:${fase.color}">${id}</b> <span style="font-size:13px">${VZ.esc(txt)}</span></div>
        <div class="vz-seg">${seg}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:flex-start">
        <textarea class="form-textarea" rows="1" style="flex:1;min-width:220px;font-size:12px;min-height:34px" placeholder="Observaciones o hallazgo…"
          ${editar ? `onchange="pesvObs('${id}',this.value)"` : 'disabled'}>${VZ.esc(r.obs || '')}</textarea>
        ${editar ? `<input type="file" multiple id="pesv-f-${dom}" style="display:none" onchange="pesvSubirEvidencias('${id}',this)">
          <button class="btn btn-ghost btn-sm" id="pesv-fb-${dom}" onclick="document.getElementById('pesv-f-${dom}').click()">📎 Evidencia</button>
          <button class="btn btn-ghost btn-sm" onclick="pesvNuevaAccion(${n},'${id}')">🛠 Acción</button>` : ''}
      </div>
      ${evid ? `<div class="vz-card-meta">${evid}</div>` : ''}
      ${acc.length ? `<div class="vz-card-meta">${acc.map(a => `<span class="vz-chip ${a.estado === 'cerrada' ? 'c-green' : 'c-purple'}">🛠 ${VZ.esc(String(a.descripcion).slice(0, 60))} · ${a.estado === 'cerrada' ? 'cerrada' : a.estado === 'en_curso' ? 'en curso' : 'por iniciar'}</span>`).join('')}</div>` : ''}
      ${r.fecha ? `<div class="text-xs text-muted" style="margin-top:6px">Calificado por ${VZ.esc(r.por || '')} · ${new Date(r.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</div>` : ''}
    </div>`;
  }).join('');
  const ant = pesvPasoVecino(n, -1), sig = pesvPasoVecino(n, 1);
  const nav = `<div class="flex gap-2" style="justify-content:space-between;margin-top:10px">
    ${ant !== n ? `<button class="btn btn-ghost btn-sm" onclick="pesvAbrirPaso(${ant})">← Paso ${ant}</button>` : '<span></span>'}
    ${sig !== n ? `<button class="btn btn-primary btn-sm" onclick="pesvAbrirPaso(${sig})">Paso ${sig} →</button>` : ''}</div>`;
  pesvModal(`Paso ${n} · ${p.titulo}`, `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      <span class="vz-chip" style="background:${fase.color};color:#fff">${fase.key} · ${fase.nombre}</span>
      <span class="vz-chip">${PESV_NIVEL_TXT[p.nivel]}</span>
      <span class="vz-chip" style="background:${pesvColorPct(c.pct)};color:#fff">${c.pct == null ? 'Sin calificar' : VZ.num(c.pct, 0) + '% cumplimiento'}</span>
      ${editar ? `<span style="flex:1"></span><button class="btn btn-ghost btn-sm" onclick="pesvMarcarTodo(${n})">Marcar todo "Cumple"</button>` : ''}
    </div>
    ${pesvPanelGestion(n, editar)}
    <div style="font-weight:700;font-size:12px;color:var(--navy);margin:14px 0 8px">Criterios de verificación</div>
    ${crits}${nav}`);
}
window.pesvAbrirPaso = pesvAbrirPaso;

function pesvPasoVecino(n, dir) {
  const ev = pesvEval();
  for (let k = n + dir; k >= 1 && k <= 24; k += dir) if (pesvAplica(PESV_PASOS[k - 1].nivel, ev.nivel)) return k;
  return n;
}

function pesvRefrescarPaso(n) {
  const top = document.getElementById('pesv-modal-body')?.scrollTop || 0;
  pesvAbrirPaso(n);
  const b2 = document.getElementById('pesv-modal-body'); if (b2) b2.scrollTop = top;
  if (['pasos', 'tablero', 'evaluacion', 'kanban', 'autoeval'].includes(PV.tab)) pesvPintarTab();
}

function pesvResp(ev, id) { ev.respuestas[id] = ev.respuestas[id] || {}; return ev.respuestas[id]; }
function pesvCalificar(id, estado) {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar()) return;
  const r = pesvResp(ev, id);
  if (r.estado === estado) delete r.estado; else r.estado = estado;
  r.fecha = new Date().toISOString(); r.por = SC.user?.name || '';
  pesvGuardar(ev);
  pesvRefrescarPaso(Number(id.split('.')[0]));
}
function pesvMarcarTodo(n) {
  const ev = pesvEval(); const p = PESV_PASOS.find(x => x.n === n);
  if (!ev || !p || !pesvPuedeEditar()) return;
  if (!confirm(`¿Marcar los ${p.crit.length} criterios del paso ${n} como "Cumple"?`)) return;
  p.crit.forEach((_, i) => { const r = pesvResp(ev, pesvCritId(n, i)); r.estado = 'cumple'; r.fecha = new Date().toISOString(); r.por = SC.user?.name || ''; });
  pesvGuardar(ev); pesvRefrescarPaso(n);
}
function pesvObs(id, txt) {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar()) return;
  pesvResp(ev, id).obs = String(txt || '').trim();
  pesvGuardar(ev);
}
window.pesvCalificar = pesvCalificar; window.pesvMarcarTodo = pesvMarcarTodo; window.pesvObs = pesvObs;

// ─── Almacenamiento privado 'sig' (compartido con la biblioteca) ─
function sigHeaders(extra = {}) {
  const token = typeof tokenActual === 'function' ? tokenActual() : null;
  if (!token || token === SB_KEY) throw new Error('Tu sesión expiró. Vuelve a ingresar.');
  return { apikey: SB_KEY, Authorization: 'Bearer ' + token, ...extra };
}
function sigNombreSeguro(s) {
  return String(s || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 110);
}
async function sigSubir(ruta, file) {
  if (typeof asegurarSesion === 'function') await asegurarSesion();
  const res = await fetch(`${SB_URL}/storage/v1/object/sig/${ruta}`, { method: 'POST', headers: sigHeaders({ 'Content-Type': file.type || 'application/octet-stream' }), body: file });
  if (!res.ok) throw new Error(res.status === 413 ? 'supera 10 MB' : `error ${res.status}`);
}
async function sigAbrir(ruta) {
  const w = window.open('', '_blank');   // abrir en el clic para que no la bloqueen
  try {
    if (typeof asegurarSesion === 'function') await asegurarSesion();
    const res = await fetch(`${SB_URL}/storage/v1/object/sign/sig/${ruta}`, { method: 'POST', headers: sigHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn: 120 }) });
    const d = await res.json().catch(() => ({}));
    const u = d.signedURL || d.signedUrl;
    if (!res.ok || !u) throw new Error(d.message || `error ${res.status}`);
    const url = /^https?:/.test(u) ? u : `${SB_URL}/storage/v1${u}`;
    if (w) w.location.href = url; else window.location.href = url;
  } catch (e) { if (w) w.close(); showNotif('No se pudo abrir el archivo: ' + e.message, 'error'); }
}
async function sigBorrar(ruta) {
  if (typeof asegurarSesion === 'function') await asegurarSesion();
  const res = await fetch(`${SB_URL}/storage/v1/object/sig/${ruta}`, { method: 'DELETE', headers: sigHeaders() });
  if (!res.ok && res.status !== 404) throw new Error(`error ${res.status}`);
}
window.sigSubir = sigSubir; window.sigAbrir = sigAbrir; window.sigBorrar = sigBorrar; window.sigNombreSeguro = sigNombreSeguro;

async function pesvSubirEvidencias(id, input) {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar()) return;
  const files = Array.from(input?.files || []); if (input) input.value = '';
  const grandes = files.filter(f => f.size > PESV_MAX_BYTES);
  if (grandes.length) showNotif(`⛔ Superan 10 MB y no se subirán: ${grandes.map(f => f.name).join(', ')}`, 'error');
  const validos = files.filter(f => f.size > 0 && f.size <= PESV_MAX_BYTES);
  if (!validos.length) return;
  const btn = document.getElementById('pesv-fb-' + pesvDom(id));
  const r = pesvResp(ev, id); r.evidencias = r.evidencias || [];
  let ok = 0;
  for (let i = 0; i < validos.length; i++) {
    const f = validos[i];
    if (btn) { btn.disabled = true; btn.textContent = `⏳ ${i + 1}/${validos.length}`; }
    try {
      const ruta = `pesv/${sigNombreSeguro(ev.id)}/${id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${sigNombreSeguro(f.name)}`;
      await sigSubir(ruta, f);
      r.evidencias.push({ id: 'ev' + Date.now() + i, nombre: f.name, ruta, tamano: f.size, por: SC.user?.name || '', fecha: new Date().toISOString() });
      ok++;
    } catch (e) { showNotif(`⚠️ ${f.name}: ${e.message}`, 'error'); }
  }
  if (ok) { await pesvGuardar(ev, true); showNotif(`📎 ${ok} evidencia(s) cargada(s) al criterio ${id}`); }
  pesvRefrescarPaso(Number(id.split('.')[0]));
}
function pesvVerEvidencia(id, evId) {
  const f = pesvEval()?.respuestas?.[id]?.evidencias?.find(x => x.id === evId);
  if (f) sigAbrir(f.ruta);
}
async function pesvQuitarEvidencia(id, evId) {
  const ev = pesvEval(); const r = ev?.respuestas?.[id];
  const f = r?.evidencias?.find(x => x.id === evId);
  if (!f || !pesvPuedeEditar() || !confirm(`¿Quitar la evidencia "${f.nombre}"?`)) return;
  try { await sigBorrar(f.ruta); } catch (e) { showNotif('No se pudo borrar el archivo: ' + e.message, 'error'); return; }
  r.evidencias = r.evidencias.filter(x => x.id !== evId);
  await pesvGuardar(ev, true);
  pesvRefrescarPaso(Number(id.split('.')[0]));
}
window.pesvSubirEvidencias = pesvSubirEvidencias; window.pesvVerEvidencia = pesvVerEvidencia; window.pesvQuitarEvidencia = pesvQuitarEvidencia;

// ─── Plan de acción (paso 23) ───────────────────────────────
function pesvNuevaAccion(n, criterio) {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar()) return;
  const p = PESV_PASOS.find(x => x.n === n) || PESV_PASOS[0];
  const opciones = p.crit.map((t, i) => `<option value="${pesvCritId(p.n, i)}" ${pesvCritId(p.n, i) === criterio ? 'selected' : ''}>${pesvCritId(p.n, i)} · ${VZ.esc(t).slice(0, 80)}</option>`).join('');
  pesvModal('🛠 Nueva acción de mejora', `
    <div class="form-group"><label class="form-label">Paso</label>
      <select class="form-select" id="pa-paso" onchange="pesvNuevaAccion(Number(this.value),'')">${PESV_PASOS.filter(x => pesvAplica(x.nivel, ev.nivel)).map(x => `<option value="${x.n}" ${x.n === p.n ? 'selected' : ''}>Paso ${x.n} · ${VZ.esc(x.titulo)}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Criterio</label><select class="form-select" id="pa-crit">${opciones}</select></div>
    <div class="form-group"><label class="form-label">Acción *</label><textarea class="form-textarea" id="pa-desc" rows="3" placeholder="¿Qué se va a hacer para cerrar la brecha?"></textarea></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Responsable</label><input class="form-input" id="pa-resp" placeholder="Nombre o cargo"></div>
      <div class="form-group"><label class="form-label">Fecha límite</label><input type="date" class="form-input" id="pa-fecha"></div></div>
    <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="pa-tipo"><option value="correctiva">Correctiva</option><option value="preventiva">Preventiva</option><option value="mejora">Mejora</option></select></div>
    <div class="flex gap-3 mt-2"><button class="btn btn-ghost" style="flex:1" onclick="pesvAbrirPaso(${p.n})">Volver al paso</button>
      <button class="btn btn-primary" style="flex:1" onclick="pesvGuardarAccion()">💾 Guardar acción</button></div>`, 620);
}
async function pesvGuardarAccion() {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar()) return;
  const desc = document.getElementById('pa-desc')?.value.trim();
  if (!desc) { showNotif('Describe la acción', 'error'); return; }
  const paso = Number(document.getElementById('pa-paso').value);
  ev.acciones = ev.acciones || [];
  ev.acciones.push({ id: 'ac' + Date.now(), paso, criterio: document.getElementById('pa-crit').value, descripcion: desc,
    responsable: document.getElementById('pa-resp').value.trim(), fechaLimite: document.getElementById('pa-fecha').value,
    tipo: document.getElementById('pa-tipo').value, estado: 'abierta', creadaPor: SC.user?.name || '', creada: new Date().toISOString() });
  await pesvGuardar(ev, true);
  showNotif('🛠 Acción registrada en el plan');
  if (PV.tab === 'acciones') { closeModal('modal-pesv'); pesvPintarTab(); } else pesvAbrirPaso(paso);
}
window.pesvNuevaAccion = pesvNuevaAccion; window.pesvGuardarAccion = pesvGuardarAccion;

const PESV_ESTADOS_ACC = [['abierta', 'Por iniciar', 'slate'], ['en_curso', 'En curso', 'blue'], ['cerrada', 'Cerradas', 'green']];
function pesvAcciones(el, ev) {
  const hoy = new Date().toISOString().slice(0, 10);
  const editar = pesvPuedeEditar();
  const card = a => {
    const venc = a.estado !== 'cerrada' && a.fechaLimite && a.fechaLimite < hoy;
    const idx = PESV_ESTADOS_ACC.findIndex(e => e[0] === (a.estado || 'abierta'));
    const acts = editar ? `${idx > 0 ? `<button class="btn btn-ghost btn-sm" onclick="pesvMoverAccion('${a.id}','${PESV_ESTADOS_ACC[idx - 1][0]}')" title="Mover atrás">◀</button>` : ''}
      ${idx < 2 ? `<button class="btn btn-ghost btn-sm" onclick="pesvMoverAccion('${a.id}','${PESV_ESTADOS_ACC[idx + 1][0]}')" title="Avanzar">▶</button>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="pesvBorrarAccion('${a.id}')" title="Eliminar">🗑</button>` : '';
    return { id: a.id, title: a.descripcion, color: pesvFaseDe(a.paso)?.color,
             sub: `Paso ${a.paso} · criterio ${a.criterio}${a.responsable ? ' · ' + a.responsable : ''}`,
             chips: [{ t: a.tipo || 'correctiva', c: 'purple' }, ...(a.fechaLimite ? [{ t: (venc ? '⏰ Vencida ' : '📅 ') + a.fechaLimite, c: venc ? 'red' : '' }] : [])],
             actions: acts, onclick: `pesvAbrirPaso(${a.paso})` };
  };
  const acc = ev.acciones || [];
  el.innerHTML = `<div class="flex justify-between items-center mb-3" style="flex-wrap:wrap;gap:8px">
      <div class="text-sm text-muted">Acciones preventivas, correctivas y de mejora (paso 23).${editar ? ' Arrastra las tarjetas entre columnas o usa ◀ ▶.' : ''}</div>
      ${editar ? `<button class="btn btn-primary btn-sm" onclick="pesvNuevaAccion(1,'')">+ Nueva acción</button>` : ''}</div>` +
    VZ.kanban(PESV_ESTADOS_ACC.map(([k, t, c]) => ({ key: k, title: t, color: c,
      cards: acc.filter(a => (a.estado || 'abierta') === k).sort((a, b) => String(a.fechaLimite || '9').localeCompare(String(b.fechaLimite || '9'))).map(card) })),
      { limit: 60, onDrop: editar ? 'pesvMoverAccion' : null });
}
async function pesvMoverAccion(id, estado) {
  const ev = pesvEval(); const a = ev?.acciones?.find(x => x.id === id);
  if (!a || !pesvPuedeEditar() || a.estado === estado || !PESV_ESTADOS_ACC.some(e => e[0] === estado)) return;
  a.estado = estado;
  if (estado === 'cerrada') { a.cerrada = new Date().toISOString(); a.cerradaPor = SC.user?.name || ''; }
  await pesvGuardar(ev, true);
  pesvPintarTab();
}
async function pesvBorrarAccion(id) {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar() || !confirm('¿Eliminar esta acción del plan?')) return;
  ev.acciones = (ev.acciones || []).filter(a => a.id !== id);
  await pesvGuardar(ev, true); pesvPintarTab();
}
window.pesvMoverAccion = pesvMoverAccion; window.pesvBorrarAccion = pesvBorrarAccion;

// ─── Indicadores (paso 20) ──────────────────────────────────
function pesvValorInd(ind, d) {
  if (!d || d.num === '' || d.num == null) return null;
  const n = Number(d.num); if (isNaN(n)) return null;
  if (!ind.den) return n * ind.factor;
  const den = Number(d.den); if (!den) return null;
  return (n / den) * ind.factor;
}
function pesvIndicadores(el, ev) {
  const editar = pesvPuedeEditar();
  const T = ['T1', 'T2', 'T3', 'T4'];
  const lista = PESV_INDICADORES.filter(i => pesvAplica(i.nivel, ev.nivel));
  ev.indicadores = ev.indicadores || {};
  const dis = editar ? '' : 'disabled';
  const tarjetas = lista.map(ind => {
    const d = ev.indicadores[ind.id] || {};
    const vals = T.map(t => pesvValorInd(ind, d[t]));
    const ult = [...vals].reverse().find(v => v != null);
    const s = VZ.semaforo(ult, d.meta == null || d.meta === '' ? null : Number(d.meta), ind.sentido);
    const fmt = v => v == null ? '—' : ind.unidad === '$' ? '$' + VZ.num(v) : VZ.num(v, 2);
    const celdas = T.map((t, ti) => `<td style="padding:4px;vertical-align:top">
      <input class="form-input" style="padding:4px 6px;font-size:12px;width:100%" type="number" step="any" placeholder="${VZ.esc(ind.num)}" title="${VZ.esc(ind.num)}"
        value="${VZ.esc(d[t]?.num ?? '')}" ${editar ? `onchange="pesvSetInd('${ind.id}','${t}','num',this.value)"` : dis}>
      ${ind.den ? `<input class="form-input" style="padding:4px 6px;font-size:12px;width:100%;margin-top:3px" type="number" step="any" placeholder="${VZ.esc(ind.den)}" title="${VZ.esc(ind.den)}"
        value="${VZ.esc(d[t]?.den ?? '')}" ${editar ? `onchange="pesvSetInd('${ind.id}','${t}','den',this.value)"` : dis}>` : ''}
      <div style="text-align:center;font-weight:700;font-size:12px;margin-top:3px">${fmt(vals[ti])}</div></td>`).join('');
    return `<div class="vz-panel vz-span-6"><div class="vz-panel-head">
        <div><div class="vz-panel-title">${VZ.esc(ind.nombre)}</div>
        <div class="vz-panel-sub">${ind.den ? `${VZ.esc(ind.num)} ÷ ${VZ.esc(ind.den)} × ${VZ.num(ind.factor)}` : VZ.esc(ind.num)} · ${ind.sentido === 'menor' ? 'menor es mejor' : 'mayor es mejor'}</div></div>
        <div style="text-align:right"><div style="font-size:20px;font-weight:800;color:${s.c}">${fmt(ult)}<small style="font-size:11px;color:var(--text-muted)"> ${ind.unidad !== '$' ? VZ.esc(ind.unidad) : ''}</small></div>
          <span class="vz-chip" style="background:${s.c};color:#fff">${s.txt}</span></div></div>
      <div class="vz-panel-body">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px"><span class="text-xs text-muted">Meta</span>
          <input class="form-input" style="width:110px;padding:4px 6px;font-size:12px" type="number" step="any" value="${VZ.esc(d.meta ?? '')}" ${editar ? `onchange="pesvSetInd('${ind.id}',null,'meta',this.value)"` : dis}>
          <div style="flex:1;text-align:right">${VZ.spark(vals.map(v => v ?? 0), { w: 160, h: 30, c: s.c })}</div></div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr>${T.map(t => `<th style="font-size:10px;color:var(--text-muted);font-weight:600">${t.replace('T', 'Trimestre ')}</th>`).join('')}</tr></thead>
        <tbody><tr>${celdas}</tr></tbody></table></div></div>`;
  }).join('');
  el.innerHTML = `<div class="info-box mb-3" style="font-size:12px">Indicadores obligatorios del paso 20 para el nivel <b>${PESV_NIVELES[ev.nivel]}</b>, con cortes trimestrales (31 mar · 30 jun · 30 sep · 31 dic). Antes del reporte de autogestión, verifica las fórmulas contra la tabla de indicadores de la resolución.</div>
    <div class="vz-grid">${tarjetas}</div>`;
}
function pesvSetInd(id, t, campo, valor) {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar()) return;
  ev.indicadores = ev.indicadores || {};
  const d = ev.indicadores[id] = ev.indicadores[id] || {};
  const v = valor === '' ? null : Number(valor);
  if (campo === 'meta') d.meta = v; else { d[t] = d[t] || {}; d[t][campo] = v; }
  pesvGuardar(ev);
  clearTimeout(PV.indT); PV.indT = setTimeout(() => { if (PV.tab === 'indicadores') pesvPintarTab(); }, 900);
}
window.pesvSetInd = pesvSetInd;

// ─── Nivel y datos de la organización ───────────────────────
function pesvConfig(el, ev) {
  const editar = pesvPuedeEditar();
  const sug = pesvNivelSugerido(ev.misionalidad, ev.vehiculos, ev.conductores);
  const dis = editar ? '' : 'disabled';
  el.innerHTML = `<div class="vz-grid">
    ${VZ.panel('Datos de la organización', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Año de la evaluación</label><input class="form-input" type="number" id="pc-anio" value="${ev.anio}" ${dis}></div>
        <div class="form-group"><label class="form-label">Líder del PESV</label><input class="form-input" id="pc-resp" value="${VZ.esc(ev.responsable || '')}" ${dis}></div></div>
      <div class="form-group"><label class="form-label">Misionalidad</label>
        <select class="form-select" id="pc-mis" ${dis} onchange="pesvVistaNivel()">
          <option value="1" ${ev.misionalidad === '1' ? 'selected' : ''}>1 · Empresa de transporte terrestre automotor</option>
          <option value="2" ${ev.misionalidad !== '1' ? 'selected' : ''}>2 · Otra misionalidad</option></select></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Vehículos (propios, contratados o administrados)</label><input class="form-input" type="number" id="pc-veh" value="${ev.vehiculos || 0}" ${dis} oninput="pesvVistaNivel()"></div>
        <div class="form-group"><label class="form-label">Conductores contratados o administrados</label><input class="form-input" type="number" id="pc-cond" value="${ev.conductores || 0}" ${dis} oninput="pesvVistaNivel()"></div></div>
      <div class="form-group"><label class="form-label">Nivel de implementación</label>
        <select class="form-select" id="pc-nivel" ${dis}>${Object.entries(PESV_NIVELES).map(([k, t]) => `<option value="${k}" ${ev.nivel === k ? 'selected' : ''}>${t} · ${k === 'basico' ? 18 : k === 'estandar' ? 22 : 24} pasos</option>`).join('')}</select>
        <div class="text-xs text-muted mt-1" id="pc-sug">${sug ? `Nivel sugerido por la tabla 1: <b>${PESV_NIVELES[sug]}</b>` : 'Por debajo de los umbrales de la tabla 1: verifica si la organización está obligada.'}</div></div>
      ${editar ? `<button class="btn btn-primary" onclick="pesvGuardarConfig()">💾 Guardar</button>
        <button class="btn btn-danger" style="margin-left:8px" onclick="pesvEliminarEvaluacion()">🗑 Eliminar evaluación</button>` : ''}
    `, { span: 7 })}
    ${VZ.panel('Niveles · tabla 1 de la resolución', `
      <table class="data-table" style="font-size:12px"><thead><tr><th>Nivel</th><th>Misionalidad 1</th><th>Misionalidad 2</th></tr></thead><tbody>
      <tr><td><b>Básico</b> · 18 pasos</td><td>11–19 vehículos o 2–19 conductores</td><td>11–49 vehículos o 2–49 conductores</td></tr>
      <tr><td><b>Estándar</b> · 22 pasos</td><td>20–50 vehículos o conductores</td><td>50–100 vehículos o conductores</td></tr>
      <tr><td><b>Avanzado</b> · 24 pasos</td><td>Más de 50 vehículos o conductores</td><td>Más de 100 vehículos o conductores</td></tr></tbody></table>
      <div class="text-xs text-muted mt-2">Si la organización queda en dos niveles, aplica el más alto. El nivel básico no incluye los pasos 2, 11, 13, 18, 19 y 21; el estándar no incluye el 11 ni el 21.</div>`, { span: 5 })}
  </div>`;
}
function pesvVistaNivel() {
  const s = pesvNivelSugerido(document.getElementById('pc-mis').value, document.getElementById('pc-veh').value, document.getElementById('pc-cond').value);
  const el = document.getElementById('pc-sug');
  if (el) el.innerHTML = s ? `Nivel sugerido por la tabla 1: <b>${PESV_NIVELES[s]}</b>` : 'Por debajo de los umbrales de la tabla 1: verifica si la organización está obligada.';
}
async function pesvGuardarConfig() {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar()) return;
  ev.anio = Number(document.getElementById('pc-anio').value) || ev.anio;
  ev.responsable = document.getElementById('pc-resp').value.trim();
  ev.misionalidad = document.getElementById('pc-mis').value;
  ev.vehiculos = Number(document.getElementById('pc-veh').value) || 0;
  ev.conductores = Number(document.getElementById('pc-cond').value) || 0;
  ev.nivel = document.getElementById('pc-nivel').value;
  await pesvGuardar(ev, true);
  if (typeof registrarAuditoria === 'function') registrarAuditoria('configurar', 'pesv', ev.id, `${ev.anio} · ${ev.nivel}`);
  showNotif('✅ Datos del PESV guardados');
  renderPESV('config');
}
async function pesvEliminarEvaluacion() {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar()) return;
  if (!confirm(`¿Eliminar la evaluación PESV ${ev.anio}? Se pierden sus calificaciones, acciones e indicadores.`)) return;
  const r = await sbFetch('pesv_evaluaciones', 'DELETE', null, `?id=eq.${encodeURIComponent(ev.id)}`);
  if (r === null) { showNotif('No se pudo eliminar', 'error'); return; }
  if (typeof registrarAuditoria === 'function') registrarAuditoria('eliminar', 'pesv', ev.id, String(ev.anio));
  PV.evals = PV.evals.filter(e => e.id !== ev.id); PV.actual = PV.evals[0]?.id || null; PV.tab = 'tablero';
  renderPESV();
}
window.pesvVistaNivel = pesvVistaNivel; window.pesvGuardarConfig = pesvGuardarConfig; window.pesvEliminarEvaluacion = pesvEliminarEvaluacion;

// ─── Nueva evaluación ───────────────────────────────────────
function pesvNuevaEvaluacion() {
  if (!pesvPuedeEditar()) return;
  const previa = PV.evals[0];
  pesvModal('🚦 Nueva evaluación del PESV', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Año</label><input class="form-input" type="number" id="pn-anio" value="${new Date().getFullYear()}"></div>
      <div class="form-group"><label class="form-label">Nivel</label><select class="form-select" id="pn-nivel">
        ${Object.entries(PESV_NIVELES).map(([k, t]) => `<option value="${k}" ${k === (previa?.nivel || 'avanzado') ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="form-group"><label class="form-label">Líder del PESV</label><input class="form-input" id="pn-resp" value="${VZ.esc(previa?.responsable || '')}"></div>
    ${previa ? `<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:6px 0 12px"><input type="checkbox" id="pn-copiar" checked>
      Partir de la evaluación ${previa.anio}: copia calificaciones, observaciones y acciones abiertas (no copia evidencias)</label>` : ''}
    <div class="flex gap-3"><button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-pesv')">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" onclick="pesvCrearEvaluacion()">Crear evaluación</button></div>`, 560);
}
async function pesvCrearEvaluacion() {
  if (!pesvPuedeEditar()) return;
  const previa = PV.evals[0];
  const copiar = !!(document.getElementById('pn-copiar')?.checked && previa);
  const ev = {
    id: 'pv' + Date.now(), anio: Number(document.getElementById('pn-anio').value) || new Date().getFullYear(),
    nivel: document.getElementById('pn-nivel').value, responsable: document.getElementById('pn-resp').value.trim(),
    misionalidad: previa?.misionalidad || '2', vehiculos: previa?.vehiculos || 0, conductores: previa?.conductores || 0,
    estado: 'en_curso', respuestas: {}, acciones: [], indicadores: {}, gestion: {},
  };
  if (copiar) {
    Object.entries(previa.respuestas || {}).forEach(([k, r]) => {
      const nr = {}; if (r.estado) nr.estado = r.estado; if (r.obs) nr.obs = `[${previa.anio}] ${r.obs}`;
      if (Object.keys(nr).length) ev.respuestas[k] = nr;
    });
    ev.acciones = (previa.acciones || []).filter(a => a.estado !== 'cerrada').map(a => ({ ...a }));
  }
  const r = await pesvGuardar(ev, true);
  if (r === null) { showNotif('No se pudo crear la evaluación', 'error'); return; }
  PV.evals.unshift(ev);
  PV.actual = ev.id; PV.tab = 'evaluacion';
  closeModal('modal-pesv');
  if (typeof registrarAuditoria === 'function') registrarAuditoria('crear', 'pesv', ev.id, `${ev.anio} · ${ev.nivel}`);
  showNotif(`🚦 Evaluación PESV ${ev.anio} creada`);
  renderPESV();
}
window.pesvNuevaEvaluacion = pesvNuevaEvaluacion; window.pesvCrearEvaluacion = pesvCrearEvaluacion;

// ─── Exportar a CSV (se abre en Excel) ──────────────────────
function pesvExportarCSV() {
  const ev = pesvEval(); if (!ev) return;
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const filas = [['Fase', 'Paso', 'Título del paso', 'Criterio', 'Requisito', 'Aplica', 'Estado', 'Observaciones', 'Evidencias', 'Calificado por', 'Fecha'].map(q).join(';')];
  PESV_PASOS.forEach(p => {
    const aplica = pesvAplica(p.nivel, ev.nivel), fase = pesvFaseDe(p.n);
    p.crit.forEach((t, i) => {
      const id = pesvCritId(p.n, i), r = ev.respuestas[id] || {};
      filas.push([fase.nombre, p.n, p.titulo, id, t, aplica ? 'Sí' : 'No', aplica ? (PESV_ESTADOS.find(s => s.k === r.estado)?.t || 'Sin calificar') : 'No aplica (nivel)',
        r.obs || '', (r.evidencias || []).map(e => e.nombre).join(' | '), r.por || '', r.fecha ? r.fecha.slice(0, 10) : ''].map(q).join(';'));
    });
  });
  const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `PESV_${ev.anio}_${ev.nivel}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
window.pesvExportarCSV = pesvExportarCSV;

// ═══════════════════════════════════════════════════════════════
// GESTIÓN PASO A PASO · AUTOEVALUACIÓN MENSUAL · ALERTAS
// (requiere supabase_pesv_autoevaluacion.sql para guardar la gestión
//  por paso y registrar la autoevaluación del día 5)
// ═══════════════════════════════════════════════════════════════
const PESV_GESTION = [
  { k: 'pendiente',    t: 'Pendiente',    c: 'slate' },
  { k: 'en_curso',     t: 'En curso',     c: 'blue' },
  { k: 'implementado', t: 'Implementado', c: 'amber' },
  { k: 'verificado',   t: 'Verificado',   c: 'green' },
];
const pesvHoyIso = () => new Date().toISOString().slice(0, 10);
function pesvPeriodoActual(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function pesvMesNombre(per) {
  const [y, m] = String(per || '').split('-');
  return m ? `${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][Number(m) - 1]} ${y}` : per;
}
function pesvProximoCorte(d = new Date()) {
  const c = new Date(d.getFullYear(), d.getMonth() + (d.getDate() >= 5 ? 1 : 0), 5);
  return c;
}
const pesvGest = (ev, n) => (ev.gestion = ev.gestion || {}, ev.gestion[n] = ev.gestion[n] || {}, ev.gestion[n]);

// Resumen que se guarda con la evaluación; la tarea del día 5 lo toma como foto del mes
function pesvResumen(ev) {
  const g = pesvCalcGlobal(ev);
  const porPaso = {};
  PESV_PASOS.forEach(p => { const c = g.porPaso[p.n]; if (c.aplica) porPaso[p.n] = c.pct == null ? null : Math.round(c.pct); });
  const porFase = {}; g.porFase.forEach(f => { porFase[f.key] = Math.round(f.pct); });
  const evidPasos = Object.values(ev.gestion || {}).reduce((s, x) => s + (x.evidencias?.length || 0), 0);
  return { pct: Math.round(g.pct * 10) / 10, avance: Math.round(g.avance), pasosCumplen: g.pasosCumplen, pasosAplican: g.pasosAplican,
           noCumple: g.no_cumple, noVerificado: g.no_verificado, evidencias: g.evidencias + evidPasos,
           accAbiertas: g.accAbiertas, accVencidas: g.accVencidas, nivel: ev.nivel, porFase, porPaso, fecha: new Date().toISOString() };
}

// Crea la evaluación del año (nivel avanzado) cuando no hay ninguna
async function pesvCrearSilenciosa() {
  const ev = { id: 'pv' + Date.now(), anio: new Date().getFullYear(), nivel: 'avanzado', responsable: '', misionalidad: '2',
               vehiculos: 0, conductores: 0, estado: 'en_curso', respuestas: {}, acciones: [], indicadores: {}, gestion: {} };
  const r = await pesvGuardar(ev, true);
  if (r === null) return false;
  PV.evals.unshift(ev); PV.actual = ev.id; PV.tab = 'pasos';
  if (typeof registrarAuditoria === 'function') registrarAuditoria('crear', 'pesv', ev.id, `${ev.anio} · avanzado (automática)`);
  return true;
}

// ─── Los 24 pasos en tarjetas ───────────────────────────────
function pesvSiguientePendiente(ev) {
  const g = pesvCalcGlobal(ev);
  return PESV_PASOS.find(p => g.porPaso[p.n].aplica && ['sin_evaluar', 'en_evaluacion', 'brechas'].includes(g.porPaso[p.n].estado)
                              && (pesvGest(ev, p.n).estado || 'pendiente') !== 'verificado')?.n || null;
}
function pesvPasos(el, ev) {
  const g = pesvCalcGlobal(ev), hoy = pesvHoyIso(), editar = pesvPuedeEditar();
  const sig = pesvSiguientePendiente(ev);
  const verif = PESV_PASOS.filter(p => g.porPaso[p.n].aplica && (pesvGest(ev, p.n).estado === 'verificado')).length;
  const corte = pesvProximoCorte();
  const head = `<div class="glass-card mb-4" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;padding:14px 18px">
      <div style="min-width:180px"><div class="text-xs text-muted">Cumplimiento actual</div>
        <div style="font-size:26px;font-weight:800;color:${pesvColorPct(g.pct)}">${VZ.num(g.pct, 1)}%</div></div>
      <div style="flex:1;min-width:220px"><div class="text-xs text-muted" style="margin-bottom:4px">${g.pasosCumplen} de ${g.pasosAplican} pasos cumplen · ${verif} verificados · ${VZ.num(g.avance, 0)}% de criterios calificados</div>${VZ.progress(g.pct)}</div>
      <div class="text-xs text-muted" style="min-width:170px">📅 Próxima autoevaluación<br><b style="color:var(--navy);font-size:13px">${corte.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</b></div>
      ${sig ? `<button class="btn btn-primary" onclick="pesvAbrirPaso(${sig})">▶ Continuar con el paso ${sig}</button>` : '<span class="vz-chip c-green">✓ Todos los pasos gestionados</span>'}
    </div>`;
  const tarjeta = p => {
    const c = g.porPaso[p.n], fase = pesvFaseDe(p.n), gs = pesvGest(ev, p.n);
    if (!c.aplica) return `<div class="pesv-card is-off" title="No aplica en nivel ${PESV_NIVELES[ev.nivel]}">
        <div class="pesv-card-top"><div class="pesv-num" style="background:#94a3b8">${p.n}</div><div class="pesv-card-tit">${VZ.esc(p.titulo)}</div></div>
        <div class="text-xs text-muted" style="margin-top:8px">No aplica en nivel ${PESV_NIVELES[ev.nivel]} · ${PESV_NIVEL_TXT[p.nivel]}</div></div>`;
    const est = PESV_GESTION.find(x => x.k === (gs.estado || 'pendiente'));
    const evid = c.evidencias + (gs.evidencias?.length || 0);
    const venc = gs.fecha && gs.fecha < hoy && !['implementado', 'verificado'].includes(gs.estado);
    return `<div class="pesv-card" style="--fase-c:${fase.color}" onclick="pesvAbrirPaso(${p.n})" role="button" tabindex="0">
      <div class="pesv-card-top"><div class="pesv-num" style="background:${fase.color}">${p.n}</div>
        <div class="pesv-card-tit">${VZ.esc(p.titulo)}</div>
        <div class="pesv-card-pct" style="color:${pesvColorPct(c.pct)}">${c.pct == null ? '—' : VZ.num(c.pct, 0) + '%'}</div></div>
      ${VZ.progress(c.pct || 0)}
      <div class="vz-card-meta">
        <span class="vz-chip ${est.c === 'slate' ? '' : 'c-' + est.c}">${est.t}</span>
        <span class="vz-chip ${evid ? 'c-blue' : 'c-amber'}">📎 ${evid || 'Sin'} evidencia${evid === 1 ? '' : 's'}</span>
        ${c.no_cumple ? `<span class="vz-chip c-red">✗ ${c.no_cumple}</span>` : ''}
        ${venc ? `<span class="vz-chip c-red">⏰ ${VZ.esc(gs.fecha)}</span>` : gs.fecha ? `<span class="vz-chip">📅 ${VZ.esc(gs.fecha)}</span>` : ''}
      </div>
      <div class="text-xs text-muted" style="margin-top:6px">${gs.responsable ? '👤 ' + VZ.esc(gs.responsable) : (editar ? 'Sin responsable asignado' : '')} · ${c.total - c.pendiente}/${c.total} criterios</div>
    </div>`;
  };
  el.innerHTML = head + PESV_FASES.map(f => `
    <div style="margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="width:10px;height:10px;border-radius:3px;background:${f.color}"></span>
        <b style="color:var(--navy);font-size:13px">${f.key} · ${f.nombre}</b>
        <span class="text-xs text-muted">${f.desc} · pasos ${f.pasos[0]} a ${f.pasos[1]} · ${VZ.num(g.porFase.find(x => x.key === f.key).pct, 0)}%</span></div>
      <div class="pesv-grid">${PESV_PASOS.filter(p => p.n >= f.pasos[0] && p.n <= f.pasos[1]).map(tarjeta).join('')}</div>
    </div>`).join('');
}

// ─── Panel de gestión dentro de cada paso ───────────────────
function pesvPanelGestion(n, editar) {
  const ev = pesvEval(); if (!ev) return '';
  if (!PV.v2) return `<div class="info-box" style="font-size:12px">La gestión del paso (responsable, fecha y evidencias generales) se activa al ejecutar <code>supabase_pesv_autoevaluacion.sql</code>. Mientras tanto puedes calificar los criterios y cargar evidencias en cada uno.</div>`;
  const gs = pesvGest(ev, n), dis = editar ? '' : 'disabled';
  const evid = (gs.evidencias || []).map(f => `<span class="vz-chip c-blue" style="cursor:pointer" onclick="pesvVerEvidPaso(${n},'${VZ.esc(f.id)}')">📄 ${VZ.esc(f.nombre)}
      ${editar ? `<b style="margin-left:4px" title="Quitar" onclick="event.stopPropagation();pesvQuitarEvidPaso(${n},'${VZ.esc(f.id)}')">✕</b>` : ''}</span>`).join('');
  return `<div class="glass-card p-3" style="border-left:3px solid ${pesvFaseDe(n).color}">
    <div style="font-weight:700;font-size:12px;color:var(--navy);margin-bottom:8px">Gestión del paso ${n}</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Responsable</label><input class="form-input" value="${VZ.esc(gs.responsable || '')}" ${dis} placeholder="Nombre o cargo" onchange="pesvSetGestion(${n},'responsable',this.value)"></div>
      <div class="form-group"><label class="form-label">Fecha compromiso</label><input type="date" class="form-input" value="${VZ.esc(gs.fecha || '')}" ${dis} onchange="pesvSetGestion(${n},'fecha',this.value)"></div>
      <div class="form-group"><label class="form-label">Estado de implementación</label><select class="form-select" ${dis} onchange="pesvSetGestion(${n},'estado',this.value)">
        ${PESV_GESTION.map(x => `<option value="${x.k}" ${(gs.estado || 'pendiente') === x.k ? 'selected' : ''}>${x.t}</option>`).join('')}</select></div></div>
    <div class="form-group"><label class="form-label">Notas / plan del paso</label><textarea class="form-textarea" rows="2" ${dis} onchange="pesvSetGestion(${n},'notas',this.value)">${VZ.esc(gs.notas || '')}</textarea></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span class="text-xs text-muted">Evidencias del paso (actas, políticas, registros…) · máx. 10 MB c/u</span>
      ${editar ? `<input type="file" multiple id="pesv-fp-${n}" style="display:none" onchange="pesvSubirEvidPaso(${n},this)">
        <button class="btn btn-ghost btn-sm" id="pesv-fpb-${n}" onclick="document.getElementById('pesv-fp-${n}').click()">📎 Cargar evidencias</button>` : ''}
    </div>
    ${evid ? `<div class="vz-card-meta">${evid}</div>` : '<div class="text-xs text-muted" style="margin-top:6px">Aún no hay evidencias generales del paso.</div>'}
    ${gs.actualizado ? `<div class="text-xs text-muted" style="margin-top:6px">Actualizado por ${VZ.esc(gs.por || '')} · ${new Date(gs.actualizado).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</div>` : ''}
  </div>`;
}
function pesvSetGestion(n, campo, valor) {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar() || !PV.v2) return;
  const gs = pesvGest(ev, n);
  gs[campo] = String(valor || '').trim();
  gs.actualizado = new Date().toISOString(); gs.por = SC.user?.name || '';
  pesvGuardar(ev);
  if (campo === 'estado' || campo === 'fecha') pesvRefrescarPaso(n);
}
async function pesvSubirEvidPaso(n, input) {
  const ev = pesvEval(); if (!ev || !pesvPuedeEditar() || !PV.v2) return;
  const files = Array.from(input?.files || []); if (input) input.value = '';
  const grandes = files.filter(f => f.size > PESV_MAX_BYTES);
  if (grandes.length) showNotif(`⛔ Superan 10 MB y no se subirán: ${grandes.map(f => f.name).join(', ')}`, 'error');
  const validos = files.filter(f => f.size > 0 && f.size <= PESV_MAX_BYTES);
  if (!validos.length) return;
  const btn = document.getElementById('pesv-fpb-' + n);
  const gs = pesvGest(ev, n); gs.evidencias = gs.evidencias || [];
  let ok = 0;
  for (let i = 0; i < validos.length; i++) {
    const f = validos[i];
    if (btn) { btn.disabled = true; btn.textContent = `⏳ ${i + 1}/${validos.length}`; }
    try {
      const ruta = `pesv/${sigNombreSeguro(ev.id)}/paso-${n}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${sigNombreSeguro(f.name)}`;
      await sigSubir(ruta, f);
      gs.evidencias.push({ id: 'ep' + Date.now() + i, nombre: f.name, ruta, tamano: f.size, por: SC.user?.name || '', fecha: new Date().toISOString() });
      ok++;
    } catch (e) { showNotif(`⚠️ ${f.name}: ${e.message}`, 'error'); }
  }
  if (ok) { gs.actualizado = new Date().toISOString(); gs.por = SC.user?.name || ''; await pesvGuardar(ev, true); showNotif(`📎 ${ok} evidencia(s) cargada(s) al paso ${n}`); }
  pesvRefrescarPaso(n);
}
function pesvVerEvidPaso(n, id) { const f = pesvEval()?.gestion?.[n]?.evidencias?.find(x => x.id === id); if (f) sigAbrir(f.ruta); }
async function pesvQuitarEvidPaso(n, id) {
  const ev = pesvEval(); const gs = ev?.gestion?.[n]; const f = gs?.evidencias?.find(x => x.id === id);
  if (!f || !pesvPuedeEditar() || !confirm(`¿Quitar la evidencia "${f.nombre}"?`)) return;
  try { await sigBorrar(f.ruta); } catch (e) { showNotif('No se pudo borrar el archivo: ' + e.message, 'error'); return; }
  gs.evidencias = gs.evidencias.filter(x => x.id !== id);
  await pesvGuardar(ev, true); pesvRefrescarPaso(n);
}
window.pesvSetGestion = pesvSetGestion; window.pesvSubirEvidPaso = pesvSubirEvidPaso;
window.pesvVerEvidPaso = pesvVerEvidPaso; window.pesvQuitarEvidPaso = pesvQuitarEvidPaso;

// ─── Alertas ────────────────────────────────────────────────
function pesvAlertas(ev) {
  const g = pesvCalcGlobal(ev), hoy = pesvHoyIso(), out = [];
  (ev.acciones || []).filter(a => a.estado !== 'cerrada' && a.fechaLimite && a.fechaLimite < hoy).forEach(a =>
    out.push({ nivel: 'alta', icon: '⏰', txt: `Acción vencida (paso ${a.paso}): ${a.descripcion}`, sub: `Venció el ${a.fechaLimite}${a.responsable ? ' · ' + a.responsable : ''}`, onclick: "renderPESV('acciones')" }));
  PESV_PASOS.forEach(p => {
    const c = g.porPaso[p.n]; if (!c.aplica) return;
    const gs = ev.gestion?.[p.n] || {};
    if (gs.fecha && gs.fecha < hoy && !['implementado', 'verificado'].includes(gs.estado))
      out.push({ nivel: 'alta', icon: '📅', txt: `Paso ${p.n} con fecha compromiso vencida`, sub: `${p.titulo} · ${gs.fecha}`, onclick: `pesvAbrirPaso(${p.n})` });
    if (c.no_cumple) out.push({ nivel: 'media', icon: '⛔', txt: `Paso ${p.n}: ${c.no_cumple} criterio(s) en "No cumple"`, sub: p.titulo, onclick: `pesvAbrirPaso(${p.n})` });
    const evid = c.evidencias + (gs.evidencias?.length || 0);
    if (!evid && c.cumple) out.push({ nivel: 'media', icon: '📎', txt: `Paso ${p.n} marcado "Cumple" sin evidencias`, sub: p.titulo, onclick: `pesvAbrirPaso(${p.n})` });
  });
  const sinCal = PESV_PASOS.filter(p => g.porPaso[p.n].aplica && g.porPaso[p.n].estado === 'sin_evaluar').length;
  if (sinCal) out.push({ nivel: 'media', icon: '📝', txt: `${sinCal} paso(s) sin calificar`, sub: 'No suman al cumplimiento hasta calificarlos', onclick: "renderPESV('pasos')" });
  const d = new Date();
  if (d.getDate() < 5) out.push({ nivel: 'info', icon: '🗓', txt: `Faltan ${5 - d.getDate()} día(s) para la autoevaluación del 5`, sub: 'Actualiza calificaciones y evidencias antes del corte', onclick: "renderPESV('pasos')" });
  const orden = { alta: 0, media: 1, info: 2 };
  return out.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}
function pesvListaAlertas(ev) {
  const al = pesvAlertas(ev);
  if (!al.length) return VZ.empty('Sin alertas: el PESV está al día');
  const col = { alta: '#dc2626', media: '#f59e0b', info: '#2563eb' };
  return `<div style="max-height:260px;overflow:auto">${al.slice(0, 25).map(a => `
    <div onclick="${VZ.esc(a.onclick)}" style="display:flex;gap:10px;padding:8px 10px;border-left:3px solid ${col[a.nivel]};background:#f8fafd;border-radius:0 8px 8px 0;margin-bottom:6px;cursor:pointer">
      <span>${a.icon}</span><div style="min-width:0"><div style="font-size:12px;font-weight:600;color:var(--navy)">${VZ.esc(a.txt)}</div>
      <div class="text-xs text-muted">${VZ.esc(a.sub || '')}</div></div></div>`).join('')}
    ${al.length > 25 ? `<div class="text-xs text-muted">+ ${al.length - 25} más</div>` : ''}</div>`;
}

// ─── Autoevaluación mensual ─────────────────────────────────
function pesvAutosDe(ev) { return PV.autos.filter(a => a.eval_id === ev.id).sort((a, b) => String(a.periodo).localeCompare(String(b.periodo))); }
function pesvGraficoAutos(ev) {
  if (!PV.v2) return VZ.empty('Se activa al ejecutar supabase_pesv_autoevaluacion.sql');
  const a = pesvAutosDe(ev);
  if (!a.length) return VZ.empty('Aún no hay autoevaluaciones registradas. La primera se toma el día 5.');
  return VZ.line(a.map(x => pesvMesNombre(x.periodo).slice(0, 3) + ' ' + String(x.periodo).slice(2, 4)),
    [{ name: '% cumplimiento', values: a.map(x => Number(x.pct)), color: 'blue' }, { name: '% avance', values: a.map(x => Number(x.avance)), color: 'teal' }],
    { unit: '%', meta: 85 });
}
function pesvAutoeval(el, ev) {
  if (!PV.v2) { el.innerHTML = `<div class="glass-card p-4" style="border-left:4px solid var(--amber)"><b>La autoevaluación mensual aún no está activada.</b>
    <div class="text-sm text-muted mt-2">Ejecuta <code>supabase_pesv_autoevaluacion.sql</code> en Supabase → SQL Editor. Programa la foto del cumplimiento el día 5 de cada mes a las 8:00 a. m. y el recordatorio del día 1.</div></div>`; return; }
  const a = pesvAutosDe(ev), ult = a[a.length - 1], prev = a[a.length - 2];
  const g = pesvCalcGlobal(ev), editar = pesvPuedeEditar(), esActual = PV.evals[0]?.id === ev.id;
  const corte = pesvProximoCorte(), per = pesvPeriodoActual();
  const kpis = [
    VZ.kpi({ label: 'Cumplimiento hoy', value: VZ.num(g.pct, 1), unit: '%', icon: '🎯', tone: g.pct >= 85 ? 'green' : g.pct >= 60 ? 'amber' : 'red', sub: 'en vivo, con lo calificado' }),
    VZ.kpi({ label: 'Última autoevaluación', value: ult ? VZ.num(ult.pct, 1) : '—', unit: ult ? '%' : '', icon: '📸', tone: 'blue',
             delta: ult && prev ? VZ.pctVar(Number(ult.pct), Number(prev.pct)) : null, sub: ult ? `${pesvMesNombre(ult.periodo)}${prev ? ' · antes ' + VZ.num(prev.pct, 1) + '%' : ''}` : 'sin registros', trend: a.map(x => Number(x.pct)) }),
    VZ.kpi({ label: 'Próximo corte', value: corte.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }), icon: '🗓', tone: 'purple', sub: '8:00 a. m. · automático' }),
    VZ.kpi({ label: 'Meses registrados', value: VZ.num(a.length), icon: '🗂', tone: 'navy', sub: `evaluación ${ev.anio}` }),
  ].join('');
  const filas = a.slice().reverse().map(x => {
    const r = x.resumen || {}, pf = r.porFase || {};
    return `<tr><td><b>${VZ.esc(pesvMesNombre(x.periodo))}</b></td>
      <td><b style="color:${pesvColorPct(Number(x.pct))}">${VZ.num(x.pct, 1)}%</b><div style="width:90px">${VZ.progress(Number(x.pct))}</div></td>
      <td>${VZ.num(x.avance, 0)}%</td><td>${r.pasosCumplen ?? '—'}/${r.pasosAplican ?? '—'}</td>
      <td>${['P', 'H', 'V', 'A'].map(k => `<span class="vz-chip" style="margin:1px">${k} ${pf[k] ?? '—'}%</span>`).join('')}</td>
      <td>${r.noCumple ?? '—'}</td><td>${r.accVencidas ?? '—'}</td>
      <td><span class="vz-chip ${x.origen === 'automatica' ? 'c-blue' : ''}">${x.origen === 'automatica' ? 'Automática' : x.origen === 'app' ? 'Al ingresar' : 'Manual'}</span></td>
      <td class="text-xs text-muted">${x.created_at ? new Date(x.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : ''}</td></tr>`;
  }).join('');
  el.innerHTML = `
    <div class="info-box mb-3" style="font-size:12px">🤖 <b>Autogestión:</b> el <b>día 5 de cada mes a las 8:00 a. m.</b> el sistema guarda el % de cumplimiento del PESV y avisa por la campana 🔔 a RRHH, HSEQ, Gerencia y Super Admin. El <b>día 1</b> llega un recordatorio para actualizar calificaciones y evidencias. Si la tarea automática no corriera, la foto se registra la primera vez que alguien del PESV entra a partir del día 5.</div>
    <div class="vz-kpis">${kpis}</div>
    <div class="vz-grid">${VZ.panel('Evolución mensual', pesvGraficoAutos(ev), { sub: 'Línea roja: meta interna de 85%', span: 12 })}</div>
    <div class="vz-grid">${VZ.panel('Historial de autoevaluaciones', a.length ? `<div style="overflow-x:auto"><table class="data-table" style="font-size:12px">
      <thead><tr><th>Mes</th><th>Cumplimiento</th><th>Avance</th><th>Pasos</th><th>Por fase</th><th>No cumple</th><th>Acc. vencidas</th><th>Origen</th><th>Registrada</th></tr></thead>
      <tbody>${filas}</tbody></table></div>` : VZ.empty('Todavía no hay meses registrados.'),
      { span: 12, actions: `<div style="display:flex;gap:6px">${a.length ? '<button class="btn btn-ghost btn-sm" onclick="pesvExportarAutos()">⬇️ Exportar</button>' : ''}
        ${editar && esActual ? `<button class="btn btn-primary btn-sm" onclick="pesvRegistrarAutoeval(true)">📸 Registrar ${VZ.esc(pesvMesNombre(per))} ahora</button>` : ''}</div>` })}</div>`;
}
async function pesvRegistrarAutoeval(forzar = false, silencioso = false) {
  const ev = PV.evals[0];
  if (!ev || !pesvPuedeEditar() || !PV.v2) return null;
  if (forzar && !confirm(`¿Registrar ahora la autoevaluación de ${pesvMesNombre(pesvPeriodoActual())}? Reemplaza la foto de este mes si ya existía.`)) return null;
  const g = await pesvGuardar(ev, true);   // guarda el resumen más reciente
  if (g === null) return null;
  const r = await sbFetch('rpc/pesv_autoevaluacion_mensual', 'POST', { p_origen: forzar ? 'manual' : 'app', p_forzar: !!forzar });
  if (r === null) { if (!silencioso) showNotif('No se pudo registrar la autoevaluación', 'error'); return null; }
  const autos = await sbFetch('pesv_autoevaluaciones', 'GET', null, '?select=*&order=periodo.desc');
  if (autos) PV.autos = autos.map(a => ({ ...a, resumen: typeof a.resumen === 'string' ? JSON.parse(a.resumen || '{}') : (a.resumen || {}) }));
  if (r.nueva || forzar) showNotif(`📊 Autoevaluación PESV de ${pesvMesNombre(r.periodo || pesvPeriodoActual())}: ${VZ.num(r.pct, 1)}% de cumplimiento`);
  if (typeof cargarNotificaciones === 'function') cargarNotificaciones();
  if (['autoeval', 'tablero'].includes(PV.tab)) pesvPintarTab();
  return r;
}
// Respaldo de la tarea del día 5: si no hay foto de este mes, se toma al entrar
async function pesvAutoCheck() {
  if (PV.autoCheckHecho || !PV.v2 || !pesvPuedeEditar() || new Date().getDate() < 5) return;
  const ev = PV.evals[0]; if (!ev) return;
  PV.autoCheckHecho = true;
  if (PV.autos.some(a => a.eval_id === ev.id && a.periodo === pesvPeriodoActual())) return;
  await pesvRegistrarAutoeval(false, true);
}
function pesvExportarAutos() {
  const ev = pesvEval(); if (!ev) return;
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const filas = [['Mes', '% cumplimiento', '% avance', 'Pasos que cumplen', 'Pasos que aplican', 'Planear %', 'Hacer %', 'Verificar %', 'Actuar %', 'No cumple', 'Acciones vencidas', 'Origen', 'Registrada'].map(q).join(';')];
  pesvAutosDe(ev).forEach(x => { const r = x.resumen || {}, pf = r.porFase || {};
    filas.push([x.periodo, x.pct, x.avance, r.pasosCumplen, r.pasosAplican, pf.P, pf.H, pf.V, pf.A, r.noCumple, r.accVencidas, x.origen, x.created_at].map(q).join(';')); });
  const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = `PESV_autoevaluaciones_${ev.anio}.csv`;
  document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(el.href), 2000);
}
window.pesvRegistrarAutoeval = pesvRegistrarAutoeval; window.pesvExportarAutos = pesvExportarAutos;
window.PV = PV;
