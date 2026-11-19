// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH · PESV — OPERACIÓN
//   🎓 Capacitaciones PESV (pasos 8 y 10): plan por tema, asistentes,
//      actas, listas de asistencia y evidencias. Se guardan en la tabla
//      capacitaciones de HSEQ con categoria = 'PESV', así que también
//      aparecen en HSEQ; los asistentes quedan en capacitacion_asignaciones.
//   🧪 Pruebas de alcohol y sustancias psicoactivas (paso 8.4) con sus
//      evidencias, y equipos de medición con certificados de calibración.
//      Datos sensibles (Ley 1581): el detalle solo lo ven quienes editan
//      el PESV; Gerencia y Jurídica ven cifras agregadas.
// Requiere supabase_capacitacion_gerencia.sql. Usa sigSubir / sigAbrir /
// sigBorrar / sigNombreSeguro de pesv.js.
// ═══════════════════════════════════════════════════════════════

const PVO_TEMAS = [
  { k: 'velocidad',        t: 'Gestión de la velocidad',                  critico: true,  icon: '🏎️' },
  { k: 'fatiga',           t: 'Prevención de la fatiga',                  critico: true,  icon: '😴' },
  { k: 'distracciones',    t: 'Prevención de distracciones',              critico: true,  icon: '📵' },
  { k: 'alcohol_spa',      t: 'Alcohol y sustancias psicoactivas',        critico: true,  icon: '🚫' },
  { k: 'vulnerables',      t: 'Actores viales vulnerables',               critico: true,  icon: '🚸' },
  { k: 'emergencias',      t: 'Emergencias viales y primer respondiente', critico: false, icon: '🚑' },
  { k: 'preoperacional',   t: 'Inspección preoperacional',                critico: false, icon: '🔧' },
  { k: 'normas',           t: 'Normas de tránsito',                       critico: false, icon: '🚦' },
  { k: 'manejo_defensivo', t: 'Manejo defensivo',                         critico: false, icon: '🛡️' },
  { k: 'siniestros',       t: 'Reporte e investigación de siniestros',    critico: false, icon: '📝' },
  { k: 'politica',         t: 'Política y objetivos del PESV',            critico: false, icon: '🏛' },
  { k: 'otro',             t: 'Otro tema de seguridad vial',              critico: false, icon: '📚' },
];
const PVO_SOPORTES = [
  { k: 'acta',       t: 'Acta',                        icon: '📝' },
  { k: 'asistencia', t: 'Lista de asistencia',         icon: '🖊️' },
  { k: 'evidencia',  t: 'Evidencias (fotos, material)', icon: '📷' },
];
const PVO_MOTIVOS = { aleatoria: 'Aleatoria', preoperacional: 'Preoperacional', sospecha: 'Sospecha razonable', post_siniestro: 'Después de un siniestro', programada: 'Programada' };
const PVO_RES = { negativo: ['Negativo', 'green'], positivo: ['Positivo', 'red'], no_concluyente: ['No concluyente', 'amber'] };
const PVO = { caps: [], pruebas: [], equipos: [], resumen: null, ok: null, anio: new Date().getFullYear(), capT: null, pruT: null, filtroPru: 'todas' };

const pvoTema = k => PVO_TEMAS.find(t => t.k === k) || PVO_TEMAS[PVO_TEMAS.length - 1];
const pvoEmpNombre = id => SC.empleados.find(e => e.id === id)?.name || '';
const pvoHoy = () => new Date().toISOString().slice(0, 10);
const pvoJson = v => { try { const x = typeof v === 'string' ? JSON.parse(v || '[]') : v; return Array.isArray(x) ? x : []; } catch (e) { return []; } };
const pvoFechaCap = c => c.fecha_realizada || c.fecha || '';
const pvoEn30 = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

// ─── Carga ───────────────────────────────────────────────────
async function pvoCargar() {
  const prueba = await sbFetch('capacitaciones', 'GET', null, '?select=pesv_tema&limit=1');
  PVO.ok = prueba !== null;   // false: falta supabase_capacitacion_gerencia.sql (o el de capacitaciones de HSEQ)
  if (!PVO.ok) return;
  const [caps, equipos] = await Promise.all([
    sbFetch('capacitaciones', 'GET', null, '?categoria=eq.PESV&select=*&order=fecha.desc'),
    sbFetch('pesv_equipos', 'GET', null, '?select=*&order=nombre.asc'),
  ]);
  PVO.caps = (caps || []).map(c => ({ ...c, pesv_soportes: pvoJson(c.pesv_soportes) }));
  PVO.equipos = (equipos || []).map(e => ({ ...e, soportes: pvoJson(e.soportes) }));
  if (pesvPuedeEditar()) {
    const pr = await sbFetch('pesv_pruebas', 'GET', null, '?select=*&order=fecha.desc&limit=2000');
    PVO.pruebas = (pr || []).map(p => ({ ...p, soportes: pvoJson(p.soportes) }));
  } else {
    PVO.pruebas = [];   // el detalle es dato sensible de salud: solo editores PESV
    PVO.resumen = await sbFetch('rpc/pesv_resumen_pruebas', 'POST', {});
  }
}
window.pvoCargar = pvoCargar;

function pvoAviso(el) {
  el.innerHTML = `<div class="glass-card p-4" style="border-left:4px solid var(--amber)"><b>Esta sección aún no está activada en la base de datos.</b>
    <div class="text-sm text-muted mt-2">Ejecuta en Supabase → SQL Editor, en este orden: <code>supabase_hseq_capacitaciones.sql</code>, <code>supabase_capacitaciones_v2.sql</code> y <code>supabase_capacitacion_gerencia.sql</code>. Luego vuelve a abrir el PESV.</div></div>`;
}

// ─── Chips en las tarjetas de los 24 pasos ──────────────────
function pvoChipsPaso(n) {
  if (!PVO.ok) return '';
  const anio = String(new Date().getFullYear());
  if (n === 10) return `<span class="vz-chip c-purple">🎓 ${PVO.caps.filter(c => c.estado_ejecucion === 'realizada' && pvoFechaCap(c).startsWith(anio)).length} capacitaciones</span>`;
  if (n === 8) return `<span class="vz-chip c-purple">🧪 ${pesvPuedeEditar() ? PVO.pruebas.filter(p => String(p.fecha).startsWith(anio)).length : (PVO.resumen?.total ?? 0)} pruebas</span>`;
  return '';
}
window.pvoChipsPaso = pvoChipsPaso;

// ─── Alertas para el tablero del PESV ───────────────────────
function pvoAlertas() {
  if (!PVO.ok) return [];
  const hoy = pvoHoy(), en30 = pvoEn30(), out = [], anio = String(new Date().getFullYear());
  PVO.equipos.filter(e => e.estado !== 'fuera_servicio' && e.proxima_calibracion).forEach(e => {
    if (e.proxima_calibracion < hoy) out.push({ nivel: 'alta', icon: '⛔', txt: `Calibración vencida: ${e.nombre}`, sub: `${e.serial ? e.serial + ' · ' : ''}venció el ${e.proxima_calibracion}. No usar hasta recalibrar.`, onclick: "renderPESV('alcohol')" });
    else if (e.proxima_calibracion <= en30) out.push({ nivel: 'media', icon: '📅', txt: `Calibración próxima: ${e.nombre}`, sub: `Vence el ${e.proxima_calibracion}`, onclick: "renderPESV('alcohol')" });
  });
  const sinSop = PVO.pruebas.filter(p => !p.soportes?.length).length;
  if (sinSop) out.push({ nivel: 'media', icon: '📎', txt: `${sinSop} prueba(s) de alcohol o drogas sin evidencia`, sub: 'Carga la foto de la lectura o el formato firmado', onclick: "renderPESV('alcohol')" });
  const realizadas = PVO.caps.filter(c => c.estado_ejecucion === 'realizada');
  const sinActa = realizadas.filter(c => !pvoCompleta(c)).length;
  if (sinActa) out.push({ nivel: 'media', icon: '📝', txt: `${sinActa} capacitación(es) realizada(s) sin acta o lista de asistencia`, sub: 'Paso 10 · soportes de formación', onclick: "renderPESV('capacitacion')" });
  const vencidasProg = PVO.caps.filter(c => c.estado_ejecucion === 'programada' && c.fecha && c.fecha < hoy).length;
  if (vencidasProg) out.push({ nivel: 'alta', icon: '⏰', txt: `${vencidasProg} capacitación(es) programada(s) con fecha pasada`, sub: 'Regístralas como realizadas o reprográmalas', onclick: "renderPESV('capacitacion')" });
  const faltan = PVO_TEMAS.filter(t => t.critico && !realizadas.some(c => c.pesv_tema === t.k && pvoFechaCap(c).startsWith(anio)));
  if (faltan.length) out.push({ nivel: 'media', icon: '🎓', txt: `${faltan.length} tema(s) crítico(s) sin capacitación este año`, sub: faltan.map(t => t.t).join(' · '), onclick: "renderPESV('capacitacion')" });
  return out;
}
window.pvoAlertas = pvoAlertas;

// ═══════════════════════════════════════════════════════════════
// 🎓 CAPACITACIONES PESV
// ═══════════════════════════════════════════════════════════════
const pvoAsistentes = capId => (SC.capAsignaciones || []).filter(a => a.capId === capId && a.estado === 'completada');
const pvoCompleta = c => (c.pesv_soportes || []).some(s => s.tipo === 'acta') && (c.pesv_soportes || []).some(s => s.tipo === 'asistencia');

function pvoCapacitaciones(el) {
  if (!PVO.ok) return pvoAviso(el);
  const editar = pesvPuedeEditar(), anio = String(PVO.anio), hoy = pvoHoy();
  const delAnio = PVO.caps.filter(c => pvoFechaCap(c).startsWith(anio));
  const real = delAnio.filter(c => c.estado_ejecucion === 'realizada');
  const prog = delAnio.filter(c => c.estado_ejecucion === 'programada');
  const plan = real.length + prog.length;
  const asist = new Set(real.flatMap(c => pvoAsistentes(c.id).map(a => a.empId)));
  const horas = real.reduce((s, c) => s + (Number(c.duracion_horas) || 0), 0);
  const completas = real.filter(pvoCompleta).length;
  const criticosOk = PVO_TEMAS.filter(t => t.critico && real.some(c => c.pesv_tema === t.k)).length;
  const kpis = [
    VZ.kpi({ label: 'Cumplimiento del plan', value: plan ? VZ.num(real.length / plan * 100, 0) : '—', unit: plan ? '%' : '', icon: '🎯', tone: plan && real.length / plan >= .9 ? 'green' : 'amber', sub: `${real.length} realizadas de ${plan}` }),
    VZ.kpi({ label: 'Colaboradores capacitados', value: VZ.num(asist.size), icon: '👥', tone: 'blue', sub: `${horas} h de formación` }),
    VZ.kpi({ label: 'Temas críticos cubiertos', value: `${criticosOk}/5`, icon: '🚦', tone: criticosOk === 5 ? 'green' : 'red', sub: 'velocidad, fatiga, distracciones, alcohol, vulnerables' }),
    VZ.kpi({ label: 'Con acta y asistencia', value: real.length ? VZ.num(completas / real.length * 100, 0) : '—', unit: real.length ? '%' : '', icon: '📝', tone: real.length && completas === real.length ? 'green' : 'amber', sub: `${completas} de ${real.length} realizadas` }),
    VZ.kpi({ label: 'Programadas', value: VZ.num(prog.length), icon: '🗓', tone: 'purple', sub: `${prog.filter(c => c.fecha && c.fecha < hoy).length} con fecha pasada` }),
  ].join('');
  const temas = `<div class="vz-heat" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${PVO_TEMAS.filter(t => t.k !== 'otro').map(t => {
    const n = real.filter(c => c.pesv_tema === t.k).length, p = prog.filter(c => c.pesv_tema === t.k).length;
    const bg = n ? '#16a34a' : p ? '#f59e0b' : (t.critico ? '#dc2626' : '#94a3b8');
    return `<div class="vz-heat-cell" style="background:${bg};text-align:left;padding:8px 10px" title="${VZ.esc(t.t)}" ${editar ? `onclick="pvoNuevaCap('${t.k}')"` : ''}>
      ${t.icon} ${VZ.esc(t.t)}<small>${n} realizada(s)${p ? ' · ' + p + ' programada(s)' : ''}${t.critico ? ' · crítico' : ''}</small></div>`;
  }).join('')}</div><div class="vz-legend"><span><i style="background:#16a34a"></i>Con capacitación realizada</span><span><i style="background:#f59e0b"></i>Solo programada</span><span><i style="background:#dc2626"></i>Crítico sin capacitación</span>${editar ? '<span>· Clic en un tema para programar</span>' : ''}</div>`;
  const card = c => {
    const t = pvoTema(c.pesv_tema), sop = c.pesv_soportes || [], nAs = pvoAsistentes(c.id).length;
    const chips = [{ t: `👥 ${nAs}${c.asistentes_objetivo ? '/' + c.asistentes_objetivo : ''}` }];
    if (c.duracion_horas) chips.push({ t: `${c.duracion_horas} h` });
    PVO_SOPORTES.forEach(s => { const k = sop.filter(x => x.tipo === s.k).length; if (k) chips.push({ t: `${s.icon} ${k}`, c: 'blue' }); });
    if (c.estado_ejecucion === 'realizada' && !sop.some(s => s.tipo === 'acta')) chips.push({ t: 'Falta acta', c: 'red' });
    if (c.estado_ejecucion === 'programada' && c.fecha && c.fecha < hoy) chips.push({ t: '⏰ Fecha pasada', c: 'red' });
    return { id: c.id, title: c.titulo, sub: `${t.icon} ${t.t} · ${pvoFechaCap(c) || 'sin fecha'}${c.instructor ? ' · ' + c.instructor : ''}`, chips, onclick: `pvoAbrirCap('${c.id}')` };
  };
  const cols = [
    { key: 'programada', title: 'Programadas', color: 'purple', cards: prog.map(card) },
    { key: 'sin_soportes', title: 'Realizadas · faltan soportes', color: 'amber', cards: real.filter(c => !pvoCompleta(c)).map(card) },
    { key: 'completa', title: 'Con acta y asistencia', color: 'green', cards: real.filter(pvoCompleta).map(card) },
    { key: 'cancelada', title: 'Canceladas', color: 'slate', cards: delAnio.filter(c => c.estado_ejecucion === 'cancelada').map(card) },
  ];
  const meses = VZ.MESES.map((m, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
  const anios = [...new Set([String(new Date().getFullYear()), ...PVO.caps.map(c => pvoFechaCap(c).slice(0, 4)).filter(Boolean)])].sort().reverse();
  el.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
      <div class="text-sm text-muted" style="flex:1;min-width:240px">Plan anual de formación en seguridad vial (paso 10) y programas de riesgos críticos (paso 8). Cada capacitación también aparece en HSEQ.</div>
      <select class="form-select" style="width:auto" onchange="PVO.anio=Number(this.value);renderPESV('capacitacion')">${anios.map(a => `<option ${a === anio ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <button class="btn btn-ghost btn-sm" onclick="pvoExportarCaps()">⬇️ Exportar</button>
      ${editar ? `<button class="btn btn-ghost btn-sm" onclick="pvoAIndicadores()" title="Llena los indicadores de formación del paso 20 con estos datos">📈 Pasar a indicadores</button>
        <button class="btn btn-primary btn-sm" onclick="pvoNuevaCap()">+ Capacitación</button>` : ''}
    </div>
    <div class="vz-kpis">${kpis}</div>
    <div class="vz-grid">${VZ.panel('Cobertura por tema', temas, { sub: `Año ${anio}`, span: 8 })}
      ${VZ.panel('Capacitaciones por mes', VZ.columns(VZ.MESES, [
        { name: 'Realizadas', values: meses.map(m => real.filter(c => pvoFechaCap(c).startsWith(m)).length), color: 'green' },
        { name: 'Programadas', values: meses.map(m => prog.filter(c => pvoFechaCap(c).startsWith(m)).length), color: 'purple' }], { stacked: true, h: 170 }), { span: 4 })}</div>
    ${VZ.kanban(cols, { limit: 40 })}`;
}
window.pvoCapacitaciones = pvoCapacitaciones;

function pvoNuevaCap(tema = '') { if (pesvPuedeEditar()) pvoFormCap({ pesv_tema: tema || 'velocidad', estado_ejecucion: 'programada', pesv_soportes: [] }); }
function pvoAbrirCap(id) { const c = PVO.caps.find(x => x.id === id); if (c) pvoFormCap(c); }
window.pvoNuevaCap = pvoNuevaCap; window.pvoAbrirCap = pvoAbrirCap;

function pvoFormCap(c) {
  const editar = pesvPuedeEditar(), dis = editar ? '' : 'disabled';
  PVO.capT = { asist: new Set(c.id ? pvoAsistentes(c.id).map(a => a.empId) : []) };
  const activos = SC.empleados.filter(e => (e.status || 'activo') !== 'retirado').sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const sop = c.pesv_soportes || [];
  const bloqueSop = s => `<div style="flex:1;min-width:200px;border:1px solid var(--vz-line);border-radius:10px;padding:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b style="font-size:12px">${s.icon} ${s.t}</b>
        ${editar && c.id ? `<input type="file" multiple id="pvo-f-${s.k}" style="display:none" onchange="pvoSubirSoporteCap('${c.id}','${s.k}',this)">
        <button class="btn btn-ghost btn-sm" id="pvo-fb-${s.k}" onclick="document.getElementById('pvo-f-${s.k}').click()">📎 Cargar</button>` : ''}</div>
      <div class="vz-card-meta">${sop.filter(x => x.tipo === s.k).map(f => `<span class="vz-chip c-blue" style="cursor:pointer" onclick="sigAbrir('${VZ.esc(f.ruta)}')">📄 ${VZ.esc(f.nombre)}
        ${editar ? `<b style="margin-left:4px" onclick="event.stopPropagation();pvoQuitarSoporteCap('${c.id}','${VZ.esc(f.id)}')">✕</b>` : ''}</span>`).join('') || '<span class="text-xs text-muted">Sin archivos</span>'}</div></div>`;
  pesvModal(c.id ? `🎓 ${c.titulo}` : '🎓 Nueva capacitación PESV', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Tema PESV</label><select class="form-select" id="pc-tema" ${dis}>${PVO_TEMAS.map(t => `<option value="${t.k}" ${t.k === c.pesv_tema ? 'selected' : ''}>${t.icon} ${t.t}${t.critico ? ' · crítico' : ''}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Estado</label><select class="form-select" id="pc-estado" ${dis}>
        ${[['programada', 'Programada'], ['realizada', 'Realizada'], ['cancelada', 'Cancelada']].map(([k, t]) => `<option value="${k}" ${k === (c.estado_ejecucion || 'programada') ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="form-group"><label class="form-label">Título *</label><input class="form-input" id="pc-titulo" value="${VZ.esc(c.titulo || '')}" ${dis} placeholder="Ej. Taller de manejo defensivo para conductores"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Fecha programada</label><input type="date" class="form-input" id="pc-fecha" value="${VZ.esc(c.fecha || '')}" ${dis}></div>
      <div class="form-group"><label class="form-label">Fecha realizada</label><input type="date" class="form-input" id="pc-freal" value="${VZ.esc(c.fecha_realizada || '')}" ${dis}></div>
      <div class="form-group"><label class="form-label">Duración (horas)</label><input type="number" step="0.5" class="form-input" id="pc-horas" value="${VZ.esc(c.duracion_horas || '')}" ${dis}></div></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Instructor / entidad</label><input class="form-input" id="pc-instr" value="${VZ.esc(c.instructor || '')}" ${dis}></div>
      <div class="form-group"><label class="form-label">Lugar o modalidad</label><input class="form-input" id="pc-lugar" value="${VZ.esc(c.lugar || '')}" ${dis} placeholder="Sede, virtual…"></div>
      <div class="form-group"><label class="form-label">Asistentes esperados</label><input type="number" class="form-input" id="pc-obj" value="${VZ.esc(c.asistentes_objetivo || '')}" ${dis}></div></div>
    <div class="form-group"><label class="form-label">Contenido / observaciones</label><textarea class="form-textarea" id="pc-desc" rows="2" ${dis}>${VZ.esc(c.descripcion || '')}</textarea></div>
    <div class="form-group"><label class="form-label">Asistentes <span class="text-muted" style="font-weight:400" id="pc-nasist">(${PVO.capT.asist.size} seleccionados)</span></label>
      <input class="form-input" placeholder="🔍 Buscar colaborador" oninput="pvoFiltrarAsist(this.value)" style="margin-bottom:6px">
      <div id="pc-asist" style="max-height:180px;overflow:auto;border:1px solid var(--vz-line);border-radius:8px;padding:6px">
        ${activos.map(e => `<label class="pc-as" data-n="${VZ.esc(String(e.name).toLowerCase())}" style="display:flex;gap:8px;align-items:center;font-size:12px;padding:3px 4px">
          <input type="checkbox" ${PVO.capT.asist.has(e.id) ? 'checked' : ''} ${dis} onchange="pvoToggleAsist('${e.id}',this.checked)"> ${VZ.esc(e.name)} <span class="text-muted">· ${VZ.esc(e.cargo || '')}</span></label>`).join('')}
      </div></div>
    <div class="form-group"><label class="form-label">Soportes ${c.id ? '<span class="text-muted" style="font-weight:400">· máx. 10 MB c/u</span>' : '<span class="text-muted" style="font-weight:400">· guarda primero para cargar actas y evidencias</span>'}</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${PVO_SOPORTES.map(bloqueSop).join('')}</div></div>
    ${editar ? `<div class="flex gap-3 mt-2">${c.id ? `<button class="btn btn-danger" onclick="pvoEliminarCap('${c.id}')" title="Eliminar">🗑</button>` : ''}
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-pesv')">Cerrar</button>
      <button class="btn btn-primary" style="flex:1" id="pc-btn" onclick="pvoGuardarCap('${VZ.esc(c.id || '')}')">💾 Guardar</button></div>` : ''}`, 820);
}
function pvoFiltrarAsist(q) { q = String(q || '').toLowerCase(); document.querySelectorAll('#pc-asist .pc-as').forEach(l => { l.style.display = l.dataset.n.includes(q) ? '' : 'none'; }); }
function pvoToggleAsist(id, on) { if (on) PVO.capT.asist.add(id); else PVO.capT.asist.delete(id); const s = document.getElementById('pc-nasist'); if (s) s.textContent = `(${PVO.capT.asist.size} seleccionados)`; }
window.pvoFiltrarAsist = pvoFiltrarAsist; window.pvoToggleAsist = pvoToggleAsist;

async function pvoGuardarCap(id) {
  if (!pesvPuedeEditar()) return;
  const prev = id ? PVO.caps.find(x => x.id === id) : null;
  const titulo = document.getElementById('pc-titulo').value.trim();
  if (!titulo) { showNotif('Escribe el título de la capacitación', 'error'); return; }
  const estado = document.getElementById('pc-estado').value;
  let freal = document.getElementById('pc-freal').value;
  if (estado === 'realizada' && !freal) freal = document.getElementById('pc-fecha').value || pvoHoy();
  const fila = {
    id: prev?.id || 'cp' + Date.now(), titulo, tipo: 'capacitacion', categoria: 'PESV',
    descripcion: document.getElementById('pc-desc').value.trim(), area_id: null, cargo: '', obligatoria: true,
    duracion_horas: Number(document.getElementById('pc-horas').value) || 0, vigencia_meses: 0,
    fecha: document.getElementById('pc-fecha').value || freal || '', instructor: document.getElementById('pc-instr').value.trim(),
    creado_por: prev?.creado_por || SC.user?.name || '', activo: true,
    pesv_tema: document.getElementById('pc-tema').value, estado_ejecucion: estado, fecha_realizada: estado === 'realizada' ? freal : '',
    lugar: document.getElementById('pc-lugar').value.trim(), asistentes_objetivo: Number(document.getElementById('pc-obj').value) || 0,
    pesv_soportes: prev?.pesv_soportes || [],
  };
  const btn = document.getElementById('pc-btn'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }
  const r = await sbFetch('capacitaciones', 'POST', fila, '', { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
  if (r === null) { if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; } return; }
  if (prev) Object.assign(prev, fila); else PVO.caps.unshift(fila);
  // Mantener sincronizado el catálogo de HSEQ
  if (typeof dbToCapacitacion === 'function') {
    const conv = dbToCapacitacion(fila), i = (SC.capacitaciones || []).findIndex(x => x.id === fila.id);
    if (i >= 0) SC.capacitaciones[i] = conv; else (SC.capacitaciones = SC.capacitaciones || []).push(conv);
  }
  // Asistentes → capacitacion_asignaciones con estado 'completada'
  const actuales = pvoAsistentes(fila.id), quiero = PVO.capT?.asist || new Set();
  for (const empId of quiero) {
    const ya = (SC.capAsignaciones || []).find(a => a.capId === fila.id && a.empId === empId);
    const a = ya || { id: 'ca' + Date.now() + Math.random().toString(36).slice(2, 6), capId: fila.id, empId, fechaAsignacion: pvoHoy(), asignadoPor: SC.user?.name || '' };
    a.estado = 'completada'; a.fechaCompletado = fila.fecha_realizada || a.fechaCompletado || '';
    if (!ya) (SC.capAsignaciones = SC.capAsignaciones || []).push(a);
    if (typeof sbSaveCapAsignacion === 'function') await sbSaveCapAsignacion(a);
  }
  for (const a of actuales.filter(a => !quiero.has(a.empId))) {
    await sbFetch('capacitacion_asignaciones', 'DELETE', null, `?id=eq.${encodeURIComponent(a.id)}`);
    SC.capAsignaciones = SC.capAsignaciones.filter(x => x.id !== a.id);
  }
  if (typeof registrarAuditoria === 'function') registrarAuditoria(prev ? 'editar' : 'crear', 'pesv_capacitacion', fila.id, `${titulo} · ${estado}`);
  showNotif(prev ? '✅ Capacitación actualizada' : '🎓 Capacitación registrada · ahora puedes cargar actas y evidencias');
  if (!prev) pvoFormCap(fila); else closeModal('modal-pesv');
  if (PV.tab === 'capacitacion') pesvPintarTab();
}
window.pvoGuardarCap = pvoGuardarCap;

async function pvoSubirSoporteCap(capId, tipo, input) {
  const c = PVO.caps.find(x => x.id === capId); if (!c || !pesvPuedeEditar()) return;
  const files = Array.from(input?.files || []); if (input) input.value = '';
  const grandes = files.filter(f => f.size > PESV_MAX_BYTES);
  if (grandes.length) showNotif(`⛔ Superan 10 MB: ${grandes.map(f => f.name).join(', ')}`, 'error');
  const validos = files.filter(f => f.size > 0 && f.size <= PESV_MAX_BYTES);
  if (!validos.length) return;
  const btn = document.getElementById('pvo-fb-' + tipo); let ok = 0;
  for (let i = 0; i < validos.length; i++) {
    const f = validos[i];
    if (btn) { btn.disabled = true; btn.textContent = `⏳ ${i + 1}/${validos.length}`; }
    try {
      const ruta = `pesv/capacitaciones/${sigNombreSeguro(capId)}/${tipo}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${sigNombreSeguro(f.name)}`;
      await sigSubir(ruta, f);
      c.pesv_soportes.push({ id: 'cs' + Date.now() + i, tipo, nombre: f.name, ruta, tamano: f.size, por: SC.user?.name || '', fecha: new Date().toISOString() });
      ok++;
    } catch (e) { showNotif(`⚠️ ${f.name}: ${e.message}`, 'error'); }
  }
  if (ok) {
    await sbFetch('capacitaciones', 'PATCH', { pesv_soportes: c.pesv_soportes }, `?id=eq.${encodeURIComponent(capId)}`);
    showNotif(`📎 ${ok} archivo(s) cargado(s)`);
  }
  pvoFormCap(c); if (PV.tab === 'capacitacion') pesvPintarTab();
}
async function pvoQuitarSoporteCap(capId, sid) {
  const c = PVO.caps.find(x => x.id === capId); const f = c?.pesv_soportes.find(x => x.id === sid);
  if (!f || !pesvPuedeEditar() || !confirm(`¿Quitar "${f.nombre}"?`)) return;
  try { await sigBorrar(f.ruta); } catch (e) { showNotif('No se pudo borrar el archivo: ' + e.message, 'error'); return; }
  c.pesv_soportes = c.pesv_soportes.filter(x => x.id !== sid);
  await sbFetch('capacitaciones', 'PATCH', { pesv_soportes: c.pesv_soportes }, `?id=eq.${encodeURIComponent(capId)}`);
  pvoFormCap(c); if (PV.tab === 'capacitacion') pesvPintarTab();
}
async function pvoEliminarCap(id) {
  const c = PVO.caps.find(x => x.id === id);
  if (!c || !pesvPuedeEditar() || !confirm(`¿Eliminar "${c.titulo}" con sus asistentes y soportes?`)) return;
  const r = await sbFetch('capacitaciones', 'DELETE', null, `?id=eq.${encodeURIComponent(id)}`);
  if (r === null) return;
  await sbFetch('capacitacion_asignaciones', 'DELETE', null, `?capacitacion_id=eq.${encodeURIComponent(id)}`);
  (c.pesv_soportes || []).forEach(s => sigBorrar(s.ruta).catch(() => {}));
  PVO.caps = PVO.caps.filter(x => x.id !== id);
  SC.capacitaciones = (SC.capacitaciones || []).filter(x => x.id !== id);
  SC.capAsignaciones = (SC.capAsignaciones || []).filter(x => x.capId !== id);
  closeModal('modal-pesv'); pesvPintarTab();
}
window.pvoSubirSoporteCap = pvoSubirSoporteCap; window.pvoQuitarSoporteCap = pvoQuitarSoporteCap; window.pvoEliminarCap = pvoEliminarCap;

// Llena los indicadores de formación del paso 20 (cumplimiento y cobertura) del trimestre actual
function pvoAIndicadores() {
  const ev = PV.evals[0]; if (!ev || !pesvPuedeEditar()) return;
  const d = new Date(), q = Math.floor(d.getMonth() / 3), anio = String(d.getFullYear());
  const desde = `${anio}-${String(q * 3 + 1).padStart(2, '0')}-01`, hasta = `${anio}-${String(q * 3 + 3).padStart(2, '0')}-31`;
  const enQ = PVO.caps.filter(c => { const f = pvoFechaCap(c); return f >= desde && f <= hasta && c.estado_ejecucion !== 'cancelada'; });
  const real = enQ.filter(c => c.estado_ejecucion === 'realizada');
  const capacitados = new Set(real.flatMap(c => pvoAsistentes(c.id).map(a => a.empId))).size;
  const objetivo = real.reduce((s, c) => s + (Number(c.asistentes_objetivo) || 0), 0) || SC.empleados.filter(e => (e.status || 'activo') !== 'retirado').length;
  const T = 'T' + (q + 1);
  if (!confirm(`Trimestre ${q + 1}: ${real.length} de ${enQ.length} capacitaciones realizadas y ${capacitados} colaboradores capacitados de ${objetivo}.\n\n¿Pasar estos valores a los indicadores de formación del paso 20?`)) return;
  ev.indicadores = ev.indicadores || {};
  ev.indicadores.cpfsv = { ...(ev.indicadores.cpfsv || {}), [T]: { num: real.length, den: enQ.length } };
  ev.indicadores.cfsv  = { ...(ev.indicadores.cfsv || {}),  [T]: { num: capacitados, den: objetivo } };
  pesvGuardar(ev, true).then(() => { showNotif(`📈 Indicadores de formación del trimestre ${q + 1} actualizados`); renderPESV('indicadores'); });
}
window.pvoAIndicadores = pvoAIndicadores;

function pvoDescargar(filas, nombre) {
  const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function pvoExportarCaps() {
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const filas = [['Fecha', 'Tema', 'Título', 'Estado', 'Horas', 'Instructor', 'Lugar', 'Asistentes', 'Esperados', 'Actas', 'Listas de asistencia', 'Evidencias', 'Nombres de asistentes'].map(q).join(';')];
  PVO.caps.forEach(c => { const as = pvoAsistentes(c.id), n = t => (c.pesv_soportes || []).filter(s => s.tipo === t).length;
    filas.push([pvoFechaCap(c), pvoTema(c.pesv_tema).t, c.titulo, c.estado_ejecucion, c.duracion_horas, c.instructor, c.lugar, as.length, c.asistentes_objetivo, n('acta'), n('asistencia'), n('evidencia'), as.map(a => pvoEmpNombre(a.empId)).join(' | ')].map(q).join(';')); });
  pvoDescargar(filas, `PESV_capacitaciones_${PVO.anio}.csv`);
}
window.pvoExportarCaps = pvoExportarCaps;

// ═══════════════════════════════════════════════════════════════
// 🧪 PRUEBAS DE ALCOHOL Y DROGAS · EQUIPOS Y CALIBRACIÓN
// ═══════════════════════════════════════════════════════════════
function pvoEstadoCal(e) {
  if (e.estado === 'fuera_servicio') return { t: 'Fuera de servicio', c: 'slate' };
  if (!e.proxima_calibracion) return { t: 'Sin calibración registrada', c: 'amber' };
  if (e.proxima_calibracion < pvoHoy()) return { t: 'Calibración vencida', c: 'red' };
  if (e.proxima_calibracion <= pvoEn30()) return { t: 'Vence pronto', c: 'amber' };
  return { t: 'Calibración vigente', c: 'green' };
}

function pvoAlcohol(el) {
  if (!PVO.ok) return pvoAviso(el);
  const editar = pesvPuedeEditar(), meses = VZ.ultimosMeses(12);
  let tot, alc, dro, pos, nc, conSop, porMes;
  if (editar) {
    const desde = meses[0].key + '-01', pr = PVO.pruebas.filter(p => String(p.fecha) >= desde);
    tot = pr.length; alc = pr.filter(p => p.tipo === 'alcohol').length; dro = pr.filter(p => p.tipo === 'drogas').length;
    pos = pr.filter(p => p.resultado === 'positivo').length; nc = pr.filter(p => p.resultado === 'no_concluyente').length;
    conSop = pr.filter(p => p.soportes?.length).length;
    porMes = { alc: meses.map(m => pr.filter(p => p.tipo === 'alcohol' && String(p.fecha).startsWith(m.key)).length),
               dro: meses.map(m => pr.filter(p => p.tipo === 'drogas' && String(p.fecha).startsWith(m.key)).length) };
  } else {
    const r = PVO.resumen || {};
    tot = r.total || 0; alc = r.alcohol || 0; dro = r.drogas || 0; pos = r.positivas || 0; nc = r.no_concluyentes || 0; conSop = r.con_soporte || 0;
    porMes = { alc: meses.map(m => (r.por_mes || {})[m.key] || 0), dro: null };
  }
  const eqVenc = PVO.equipos.filter(e => pvoEstadoCal(e).c === 'red').length;
  const kpis = [
    VZ.kpi({ label: 'Pruebas · 12 meses', value: VZ.num(tot), icon: '🧪', tone: 'navy', sub: `${alc} alcohol · ${dro} drogas`, trend: porMes.dro ? porMes.alc.map((v, i) => v + porMes.dro[i]) : porMes.alc }),
    VZ.kpi({ label: 'Resultados positivos', value: VZ.num(pos), icon: '⚠️', tone: pos ? 'red' : 'green', sub: tot ? `${VZ.num(pos / tot * 100, 1)}% de las pruebas` : 'sin pruebas' }),
    VZ.kpi({ label: 'No concluyentes', value: VZ.num(nc), icon: '❔', tone: nc ? 'amber' : 'green' }),
    VZ.kpi({ label: 'Con evidencia', value: tot ? VZ.num(conSop / tot * 100, 0) : '—', unit: tot ? '%' : '', icon: '📎', tone: tot && conSop === tot ? 'green' : 'amber', sub: `${conSop} de ${tot}` }),
    VZ.kpi({ label: 'Equipos de medición', value: VZ.num(PVO.equipos.length), icon: '🔬', tone: eqVenc ? 'red' : 'teal', sub: eqVenc ? `${eqVenc} con calibración vencida` : 'calibraciones al día' }),
  ].join('');
  const grafico = VZ.columns(meses.map(m => m.label), porMes.dro
    ? [{ name: 'Alcohol', values: porMes.alc, color: 'blue' }, { name: 'Drogas', values: porMes.dro, color: 'purple' }]
    : [{ name: 'Pruebas', values: porMes.alc, color: 'blue' }], { stacked: true, h: 180 });
  const equipos = PVO.equipos.length ? `<div class="vz-doc-grid">${PVO.equipos.map(e => {
    const s = pvoEstadoCal(e), certs = e.soportes || [];
    return `<div class="vz-doc" style="--doc-c:${VZ.color(s.c)}"><div class="vz-doc-ico">🔬</div><div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:13px;color:var(--navy)">${VZ.esc(e.nombre)}</div>
      <div class="text-xs text-muted">${VZ.esc([e.marca, e.serial && 'S/N ' + e.serial, e.tipo === 'kit_drogas' ? 'Kit de drogas' : e.tipo === 'alcohosensor' ? 'Alcohosensor' : 'Otro'].filter(Boolean).join(' · '))}</div>
      <div class="vz-card-meta"><span class="vz-chip ${s.c === 'slate' ? '' : 'c-' + s.c}">${s.t}</span>
        ${e.fecha_calibracion ? `<span class="vz-chip">Calibrado ${VZ.esc(e.fecha_calibracion)}</span>` : ''}
        ${e.proxima_calibracion ? `<span class="vz-chip">Próxima ${VZ.esc(e.proxima_calibracion)}</span>` : ''}</div>
      <div class="vz-card-meta">${certs.slice(-3).reverse().map(f => `<span class="vz-chip c-blue" style="cursor:pointer" onclick="sigAbrir('${VZ.esc(f.ruta)}')">📄 ${VZ.esc(f.nombre)}</span>`).join('') || '<span class="text-xs text-muted">Sin certificados cargados</span>'}
        ${certs.length > 3 ? `<span class="text-xs text-muted">+${certs.length - 3} anteriores</span>` : ''}</div>
      ${editar ? `<div class="vz-card-actions" style="justify-content:flex-start"><button class="btn btn-ghost btn-sm" onclick="pvoCalibrar('${e.id}')">📎 Registrar calibración</button>
        <button class="btn btn-ghost btn-sm" onclick="pvoFormEquipo('${e.id}')" title="Editar">✏️</button></div>` : ''}
    </div></div>`;
  }).join('')}</div>` : VZ.empty(editar ? 'Registra tus alcohosensores y kits con "+ Equipo".' : 'No hay equipos registrados.');
  let tabla = '';
  if (editar) {
    const filtro = PVO.filtroPru || 'todas';
    const lista = PVO.pruebas.filter(p => filtro === 'todas' || p.tipo === filtro || p.resultado === filtro).slice(0, 300);
    tabla = VZ.panel('Registro de pruebas', `
      <div class="vz-pills mb-3">${[['todas', 'Todas'], ['alcohol', 'Alcohol'], ['drogas', 'Drogas'], ['positivo', 'Positivas'], ['no_concluyente', 'No concluyentes']].map(([k, t]) =>
        `<button class="vz-pill ${filtro === k ? 'on' : ''}" onclick="PVO.filtroPru='${k}';renderPESV('alcohol')">${t}</button>`).join('')}</div>
      ${lista.length ? `<div style="overflow-x:auto"><table class="data-table" style="font-size:12px"><thead><tr><th>Fecha</th><th>Tipo</th><th>Persona</th><th>Resultado</th><th>Lectura</th><th>Equipo</th><th>Motivo</th><th>Evidencias</th><th></th></tr></thead><tbody>
      ${lista.map(p => { const [rt, rc] = PVO_RES[p.resultado] || ['—', '']; const eq = PVO.equipos.find(e => e.id === p.equipo_id);
        return `<tr><td>${VZ.esc(p.fecha)} ${VZ.esc(p.hora || '')}</td><td>${p.tipo === 'alcohol' ? '🍺 Alcohol' : '💊 Drogas'}</td>
          <td>${VZ.esc(pvoEmpNombre(p.emp_id) || p.persona || '—')}</td><td><span class="vz-chip c-${rc}">${rt}</span></td><td>${VZ.esc(p.valor || '')}</td>
          <td>${VZ.esc(eq?.nombre || '—')}</td><td>${VZ.esc(PVO_MOTIVOS[p.motivo] || p.motivo || '')}</td>
          <td>${p.soportes?.length ? p.soportes.map(f => `<span class="vz-chip c-blue" style="cursor:pointer" title="${VZ.esc(f.nombre)}" onclick="sigAbrir('${VZ.esc(f.ruta)}')">📄</span>`).join(' ') : '<span class="vz-chip c-amber">Sin evidencia</span>'}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="pvoFormPrueba('${p.id}')" title="Editar">✏️</button></td></tr>`; }).join('')}</tbody></table></div>`
        : VZ.empty('No hay pruebas registradas con este filtro.')}`, { span: 12, actions: `<button class="btn btn-ghost btn-sm" onclick="pvoExportarPruebas()">⬇️ Exportar</button>` });
  }
  el.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
      <div class="text-sm text-muted" style="flex:1;min-width:240px">Programa de cero tolerancia al alcohol y sustancias psicoactivas (paso 8.4). ${editar ? 'Los resultados son datos sensibles: solo los ven quienes gestionan el PESV.' : 'Por privacidad, aquí solo se muestran cifras agregadas.'}</div>
      ${editar ? `<button class="btn btn-ghost btn-sm" onclick="pvoFormEquipo()">+ Equipo</button><button class="btn btn-primary btn-sm" onclick="pvoFormPrueba()">+ Registrar prueba</button>` : ''}
    </div>
    <div class="vz-kpis">${kpis}</div>
    <div class="vz-grid">${VZ.panel('Pruebas por mes', grafico, { sub: 'Últimos 12 meses', span: 7 })}
      ${VZ.panel('Resultados', VZ.donut([{ label: 'Negativos', value: Math.max(0, tot - pos - nc), color: 'green' }, { label: 'Positivos', value: pos, color: 'red' }, { label: 'No concluyentes', value: nc, color: 'amber' }], { centerSub: 'pruebas' }), { span: 5 })}</div>
    <div class="vz-grid">${VZ.panel('🔬 Equipos de medición y calibración', equipos, { sub: 'Certificados de calibración por equipo', span: 12 })}</div>
    ${tabla ? `<div class="vz-grid">${tabla}</div>` : ''}`;
}
window.pvoAlcohol = pvoAlcohol;

function pvoFormPrueba(id) {
  if (!pesvPuedeEditar()) return;
  const p = id ? PVO.pruebas.find(x => x.id === id) : { fecha: pvoHoy(), tipo: 'alcohol', resultado: 'negativo', motivo: 'aleatoria', soportes: [] };
  if (!p) return;
  PVO.pruT = { id: p.id || null, soportes: (p.soportes || []).slice() };
  const activos = SC.empleados.filter(e => (e.status || 'activo') !== 'retirado').sort((a, b) => String(a.name).localeCompare(String(b.name)));
  pesvModal(id ? '🧪 Editar prueba' : '🧪 Registrar prueba de alcohol o drogas', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Fecha *</label><input type="date" class="form-input" id="pp-fecha" value="${VZ.esc(p.fecha || '')}"></div>
      <div class="form-group"><label class="form-label">Hora</label><input type="time" class="form-input" id="pp-hora" value="${VZ.esc(p.hora || '')}"></div>
      <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="pp-tipo"><option value="alcohol" ${p.tipo === 'alcohol' ? 'selected' : ''}>🍺 Alcohol</option><option value="drogas" ${p.tipo === 'drogas' ? 'selected' : ''}>💊 Sustancias psicoactivas</option></select></div></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Colaborador</label><select class="form-select" id="pp-emp"><option value="">— Persona externa —</option>
        ${activos.map(e => `<option value="${e.id}" ${e.id === p.emp_id ? 'selected' : ''}>${VZ.esc(e.name)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Persona externa (contratista, visitante)</label><input class="form-input" id="pp-persona" value="${VZ.esc(p.persona || '')}"></div></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Resultado</label><select class="form-select" id="pp-res">${Object.entries(PVO_RES).map(([k, [t]]) => `<option value="${k}" ${k === p.resultado ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Lectura del equipo</label><input class="form-input" id="pp-valor" value="${VZ.esc(p.valor || '')}" placeholder="0.00 mg/L"></div>
      <div class="form-group"><label class="form-label">Motivo</label><select class="form-select" id="pp-motivo">${Object.entries(PVO_MOTIVOS).map(([k, t]) => `<option value="${k}" ${k === p.motivo ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Equipo usado</label><select class="form-select" id="pp-equipo" onchange="pvoAvisoEquipo(this.value)"><option value="">—</option>
        ${PVO.equipos.filter(e => e.estado !== 'fuera_servicio' || e.id === p.equipo_id).map(e => `<option value="${e.id}" ${e.id === p.equipo_id ? 'selected' : ''}>${VZ.esc(e.nombre)}${e.serial ? ' · ' + VZ.esc(e.serial) : ''} (${pvoEstadoCal(e).t})</option>`).join('')}</select>
        <div class="text-xs" id="pp-eq-aviso" style="color:#b91c1c;margin-top:4px"></div></div>
      <div class="form-group"><label class="form-label">Realizada por</label><input class="form-input" id="pp-por" value="${VZ.esc(p.realizada_por || SC.user?.name || '')}"></div>
      <div class="form-group"><label class="form-label">Lugar</label><input class="form-input" id="pp-lugar" value="${VZ.esc(p.lugar || '')}"></div></div>
    <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-textarea" id="pp-obs" rows="2">${VZ.esc(p.observaciones || '')}</textarea></div>
    <div class="form-group"><label class="form-label">Evidencias <span class="text-muted" style="font-weight:400">(foto de la lectura, formato firmado, consentimiento · máx. 10 MB c/u)</span></label>
      <input type="file" multiple class="form-input" id="pp-files" accept=".pdf,.jpg,.jpeg,.png,.heic">
      <div class="vz-card-meta">${(p.soportes || []).map(f => `<span class="vz-chip c-blue" style="cursor:pointer" onclick="sigAbrir('${VZ.esc(f.ruta)}')">📄 ${VZ.esc(f.nombre)}</span>`).join('')}</div></div>
    <div class="flex gap-3 mt-2">${id ? `<button class="btn btn-danger" onclick="pvoEliminarPrueba('${id}')" title="Eliminar">🗑</button>` : ''}
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-pesv')">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" id="pp-btn" onclick="pvoGuardarPrueba()">💾 Guardar</button></div>`, 720);
  pvoAvisoEquipo(p.equipo_id || '');
}
function pvoAvisoEquipo(eqId) {
  const e = PVO.equipos.find(x => x.id === eqId), el = document.getElementById('pp-eq-aviso');
  if (el) el.textContent = e && pvoEstadoCal(e).c === 'red' ? '⚠️ Este equipo tiene la calibración vencida: la prueba podría no ser válida.' : '';
}
window.pvoFormPrueba = pvoFormPrueba; window.pvoAvisoEquipo = pvoAvisoEquipo;

async function pvoGuardarPrueba() {
  if (!pesvPuedeEditar()) return;
  const fecha = document.getElementById('pp-fecha').value;
  const empId = document.getElementById('pp-emp').value, persona = document.getElementById('pp-persona').value.trim();
  if (!fecha) { showNotif('Indica la fecha de la prueba', 'error'); return; }
  if (!empId && !persona) { showNotif('Elige el colaborador o escribe el nombre de la persona externa', 'error'); return; }
  const files = Array.from(document.getElementById('pp-files').files || []);
  const grandes = files.filter(f => f.size > PESV_MAX_BYTES);
  if (grandes.length) { showNotif(`⛔ Superan 10 MB: ${grandes.map(f => f.name).join(', ')}`, 'error'); return; }
  const id = PVO.pruT.id || 'pr' + Date.now();
  const btn = document.getElementById('pp-btn'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }
  const soportes = PVO.pruT.soportes.slice();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const ruta = `pesv/pruebas/${sigNombreSeguro(id)}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${sigNombreSeguro(f.name)}`;
      await sigSubir(ruta, f);
      soportes.push({ id: 'ps' + Date.now() + i, nombre: f.name, ruta, tamano: f.size, por: SC.user?.name || '', fecha: new Date().toISOString() });
    } catch (e) { showNotif(`⚠️ ${f.name}: ${e.message}`, 'error'); }
  }
  const prev = PVO.pruebas.find(x => x.id === id);
  const fila = { id, fecha, hora: document.getElementById('pp-hora').value, tipo: document.getElementById('pp-tipo').value,
    emp_id: empId || null, persona: empId ? '' : persona, resultado: document.getElementById('pp-res').value,
    valor: document.getElementById('pp-valor').value.trim(), equipo_id: document.getElementById('pp-equipo').value || null,
    motivo: document.getElementById('pp-motivo').value, lugar: document.getElementById('pp-lugar').value.trim(),
    realizada_por: document.getElementById('pp-por').value.trim(), observaciones: document.getElementById('pp-obs').value.trim(),
    soportes, registrada_por: prev?.registrada_por || SC.user?.name || '' };
  const r = await sbFetch('pesv_pruebas', 'POST', fila, '', { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
  if (r === null) { if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; } return; }
  if (prev) Object.assign(prev, fila); else PVO.pruebas.unshift(fila);
  PVO.pruebas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  if (typeof registrarAuditoria === 'function') registrarAuditoria(prev ? 'editar' : 'registrar', 'pesv_prueba', id, `${fila.tipo} · ${fila.fecha}`);
  // Aviso sin datos personales cuando el resultado no es negativo
  if (!prev && fila.resultado !== 'negativo' && typeof crearNotificacion === 'function') {
    ['hseq', 'rrhh'].forEach(d => crearNotificacion({ rol: d }, { titulo: `🧪 Prueba de ${fila.tipo} con resultado ${PVO_RES[fila.resultado][0].toLowerCase()}`,
      mensaje: `Registrada el ${fila.fecha}. Revisa el caso en PESV → Alcohol y drogas.`, tipo: 'alerta', refTabla: 'pesv', vista: 'pesv' }));
  }
  showNotif(prev ? '✅ Prueba actualizada' : `🧪 Prueba registrada${soportes.length ? ' con ' + soportes.length + ' evidencia(s)' : ''}`);
  closeModal('modal-pesv'); pesvPintarTab();
}
async function pvoEliminarPrueba(id) {
  const p = PVO.pruebas.find(x => x.id === id);
  if (!p || !pesvPuedeEditar() || !confirm('¿Eliminar esta prueba y sus evidencias?')) return;
  const r = await sbFetch('pesv_pruebas', 'DELETE', null, `?id=eq.${encodeURIComponent(id)}`);
  if (r === null) return;
  (p.soportes || []).forEach(s => sigBorrar(s.ruta).catch(() => {}));
  PVO.pruebas = PVO.pruebas.filter(x => x.id !== id);
  closeModal('modal-pesv'); pesvPintarTab();
}
window.pvoGuardarPrueba = pvoGuardarPrueba; window.pvoEliminarPrueba = pvoEliminarPrueba;

function pvoExportarPruebas() {
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const filas = [['Fecha', 'Hora', 'Tipo', 'Persona', 'Cédula', 'Resultado', 'Lectura', 'Equipo', 'Serial', 'Motivo', 'Lugar', 'Realizada por', 'Evidencias', 'Observaciones'].map(q).join(';')];
  PVO.pruebas.forEach(p => { const e = SC.empleados.find(x => x.id === p.emp_id), eq = PVO.equipos.find(x => x.id === p.equipo_id);
    filas.push([p.fecha, p.hora, p.tipo, e?.name || p.persona, e?.cedula || '', (PVO_RES[p.resultado] || [p.resultado])[0], p.valor, eq?.nombre, eq?.serial, PVO_MOTIVOS[p.motivo] || p.motivo, p.lugar, p.realizada_por, (p.soportes || []).length, p.observaciones].map(q).join(';')); });
  pvoDescargar(filas, `PESV_pruebas_alcohol_drogas_${pvoHoy()}.csv`);
}
window.pvoExportarPruebas = pvoExportarPruebas;

// ─── Equipos ────────────────────────────────────────────────
function pvoFormEquipo(id) {
  if (!pesvPuedeEditar()) return;
  const e = id ? PVO.equipos.find(x => x.id === id) : { tipo: 'alcohosensor', estado: 'operativo' };
  if (!e) return;
  pesvModal(id ? '🔬 Editar equipo' : '🔬 Nuevo equipo de medición', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="pe-nombre" value="${VZ.esc(e.nombre || '')}" placeholder="Alcohosensor sede principal"></div>
      <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="pe-tipo">${[['alcohosensor', 'Alcohosensor'], ['kit_drogas', 'Kit de drogas'], ['otro', 'Otro']].map(([k, t]) => `<option value="${k}" ${k === e.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Marca / modelo</label><input class="form-input" id="pe-marca" value="${VZ.esc(e.marca || '')}"></div>
      <div class="form-group"><label class="form-label">Serial</label><input class="form-input" id="pe-serial" value="${VZ.esc(e.serial || '')}"></div>
      <div class="form-group"><label class="form-label">Proveedor de calibración</label><input class="form-input" id="pe-prov" value="${VZ.esc(e.proveedor || '')}"></div></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Última calibración</label><input type="date" class="form-input" id="pe-fcal" value="${VZ.esc(e.fecha_calibracion || '')}"></div>
      <div class="form-group"><label class="form-label">Próxima calibración</label><input type="date" class="form-input" id="pe-prox" value="${VZ.esc(e.proxima_calibracion || '')}"></div>
      <div class="form-group"><label class="form-label">Estado</label><select class="form-select" id="pe-estado">${[['operativo', 'Operativo'], ['en_calibracion', 'En calibración'], ['fuera_servicio', 'Fuera de servicio']].map(([k, t]) => `<option value="${k}" ${k === e.estado ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-textarea" id="pe-obs" rows="2">${VZ.esc(e.observaciones || '')}</textarea></div>
    <div class="flex gap-3 mt-2">${id ? `<button class="btn btn-danger" onclick="pvoEliminarEquipo('${id}')" title="Eliminar">🗑</button>` : ''}
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-pesv')">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" onclick="pvoGuardarEquipo('${VZ.esc(id || '')}')">💾 Guardar</button></div>`, 700);
}
async function pvoGuardarEquipo(id) {
  if (!pesvPuedeEditar()) return;
  const nombre = document.getElementById('pe-nombre').value.trim();
  if (!nombre) { showNotif('Escribe el nombre del equipo', 'error'); return; }
  const prev = id ? PVO.equipos.find(x => x.id === id) : null;
  const fila = { id: prev?.id || 'eq' + Date.now(), nombre, tipo: document.getElementById('pe-tipo').value, marca: document.getElementById('pe-marca').value.trim(),
    serial: document.getElementById('pe-serial').value.trim(), proveedor: document.getElementById('pe-prov').value.trim(),
    fecha_calibracion: document.getElementById('pe-fcal').value || null, proxima_calibracion: document.getElementById('pe-prox').value || null,
    estado: document.getElementById('pe-estado').value, observaciones: document.getElementById('pe-obs').value.trim(),
    soportes: prev?.soportes || [], updated_at: new Date().toISOString() };
  const r = await sbFetch('pesv_equipos', 'POST', fila, '', { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
  if (r === null) return;
  if (prev) Object.assign(prev, fila); else PVO.equipos.push(fila);
  showNotif(prev ? '✅ Equipo actualizado' : '🔬 Equipo registrado');
  closeModal('modal-pesv'); pesvPintarTab();
}
async function pvoEliminarEquipo(id) {
  const e = PVO.equipos.find(x => x.id === id);
  if (!e || !pesvPuedeEditar() || !confirm(`¿Eliminar el equipo "${e.nombre}"? Si dejó de usarse, mejor márcalo "Fuera de servicio" para conservar su historial.`)) return;
  const r = await sbFetch('pesv_equipos', 'DELETE', null, `?id=eq.${encodeURIComponent(id)}`);
  if (r === null) return;
  PVO.equipos = PVO.equipos.filter(x => x.id !== id);
  closeModal('modal-pesv'); pesvPintarTab();
}
window.pvoFormEquipo = pvoFormEquipo; window.pvoGuardarEquipo = pvoGuardarEquipo; window.pvoEliminarEquipo = pvoEliminarEquipo;

// Registrar una calibración: certificado + fechas (queda el historial de certificados)
function pvoCalibrar(id) {
  const e = PVO.equipos.find(x => x.id === id); if (!e || !pesvPuedeEditar()) return;
  const unAnio = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  pesvModal(`📎 Calibración · ${e.nombre}`, `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Fecha de calibración</label><input type="date" class="form-input" id="pk-fecha" value="${pvoHoy()}"></div>
      <div class="form-group"><label class="form-label">Próxima calibración</label><input type="date" class="form-input" id="pk-prox" value="${unAnio}"></div></div>
    <div class="form-group"><label class="form-label">Certificado de calibración * <span class="text-muted" style="font-weight:400">· máx. 10 MB</span></label><input type="file" class="form-input" id="pk-file" accept=".pdf,.jpg,.jpeg,.png"></div>
    ${(e.soportes || []).length ? `<div class="text-xs text-muted" style="margin-bottom:6px">Historial de certificados</div><div class="vz-card-meta">${e.soportes.slice().reverse().map(f => `<span class="vz-chip c-blue" style="cursor:pointer" onclick="sigAbrir('${VZ.esc(f.ruta)}')">📄 ${VZ.esc(f.nombre)}${f.calibracion ? ' · ' + VZ.esc(f.calibracion) : ''}</span>`).join('')}</div>` : ''}
    <div class="flex gap-3 mt-3"><button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-pesv')">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" id="pk-btn" onclick="pvoGuardarCalibracion('${e.id}')">💾 Guardar calibración</button></div>`, 620);
}
async function pvoGuardarCalibracion(id) {
  const e = PVO.equipos.find(x => x.id === id); if (!e || !pesvPuedeEditar()) return;
  const f = document.getElementById('pk-file').files[0], fecha = document.getElementById('pk-fecha').value, prox = document.getElementById('pk-prox').value;
  if (!f) { showNotif('Adjunta el certificado de calibración', 'error'); return; }
  if (f.size > PESV_MAX_BYTES) { showNotif('⛔ El archivo supera 10 MB', 'error'); return; }
  if (!fecha || !prox || prox <= fecha) { showNotif('Revisa las fechas: la próxima calibración debe ser posterior', 'error'); return; }
  const btn = document.getElementById('pk-btn'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Subiendo…'; }
  try {
    const ruta = `pesv/equipos/${sigNombreSeguro(id)}/${Date.now()}_${sigNombreSeguro(f.name)}`;
    await sigSubir(ruta, f);
    const soportes = (e.soportes || []).concat([{ id: 'ec' + Date.now(), nombre: f.name, ruta, tamano: f.size, calibracion: fecha, vence: prox, por: SC.user?.name || '', fecha: new Date().toISOString() }]);
    const r = await sbFetch('pesv_equipos', 'PATCH', { soportes, fecha_calibracion: fecha, proxima_calibracion: prox, estado: 'operativo', updated_at: new Date().toISOString() }, `?id=eq.${encodeURIComponent(id)}`);
    if (r === null) throw new Error('no se guardó en la base de datos');
    Object.assign(e, { soportes, fecha_calibracion: fecha, proxima_calibracion: prox, estado: 'operativo' });
    showNotif('✅ Calibración registrada');
    closeModal('modal-pesv'); pesvPintarTab();
  } catch (err) { if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar calibración'; } showNotif('No se pudo guardar: ' + err.message, 'error'); }
}
window.pvoCalibrar = pvoCalibrar; window.pvoGuardarCalibracion = pvoGuardarCalibracion;
window.PVO = PVO;
