// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH · TABLERO GERENCIAL Y DELEGACIÓN
//   · Panel Gerencia → "🧭 Áreas y delegación": información gerencial de
//     todas las áreas (salud, KPI, documentos, PESV, pendientes) y
//     seguimiento de tareas delegadas. Gerencia no edita datos: solo
//     consulta y delega lo necesario a cada área.
//   · "📥 Tareas de Gerencia" (vista 'delegaciones'): cada área recibe sus
//     tareas, las avanza y las marca cumplidas; Gerencia las valida.
// Tabla delegaciones con RLS y avisos automáticos: supabase_capacitacion_gerencia.sql
// ═══════════════════════════════════════════════════════════════

const GD = { delegs: [], ok: null };
const GD_ESTADOS = [
  { k: 'asignada',    t: 'Asignadas',   c: 'slate' },
  { k: 'en_progreso', t: 'En progreso', c: 'blue' },
  { k: 'devuelta',    t: 'Devueltas',   c: 'orange' },
  { k: 'cumplida',    t: 'Por validar', c: 'amber' },
  { k: 'validada',    t: 'Validadas',   c: 'green' },
];
const GD_PRIO = { alta: ['Alta', 'red'], media: ['Media', 'amber'], baja: ['Baja', 'blue'] };
const gdHoy = () => new Date().toISOString().slice(0, 10);
const gdEsGerencia = () => ['gerencia', 'superadmin'].includes(SC.user?.role);
const gdAbierta = d => ['asignada', 'en_progreso', 'devuelta'].includes(d.estado);
const gdVencida = d => gdAbierta(d) && d.fecha_limite && d.fecha_limite < gdHoy();
const gdDiscCerrado = d => ['cerrado', 'archivado', 'sancionado'].includes(d.estado);

async function gdCargar() {
  const r = await sbFetch('delegaciones', 'GET', null, '?select=*&order=created_at.desc&limit=1000');
  GD.ok = r !== null;
  GD.delegs = r || [];
}
async function gdCargarTodo() {
  const tareas = [gdCargar()];
  if (typeof sigPuedeVer === 'function' && sigPuedeVer() && typeof SG !== 'undefined' && !SG.cargado && typeof sigCargar === 'function') tareas.push(sigCargar());
  if (typeof pesvPuedeVer === 'function' && pesvPuedeVer() && typeof PV !== 'undefined' && !PV.cargado && typeof pesvCargar === 'function') tareas.push(pesvCargar());
  await Promise.all(tareas);
}

// Áreas a las que se puede delegar
function gdAreas() {
  const base = [{ key: 'rrhh', nombre: 'Recursos Humanos', icon: '👥' }];
  const dup = a => /recursos humanos|gesti[oó]n humana|talento humano|^gerencia/i.test(a.name || '');
  (SC.areas || []).forEach(a => { if (!dup(a)) base.push({ key: 'area-' + a.id, nombre: a.name, icon: a.icon || '📁' }); });
  return base;
}
const gdAreaNombre = k => gdAreas().find(a => a.key === k)?.nombre || (typeof sigAreaNombre === 'function' ? sigAreaNombre(k) : k);

// ─── Métricas por área ───────────────────────────────────────
function gdMetricas(area) {
  const hoy = gdHoy(), key = area.key, esRRHH = key === 'rrhh', areaId = key.startsWith('area-') ? key.slice(5) : null;
  const activos = SC.empleados.filter(e => (e.status || 'activo') !== 'retirado' && (esRRHH || String(e.areaId) === areaId));
  const ids = new Set(activos.map(e => e.id));
  const delMio = x => esRRHH || ids.has(x.empId);
  const permPend = SC.permisos.filter(p => p.status === 'pendiente' && delMio(p)).length;
  const incPend = (SC.incapacidades || []).filter(i => i.status === 'pendiente' && delMio(i)).length;
  const vacPend = (SC.vacaciones || []).filter(v => v.estado === 'pendiente' && delMio(v)).length;
  const discs = (SC.disciplinarios || []).filter(d => !gdDiscCerrado(d) && delMio(d));
  const discViejos = discs.filter(d => d.fecha && (Date.now() - new Date(d.fecha)) / 864e5 > 30).length;
  const ausentes = typeof tbIncapFin === 'function' ? new Set([
    ...(SC.vacaciones || []).filter(v => v.estado === 'aprobado' && v.inicio <= hoy && v.fin >= hoy && ids.has(v.empId)).map(v => v.empId),
    ...(SC.incapacidades || []).filter(i => i.fechaInicio && i.fechaInicio <= hoy && tbIncapFin(i) >= hoy && ids.has(i.empId)).map(i => i.empId),
    ...SC.permisos.filter(p => p.status === 'aprobado' && p.inicio <= hoy && (p.fin || p.inicio) >= hoy && ids.has(p.empId)).map(p => p.empId),
  ]).size : 0;
  const sg = typeof SG !== 'undefined' && SG.cargado && !SG.error;
  const kpis = sg ? SG.kpis.filter(k => k.area_key === key && k.activo !== false) : [];
  const sem = kpis.map(k => typeof sigSemaforoKPI === 'function' ? sigSemaforoKPI(k) : { k: 'gris' });
  const sinMedir = k => { const u = typeof sigUltimaMedicion === 'function' ? sigUltimaMedicion(k) : null;
    return !u || (typeof sigPeriodoEsperado === 'function' && String(u.periodo) < sigPeriodoEsperado(k.frecuencia)); };
  const kpiRojo = sem.filter(s => s.k === 'rojo').length, kpiVerde = sem.filter(s => s.k === 'verde').length;
  const kpiSinMedir = kpis.filter(sinMedir).length;
  const docs = sg ? SG.docs.filter(d => d.area_key === key) : [];
  const docsVencLista = docs.filter(d => d.estado !== 'obsoleto' && d.fecha_revision && d.fecha_revision < hoy);
  const delegs = GD.delegs.filter(d => d.area_key === key);
  const delAbiertas = delegs.filter(gdAbierta).length, delVencidas = delegs.filter(gdVencida).length, delPorValidar = delegs.filter(d => d.estado === 'cumplida').length;
  let pesv = null;
  if (areaId === '14' && typeof PV !== 'undefined' && PV.evals?.length && typeof pesvCalcGlobal === 'function') {
    const g = pesvCalcGlobal(PV.evals[0]); pesv = { pct: g.pct };
  }
  // Índice de salud: parte de 100 y descuenta por cada pendiente relevante
  // RRHH ve los pendientes de toda la empresa: se le descuentan con tope para no castigar dos veces lo que ya baja a cada área
  let score = 100 - kpiRojo * 15 - kpiSinMedir * 5 - docsVencLista.length * 8 - delVencidas * 12 - Math.min(18, discViejos * 6)
              - Math.min(esRRHH ? 8 : 15, permPend * 2) - Math.min(esRRHH ? 6 : 10, incPend * 2) - (pesv && pesv.pct < 60 ? 15 : pesv && pesv.pct < 85 ? 6 : 0);
  if (sg && kpis.length === 0 && !esRRHH) score -= 5;   // área sin indicadores definidos
  score = Math.max(0, Math.min(100, Math.round(score)));
  // Pendientes que se pueden delegar
  const issues = [];
  kpis.forEach((k, i) => { if (sem[i].k === 'rojo') issues.push({ nivel: 'alta', txt: `KPI fuera de meta: ${k.nombre}`, titulo: `Plan de acción para el KPI "${k.nombre}"`, modulo: 'kpi', ref: k.id }); });
  kpis.filter(sinMedir).forEach(k => issues.push({ nivel: 'media', txt: `KPI sin medir: ${k.nombre}`, titulo: `Registrar la medición del KPI "${k.nombre}"`, modulo: 'kpi', ref: k.id }));
  docsVencLista.forEach(d => issues.push({ nivel: 'media', txt: `Documento con revisión vencida: ${d.codigo ? d.codigo + ' · ' : ''}${d.nombre}`, titulo: `Actualizar el documento ${d.codigo || d.nombre}`, modulo: 'documentos', ref: d.id }));
  if (sg && !kpis.length && !esRRHH) issues.push({ nivel: 'media', txt: 'El área no tiene KPI definidos', titulo: 'Definir y cargar los KPI del área', modulo: 'kpi', ref: '' });
  if (sg && !docs.length && !esRRHH) issues.push({ nivel: 'media', txt: 'El área no tiene procesos ni procedimientos cargados', titulo: 'Cargar manual, procesos y procedimientos del área', modulo: 'documentos', ref: '' });
  if (permPend >= 3) issues.push({ nivel: 'media', txt: `${permPend} permisos pendientes de respuesta`, titulo: `Responder ${permPend} permisos pendientes`, modulo: 'permisos', ref: '' });
  if (discViejos) issues.push({ nivel: 'alta', txt: `${discViejos} proceso(s) disciplinario(s) con más de 30 días`, titulo: 'Avanzar los procesos disciplinarios abiertos hace más de 30 días', modulo: 'disciplinarios', ref: '' });
  if (pesv && pesv.pct < 85) issues.push({ nivel: pesv.pct < 60 ? 'alta' : 'media', txt: `PESV en ${VZ.num(pesv.pct, 0)}% de cumplimiento`, titulo: 'Cerrar brechas del PESV antes de la próxima autoevaluación', modulo: 'pesv', ref: '' });
  return { area, activos: activos.length, ausentes, permPend, incPend, vacPend, discAbiertos: discs.length, discViejos,
           kpis: kpis.length, kpiVerde, kpiRojo, kpiSinMedir, docs: docs.length, docsVenc: docsVencLista.length,
           delAbiertas, delVencidas, delPorValidar, pesv, score, issues };
}
const gdColorScore = s => s >= 80 ? '#16a34a' : s >= 60 ? '#f59e0b' : '#dc2626';
const gdBtnDelegar = (key, i, txt = '📤 Delegar') =>
  `<button class="btn btn-ghost btn-sm" onclick='gdNuevaDelegacion(${VZ.esc(JSON.stringify(key))}, ${VZ.esc(JSON.stringify(i.titulo))}, ${VZ.esc(JSON.stringify(i.txt))}, ${VZ.esc(JSON.stringify(i.modulo))}, ${VZ.esc(JSON.stringify(String(i.ref || '')))})'>${txt}</button>`;

// ═══════════════════════════════════════════════════════════════
// PANEL GERENCIA · ÁREAS Y DELEGACIÓN
// ═══════════════════════════════════════════════════════════════
async function renderGerenciaAreas(el) {
  if (!el) return;
  el.innerHTML = '<div class="vz-empty">Cargando información de todas las áreas…</div>';
  await gdCargarTodo();
  const M = gdAreas().map(gdMetricas);
  const T = typeof tbMetricas === 'function' ? tbMetricas() : null;
  const nAct = T ? T.activos.length : SC.empleados.length;
  const pesvG = typeof PV !== 'undefined' && PV.evals?.length && typeof pesvCalcGlobal === 'function' ? pesvCalcGlobal(PV.evals[0]) : null;
  const kpisTot = M.reduce((s, m) => s + m.kpis, 0), kpisOk = M.reduce((s, m) => s + m.kpiVerde, 0);
  const abiertas = GD.delegs.filter(gdAbierta).length, vencidas = GD.delegs.filter(gdVencida).length, porValidar = GD.delegs.filter(d => d.estado === 'cumplida').length;
  const salud = M.length ? Math.round(M.reduce((s, m) => s + m.score, 0) / M.length) : 0;
  const kpis = [
    VZ.kpi({ label: 'Salud organizacional', value: VZ.num(salud), unit: '/100', icon: '🩺', tone: salud >= 80 ? 'green' : salud >= 60 ? 'amber' : 'red', sub: `promedio de ${M.length} áreas` }),
    VZ.kpi({ label: 'Colaboradores activos', value: VZ.num(nAct), icon: '👥', tone: 'navy', sub: T ? `${T.ausentesHoy} ausentes hoy` : '', trend: T?.headcount }),
    VZ.kpi({ label: 'Rotación 12 meses', value: T ? VZ.num(T.rotacion, 1) : '—', unit: T ? '%' : '', icon: '🔄', tone: T && T.rotacion > 15 ? 'red' : 'blue' }),
    VZ.kpi({ label: 'Cumplimiento PESV', value: pesvG ? VZ.num(pesvG.pct, 1) : '—', unit: pesvG ? '%' : '', icon: '🚦', tone: pesvG ? (pesvG.pct >= 85 ? 'green' : pesvG.pct >= 60 ? 'amber' : 'red') : 'slate', sub: pesvG ? `${pesvG.pasosCumplen}/${pesvG.pasosAplican} pasos` : 'sin evaluación', onclick: "showView('pesv')" }),
    VZ.kpi({ label: 'KPI en meta', value: kpisTot ? VZ.num(kpisOk / kpisTot * 100, 0) : '—', unit: kpisTot ? '%' : '', icon: '🎯', tone: kpisTot && kpisOk / kpisTot >= .8 ? 'green' : 'amber', sub: `${kpisOk} de ${kpisTot} KPI` }),
    VZ.kpi({ label: 'Tareas delegadas abiertas', value: VZ.num(abiertas), icon: '📤', tone: vencidas ? 'red' : 'purple', sub: `${vencidas} vencidas · ${porValidar} por validar` }),
  ].join('');
  const barras = VZ.bars(M.map(m => ({ label: `${m.area.icon} ${m.area.nombre}`, value: m.score, color: gdColorScore(m.score), onclick: `gdDetalleArea('${m.area.key}')` })), { max: 100, sort: true, limit: 20 });
  const celda = (v, malo) => { const c = v == null ? '#94a3b8' : v > malo ? '#dc2626' : v > 0 ? '#f59e0b' : '#16a34a';
    return `<td style="text-align:center"><span style="display:inline-block;min-width:30px;padding:2px 8px;border-radius:6px;background:${c}1a;color:${c};font-weight:700">${v == null ? '—' : v}</span></td>`; };
  const filas = M.slice().sort((a, b) => a.score - b.score).map(m => `
    <tr style="cursor:pointer" onclick="gdDetalleArea('${m.area.key}')">
      <td><b>${m.area.icon} ${VZ.esc(m.area.nombre)}</b></td>
      <td style="text-align:center"><b style="color:${gdColorScore(m.score)}">${m.score}</b><div style="width:70px;margin:2px auto 0">${VZ.progress(m.score, gdColorScore(m.score))}</div></td>
      <td style="text-align:center">${m.activos}</td><td style="text-align:center">${m.ausentes}</td>
      ${celda(m.permPend, 4)}${celda(m.discAbiertos, 2)}
      <td style="text-align:center">${m.kpis ? `${m.kpiVerde}/${m.kpis}` : '<span class="text-muted">—</span>'}</td>
      ${celda(m.kpis ? m.kpiRojo : null, 0)}${celda(m.kpis ? m.kpiSinMedir : null, 1)}${celda(m.docsVenc, 0)}
      ${celda(m.delVencidas, 0)}
      <td style="text-align:center">${m.pesv ? `<b style="color:${m.pesv.pct >= 85 ? '#16a34a' : m.pesv.pct >= 60 ? '#b45309' : '#dc2626'}">${VZ.num(m.pesv.pct, 0)}%</b>` : '<span class="text-muted">—</span>'}</td>
      <td onclick="event.stopPropagation()">${gdEsGerencia() ? `<button class="btn btn-ghost btn-sm" onclick="gdNuevaDelegacion('${m.area.key}')">📤 Delegar</button>` : ''}</td>
    </tr>`).join('');
  const matriz = `<div style="overflow-x:auto"><table class="data-table" style="font-size:12px">
    <thead><tr><th>Área</th><th style="text-align:center">Salud</th><th style="text-align:center">Personas</th><th style="text-align:center">Ausentes hoy</th><th style="text-align:center">Permisos pend.</th><th style="text-align:center">Disciplinarios</th>
      <th style="text-align:center">KPI en meta</th><th style="text-align:center">KPI fuera</th><th style="text-align:center">KPI sin medir</th><th style="text-align:center">Docs vencidos</th>
      <th style="text-align:center">Tareas vencidas</th><th style="text-align:center">PESV</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>`;
  const issues = M.flatMap(m => m.issues.map(i => ({ ...i, area: m.area }))).sort((a, b) => (a.nivel === 'alta' ? 0 : 1) - (b.nivel === 'alta' ? 0 : 1));
  const yaDelegado = i => GD.delegs.some(d => d.area_key === i.area.key && d.titulo === i.titulo && d.estado !== 'validada');
  const listaIssues = issues.length ? `<div style="max-height:360px;overflow:auto">${issues.slice(0, 40).map(i => `
    <div style="display:flex;gap:10px;align-items:center;padding:8px 10px;border-left:3px solid ${i.nivel === 'alta' ? '#dc2626' : '#f59e0b'};background:#f8fafd;border-radius:0 8px 8px 0;margin-bottom:6px">
      <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--navy)">${VZ.esc(i.txt)}</div><div class="text-xs text-muted">${i.area.icon} ${VZ.esc(i.area.nombre)}</div></div>
      ${yaDelegado(i) ? '<span class="vz-chip c-purple">Ya delegado</span>' : gdEsGerencia() && GD.ok ? gdBtnDelegar(i.area.key, i) : ''}
    </div>`).join('')}${issues.length > 40 ? `<div class="text-xs text-muted">+ ${issues.length - 40} más</div>` : ''}</div>` : VZ.empty('No se detectan pendientes en las áreas');
  el.innerHTML = `
    <div class="vz-head">
      <h2>Tablero gerencial · todas las áreas<small>Consulta de solo lectura · delega a cada área lo que necesita y valida su cumplimiento</small></h2>
      <div class="vz-head-actions">
        <button class="btn btn-ghost btn-sm" onclick="gdInforme()">📑 Informe gerencial</button>
        ${gdEsGerencia() && GD.ok ? '<button class="btn btn-primary btn-sm" onclick="gdNuevaDelegacion()">📤 Delegar tarea</button>' : ''}
      </div>
    </div>
    ${GD.ok === false ? '<div class="info-box mb-3" style="border-left:3px solid var(--amber);font-size:12px">⚙️ Para delegar tareas a las áreas, ejecuta <code>supabase_capacitacion_gerencia.sql</code> en Supabase → SQL Editor.</div>' : ''}
    <div class="vz-kpis">${kpis}</div>
    <div class="vz-grid">
      ${VZ.panel('Índice de salud por área', barras, { sub: 'De 0 a 100 · baja con KPI fuera de meta o sin medir, documentos y tareas vencidas, y pendientes', span: 5 })}
      ${VZ.panel('Pendientes detectados para delegar', listaIssues, { sub: `${issues.length} pendiente(s) en ${new Set(issues.map(i => i.area.key)).size} área(s)`, span: 7 })}
    </div>
    <div class="vz-grid">${VZ.panel('Matriz de áreas', matriz, { sub: 'Haz clic en un área para ver el detalle', span: 12 })}</div>
    ${GD.ok ? `<div class="vz-grid">${VZ.panel('Seguimiento de tareas delegadas', gdKanban(GD.delegs, 'gerencia'), { sub: 'Las validadas se muestran durante 30 días', span: 12 })}</div>` : ''}`;
}
window.renderGerenciaAreas = renderGerenciaAreas;

function gdKanban(lista, modo) {
  const hace30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const card = d => {
    const [pt, pc] = GD_PRIO[d.prioridad] || GD_PRIO.media;
    const chips = [{ t: pt, c: pc }];
    if (d.fecha_limite) chips.push({ t: (gdVencida(d) ? '⏰ Vencida ' : '📅 ') + d.fecha_limite, c: gdVencida(d) ? 'red' : '' });
    if (d.modulo) chips.push({ t: d.modulo });
    let actions = '';
    if (modo === 'gerencia' && gdEsGerencia() && d.estado === 'cumplida')
      actions = `<button class="btn btn-ghost btn-sm" onclick="gdCambiarEstado('${d.id}','validada')">✅ Validar</button><button class="btn btn-ghost btn-sm" onclick="gdCambiarEstado('${d.id}','devuelta')">↩️ Devolver</button>`;
    if (modo === 'area') {
      if (d.estado === 'asignada' || d.estado === 'devuelta') actions = `<button class="btn btn-ghost btn-sm" onclick="gdCambiarEstado('${d.id}','en_progreso')">▶ ${d.estado === 'devuelta' ? 'Retomar' : 'Iniciar'}</button>`;
      if (gdAbierta(d)) actions += `<button class="btn btn-ghost btn-sm" onclick="gdCambiarEstado('${d.id}','cumplida')">✅ Cumplida</button>`;
    }
    const sub = [modo === 'gerencia' ? gdAreaNombre(d.area_key) : '', d.estado === 'devuelta' && d.observacion ? `Gerencia: ${d.observacion}` : '',
                 d.estado === 'cumplida' && d.respuesta ? `Área: ${d.respuesta}` : ''].filter(Boolean).join(' · ');
    return { id: d.id, title: d.titulo, sub, chips, actions, onclick: `gdVerDelegacion('${d.id}')` };
  };
  return VZ.kanban(GD_ESTADOS.map(e => ({ key: e.k, title: e.t, color: e.c,
    cards: lista.filter(d => d.estado === e.k && (e.k !== 'validada' || String(d.updated_at || d.created_at) >= hace30))
      .sort((a, b) => String(a.fecha_limite || '9999').localeCompare(String(b.fecha_limite || '9999'))).map(card) })), { limit: 40 });
}

// Modal genérico (reutiliza el del PESV si existe)
function gdModal(titulo, html, ancho) {
  if (typeof pesvModal === 'function') return pesvModal(titulo, html, ancho);
  let m = document.getElementById('modal-gd');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-gd';
    m.innerHTML = `<div class="modal" style="width:96vw"><div class="modal-header"><div class="modal-title" id="gd-t"></div><button class="modal-close" onclick="closeModal('modal-gd')">✕</button></div><div class="modal-body" id="gd-b" style="max-height:76vh;overflow:auto"></div></div>`;
    document.body.appendChild(m); }
  m.querySelector('.modal').style.maxWidth = (ancho || 640) + 'px';
  document.getElementById('gd-t').textContent = titulo; document.getElementById('gd-b').innerHTML = html; openModal('modal-gd');
}
function gdCerrar() { ['modal-pesv', 'modal-gd'].forEach(id => { if (document.getElementById(id)) closeModal(id); }); }
window.gdCerrar = gdCerrar;

function gdDetalleArea(key) {
  const area = gdAreas().find(a => a.key === key); if (!area) return;
  const m = gdMetricas(area), delegs = GD.delegs.filter(d => d.area_key === key);
  const fila = (t, v, c) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eef1f7;font-size:12px"><span>${t}</span><b style="color:${c || 'var(--navy)'}">${v}</b></div>`;
  const est = d => GD_ESTADOS.find(e => e.k === d.estado) || { t: d.estado, c: '' };
  gdModal(`${area.icon} ${area.nombre}`, `
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:12px">
      <div style="text-align:center"><div style="font-size:34px;font-weight:800;color:${gdColorScore(m.score)}">${m.score}</div><div class="text-xs text-muted">índice de salud</div></div>
      <div style="flex:1">${VZ.progress(m.score, gdColorScore(m.score))}<div class="text-xs text-muted" style="margin-top:4px">${m.issues.length} pendiente(s) detectado(s) · ${m.delAbiertas} tarea(s) delegada(s) abierta(s)</div></div>
      ${gdEsGerencia() && GD.ok ? `<button class="btn btn-primary btn-sm" onclick="gdNuevaDelegacion('${key}')">📤 Delegar</button>` : ''}
    </div>
    <div class="vz-grid" style="margin-bottom:8px"><div class="vz-span-6">
      ${fila('Colaboradores activos', m.activos)}${fila('Ausentes hoy', m.ausentes)}${fila('Permisos pendientes', m.permPend, m.permPend > 4 ? '#dc2626' : null)}
      ${fila('Incapacidades por revisar', m.incPend)}${fila('Vacaciones por aprobar', m.vacPend)}${fila('Procesos disciplinarios abiertos', `${m.discAbiertos}${m.discViejos ? ` (${m.discViejos} > 30 días)` : ''}`, m.discViejos ? '#dc2626' : null)}
    </div><div class="vz-span-6">
      ${fila('KPI definidos', m.kpis)}${fila('KPI en meta', m.kpiVerde, '#16a34a')}${fila('KPI fuera de meta', m.kpiRojo, m.kpiRojo ? '#dc2626' : null)}${fila('KPI sin medir', m.kpiSinMedir, m.kpiSinMedir ? '#b45309' : null)}
      ${fila('Documentos cargados', m.docs)}${fila('Documentos con revisión vencida', m.docsVenc, m.docsVenc ? '#dc2626' : null)}${m.pesv ? fila('Cumplimiento PESV', VZ.num(m.pesv.pct, 1) + '%') : ''}
    </div></div>
    <div style="font-weight:700;font-size:12px;color:var(--navy);margin:8px 0">Pendientes para delegar</div>
    ${m.issues.length ? m.issues.map(i => `<div style="display:flex;gap:8px;align-items:center;padding:6px 8px;background:#f8fafd;border-left:3px solid ${i.nivel === 'alta' ? '#dc2626' : '#f59e0b'};border-radius:0 6px 6px 0;margin-bottom:5px;font-size:12px">
      <span style="flex:1">${VZ.esc(i.txt)}</span>${gdEsGerencia() && GD.ok ? gdBtnDelegar(key, i, '📤') : ''}</div>`).join('') : '<div class="text-xs text-muted">Sin pendientes detectados.</div>'}
    <div style="font-weight:700;font-size:12px;color:var(--navy);margin:14px 0 8px">Tareas delegadas</div>
    ${delegs.length ? delegs.slice(0, 15).map(d => `<div style="display:flex;gap:8px;align-items:center;font-size:12px;padding:5px 0;border-bottom:1px solid #eef1f7;cursor:pointer" onclick="gdVerDelegacion('${d.id}')">
      <span style="flex:1">${VZ.esc(d.titulo)}</span><span class="vz-chip c-${est(d).c}">${est(d).t}</span>
      ${gdVencida(d) ? '<span class="vz-chip c-red">Vencida</span>' : ''}</div>`).join('') : '<div class="text-xs text-muted">Sin tareas delegadas.</div>'}`, 820);
}
window.gdDetalleArea = gdDetalleArea;

// ─── Delegar ────────────────────────────────────────────────
function gdNuevaDelegacion(areaKey = '', titulo = '', desc = '', modulo = '', ref = '') {
  if (!gdEsGerencia()) { showNotif('Solo Gerencia y el Super Admin delegan tareas', 'error'); return; }
  if (GD.ok === false) { showNotif('Ejecuta supabase_capacitacion_gerencia.sql para activar la delegación', 'error'); return; }
  const en15 = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
  gdModal('📤 Delegar tarea a un área', `
    <div class="form-group"><label class="form-label">Área responsable</label><select class="form-select" id="gd-area">${gdAreas().map(a => `<option value="${a.key}" ${a.key === areaKey ? 'selected' : ''}>${a.icon} ${VZ.esc(a.nombre)}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Tarea *</label><input class="form-input" id="gd-tit" value="${VZ.esc(titulo)}" placeholder="¿Qué debe hacer el área?"></div>
    <div class="form-group"><label class="form-label">Detalle / contexto</label><textarea class="form-textarea" id="gd-desc" rows="3">${VZ.esc(desc)}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Prioridad</label><select class="form-select" id="gd-prio">${Object.entries(GD_PRIO).map(([k, [t]]) => `<option value="${k}" ${k === 'media' ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Fecha límite</label><input type="date" class="form-input" id="gd-fecha" value="${en15}"></div></div>
    <input type="hidden" id="gd-mod" value="${VZ.esc(modulo)}"><input type="hidden" id="gd-ref" value="${VZ.esc(ref)}">
    <div class="text-xs text-muted" style="margin-bottom:10px">El área recibirá una notificación 🔔 y verás el avance hasta que la valides.</div>
    <div class="flex gap-3"><button class="btn btn-ghost" style="flex:1" onclick="gdCerrar()">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" id="gd-btn" onclick="gdGuardarDelegacion()">📤 Delegar</button></div>`, 600);
}
async function gdGuardarDelegacion() {
  const titulo = document.getElementById('gd-tit').value.trim();
  if (!titulo) { showNotif('Describe la tarea', 'error'); return; }
  const btn = document.getElementById('gd-btn'); if (btn) btn.disabled = true;
  const fila = { id: 'dl' + Date.now() + Math.random().toString(36).slice(2, 5), area_key: document.getElementById('gd-area').value, titulo,
    descripcion: document.getElementById('gd-desc').value.trim(), prioridad: document.getElementById('gd-prio').value,
    fecha_limite: document.getElementById('gd-fecha').value || null, estado: 'asignada', modulo: document.getElementById('gd-mod').value,
    ref_id: document.getElementById('gd-ref').value, creada_por: SC.user?.name || '', creada_por_id: SC.user?.id || null, actualizada_por: SC.user?.name || '' };
  const r = await sbFetch('delegaciones', 'POST', fila, '', { 'Prefer': 'return=minimal' });
  if (r === null) { if (btn) btn.disabled = false; return; }
  const ahora = new Date().toISOString();
  GD.delegs.unshift({ ...fila, created_at: ahora, updated_at: ahora });
  if (typeof registrarAuditoria === 'function') registrarAuditoria('delegar', 'delegacion', fila.id, `${gdAreaNombre(fila.area_key)} · ${titulo}`);
  showNotif(`📤 Tarea delegada a ${gdAreaNombre(fila.area_key)}`);
  gdCerrar(); gdRefrescar();
}
window.gdNuevaDelegacion = gdNuevaDelegacion; window.gdGuardarDelegacion = gdGuardarDelegacion;

function gdVerDelegacion(id) {
  const d = GD.delegs.find(x => x.id === id); if (!d) return;
  const est = GD_ESTADOS.find(e => e.k === d.estado) || {}, [pt, pc] = GD_PRIO[d.prioridad] || GD_PRIO.media;
  const puedeArea = SC.user?.role !== 'gerencia';   // el área responsable (o el Super Admin) la avanza
  gdModal(`📤 ${d.titulo}`, `
    <div class="vz-card-meta" style="margin-bottom:10px"><span class="vz-chip c-${est.c || ''}">${est.t || d.estado}</span><span class="vz-chip c-${pc}">Prioridad ${pt}</span>
      ${d.fecha_limite ? `<span class="vz-chip ${gdVencida(d) ? 'c-red' : ''}">📅 ${VZ.esc(d.fecha_limite)}</span>` : ''}<span class="vz-chip">${VZ.esc(gdAreaNombre(d.area_key))}</span></div>
    ${d.descripcion ? `<div class="text-sm" style="white-space:pre-wrap;margin-bottom:10px">${VZ.esc(d.descripcion)}</div>` : ''}
    <div class="text-xs text-muted">Delegada por ${VZ.esc(d.creada_por || '')} · ${d.created_at ? new Date(d.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : ''}</div>
    ${d.respuesta ? `<div class="info-box mt-3" style="font-size:12px"><b>Respuesta del área:</b> ${VZ.esc(d.respuesta)}</div>` : ''}
    ${d.observacion ? `<div class="info-box mt-2" style="font-size:12px;border-left:3px solid var(--amber)"><b>Observación de Gerencia:</b> ${VZ.esc(d.observacion)}</div>` : ''}
    <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
      ${gdEsGerencia() && d.estado === 'cumplida' ? `<button class="btn btn-primary btn-sm" onclick="gdCambiarEstado('${d.id}','validada')">✅ Validar</button><button class="btn btn-ghost btn-sm" onclick="gdCambiarEstado('${d.id}','devuelta')">↩️ Devolver</button>` : ''}
      ${gdEsGerencia() && gdAbierta(d) ? `<button class="btn btn-ghost btn-sm" onclick="gdEliminarDelegacion('${d.id}')">🗑 Retirar tarea</button>` : ''}
      ${puedeArea && (d.estado === 'asignada' || d.estado === 'devuelta') ? `<button class="btn btn-ghost btn-sm" onclick="gdCambiarEstado('${d.id}','en_progreso')">▶ ${d.estado === 'devuelta' ? 'Retomar' : 'Iniciar'}</button>` : ''}
      ${puedeArea && gdAbierta(d) ? `<button class="btn btn-primary btn-sm" onclick="gdCambiarEstado('${d.id}','cumplida')">✅ Marcar cumplida</button>` : ''}
    </div>`, 620);
}
window.gdVerDelegacion = gdVerDelegacion;

// Cambios de estado: cumplida pide respuesta; devolver pide observación
function gdCambiarEstado(id, estado) {
  const d = GD.delegs.find(x => x.id === id); if (!d) return;
  if (estado === 'en_progreso') { gdGuardarEstado(id, estado, {}); return; }
  const etiqueta = estado === 'cumplida' ? '¿Qué se hizo? (respuesta para Gerencia) *' : estado === 'devuelta' ? '¿Qué falta? (observación para el área) *' : 'Observación (opcional)';
  gdModal(estado === 'cumplida' ? '✅ Marcar tarea cumplida' : estado === 'devuelta' ? '↩️ Devolver tarea al área' : '✅ Validar tarea', `
    <div class="text-sm" style="margin-bottom:8px"><b>${VZ.esc(d.titulo)}</b></div>
    <div class="form-group"><label class="form-label">${etiqueta}</label><textarea class="form-textarea" id="gd-txt" rows="3"></textarea></div>
    <div class="flex gap-3"><button class="btn btn-ghost" style="flex:1" onclick="gdCerrar()">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" onclick="gdConfirmarEstado('${id}','${estado}')">Confirmar</button></div>`, 520);
}
async function gdConfirmarEstado(id, estado) {
  const txt = (document.getElementById('gd-txt')?.value || '').trim();
  if (estado !== 'validada' && !txt) { showNotif('Escribe el detalle antes de confirmar', 'error'); return; }
  await gdGuardarEstado(id, estado, estado === 'cumplida' ? { respuesta: txt } : txt ? { observacion: txt } : {});
}
async function gdGuardarEstado(id, estado, extra) {
  const d = GD.delegs.find(x => x.id === id); if (!d) return;
  const cambios = { estado, actualizada_por: SC.user?.name || '', ...extra };
  const r = await sbFetch('delegaciones', 'PATCH', cambios, `?id=eq.${encodeURIComponent(id)}`);
  if (r === null) return;
  Object.assign(d, cambios, { updated_at: new Date().toISOString() });
  showNotif({ en_progreso: '▶ Tarea en progreso', cumplida: '✅ Tarea cumplida · Gerencia fue notificada', validada: '🏁 Tarea validada', devuelta: '↩️ Tarea devuelta al área' }[estado] || 'Actualizado');
  gdCerrar(); gdRefrescar();
}
async function gdEliminarDelegacion(id) {
  if (!gdEsGerencia() || !confirm('¿Retirar esta tarea delegada?')) return;
  const r = await sbFetch('delegaciones', 'DELETE', null, `?id=eq.${encodeURIComponent(id)}`);
  if (r === null) return;
  GD.delegs = GD.delegs.filter(x => x.id !== id); gdCerrar(); gdRefrescar();
}
window.gdCambiarEstado = gdCambiarEstado; window.gdConfirmarEstado = gdConfirmarEstado; window.gdEliminarDelegacion = gdEliminarDelegacion;

function gdRefrescar() {
  if (SC.currentView === 'delegaciones') renderDelegaciones(true);
  else { const el = document.getElementById('gd-root'); if (el) renderGerenciaAreas(el); }
}

// ─── Informe gerencial imprimible ───────────────────────────
function gdInforme() {
  const M = gdAreas().map(gdMetricas).sort((a, b) => a.score - b.score), T = typeof tbMetricas === 'function' ? tbMetricas() : null;
  const pesvG = typeof PV !== 'undefined' && PV.evals?.length && typeof pesvCalcGlobal === 'function' ? pesvCalcGlobal(PV.evals[0]) : null;
  const w = window.open('', '_blank'); if (!w) { showNotif('Permite las ventanas emergentes para ver el informe', 'error'); return; }
  const tile = (t, v, c) => `<div class="tile" style="border-left-color:${c || '#111f4d'}">${t}<b>${v}</b></div>`;
  const issues = M.flatMap(m => m.issues.map(i => ({ ...i, area: m.area.nombre })));
  const e = VZ.esc;
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Informe gerencial · ${new Date().toLocaleDateString('es-CO')}</title>
    <style>body{font-family:Arial,sans-serif;color:#0d1a3a;margin:28px;font-size:12px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:22px 0 8px;color:#111f4d}.sub{color:#64748b;margin:4px 0 16px}
    table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left}th{background:#f1f5f9;font-size:10px;text-transform:uppercase;color:#475569}
    .tiles{display:flex;gap:10px;flex-wrap:wrap}.tile{flex:1;min-width:120px;border:1px solid #e5e7eb;border-left:4px solid;border-radius:8px;padding:8px 12px}.tile b{display:block;font-size:20px}
    @media print{button{display:none}}</style></head><body>
    <button onclick="window.print()" style="float:right;padding:8px 14px">🖨️ Imprimir / Guardar PDF</button>
    <h1>Informe gerencial de áreas</h1><div class="sub">Generado ${new Date().toLocaleString('es-CO')} · ${e(SC.user?.name || '')}</div>
    <div class="tiles">${tile('Colaboradores activos', T ? T.activos.length : SC.empleados.length)}${tile('Rotación 12 meses', T ? VZ.num(T.rotacion, 1) + '%' : '—', '#2563eb')}
      ${tile('Cumplimiento PESV', pesvG ? VZ.num(pesvG.pct, 1) + '%' : '—', '#0d9488')}${tile('Tareas abiertas', GD.delegs.filter(gdAbierta).length, '#7c3aed')}${tile('Tareas vencidas', GD.delegs.filter(gdVencida).length, '#dc2626')}</div>
    <h2>Estado por área</h2><table><thead><tr><th>Área</th><th>Salud</th><th>Personas</th><th>Ausentes</th><th>Permisos pend.</th><th>Disciplinarios</th><th>KPI en meta</th><th>KPI fuera</th><th>KPI sin medir</th><th>Docs vencidos</th><th>Tareas abiertas</th></tr></thead>
    <tbody>${M.map(m => `<tr><td><b>${e(m.area.nombre)}</b></td><td style="font-weight:700;color:${gdColorScore(m.score)}">${m.score}</td><td>${m.activos}</td><td>${m.ausentes}</td><td>${m.permPend}</td><td>${m.discAbiertos}</td>
      <td>${m.kpis ? m.kpiVerde + '/' + m.kpis : '—'}</td><td>${m.kpiRojo}</td><td>${m.kpiSinMedir}</td><td>${m.docsVenc}</td><td>${m.delAbiertas}</td></tr>`).join('')}</tbody></table>
    <h2>Pendientes por delegar (${issues.length})</h2><table><thead><tr><th>Área</th><th>Pendiente</th><th>Prioridad</th></tr></thead>
    <tbody>${issues.map(i => `<tr><td>${e(i.area)}</td><td>${e(i.txt)}</td><td>${i.nivel === 'alta' ? 'Alta' : 'Media'}</td></tr>`).join('') || '<tr><td colspan="3">Sin pendientes</td></tr>'}</tbody></table>
    <h2>Tareas delegadas abiertas</h2><table><thead><tr><th>Área</th><th>Tarea</th><th>Estado</th><th>Prioridad</th><th>Fecha límite</th></tr></thead>
    <tbody>${GD.delegs.filter(d => d.estado !== 'validada').map(d => `<tr><td>${e(gdAreaNombre(d.area_key))}</td><td>${e(d.titulo)}</td><td>${(GD_ESTADOS.find(x => x.k === d.estado) || {}).t || e(d.estado)}</td>
      <td>${(GD_PRIO[d.prioridad] || [''])[0]}</td><td style="${gdVencida(d) ? 'color:#dc2626;font-weight:700' : ''}">${e(d.fecha_limite || '—')}</td></tr>`).join('') || '<tr><td colspan="5">Sin tareas abiertas</td></tr>'}</tbody></table>
    </body></html>`);
  w.document.close();
}
window.gdInforme = gdInforme;

// ═══════════════════════════════════════════════════════════════
// VISTA DE LAS ÁREAS · TAREAS DE GERENCIA
// ═══════════════════════════════════════════════════════════════
function gdPuedeVerTareas() {
  const r = SC.user?.role;
  return ['superadmin', 'gerencia', 'analista_rrhh', 'lider_rrhh'].includes(r) || (r === 'lider_area' && SC.user?.areaId != null && SC.user.areaId !== '');
}
window.gdPuedeVerTareas = gdPuedeVerTareas;

async function renderDelegaciones(sinRecargar) {
  const root = document.getElementById('delegaciones-root'); if (!root) return;
  if (!gdPuedeVerTareas()) { root.innerHTML = VZ.empty('No tienes acceso a esta sección.'); return; }
  if (!sinRecargar) { root.innerHTML = '<div class="vz-empty">Cargando tareas…</div>'; await gdCargar(); }
  if (!GD.ok) { root.innerHTML = `<div class="glass-card p-4" style="border-left:4px solid var(--amber)"><b>La delegación de tareas aún no está activada.</b><div class="text-sm text-muted mt-2">Ejecuta <code>supabase_capacitacion_gerencia.sql</code> en Supabase → SQL Editor.</div></div>`; return; }
  // Supabase ya filtra por área (RLS); se refuerza aquí para que cada área vea solo lo suyo
  const r = SC.user?.role, miArea = r === 'lider_area' ? 'area-' + SC.user.areaId : ['analista_rrhh', 'lider_rrhh'].includes(r) ? 'rrhh' : null;
  const lista = miArea ? GD.delegs.filter(d => d.area_key === miArea) : GD.delegs;
  const abiertas = lista.filter(gdAbierta), venc = lista.filter(gdVencida);
  const kpis = [
    VZ.kpi({ label: 'Tareas abiertas', value: VZ.num(abiertas.length), icon: '📥', tone: 'purple' }),
    VZ.kpi({ label: 'Vencidas', value: VZ.num(venc.length), icon: '⏰', tone: venc.length ? 'red' : 'green' }),
    VZ.kpi({ label: 'Devueltas por Gerencia', value: VZ.num(lista.filter(d => d.estado === 'devuelta').length), icon: '↩️', tone: 'orange' }),
    VZ.kpi({ label: 'Por validar', value: VZ.num(lista.filter(d => d.estado === 'cumplida').length), icon: '⏳', tone: 'amber', sub: 'esperando a Gerencia' }),
    VZ.kpi({ label: 'Validadas', value: VZ.num(lista.filter(d => d.estado === 'validada').length), icon: '🏁', tone: 'green' }),
  ].join('');
  root.innerHTML = `
    <div class="vz-head"><h2>Tareas delegadas por Gerencia<small>Avanza cada tarea y márcala cumplida con tu respuesta; Gerencia la valida o la devuelve</small></h2></div>
    <div class="vz-kpis">${kpis}</div>
    ${lista.length ? gdKanban(lista, SC.user?.role === 'gerencia' ? 'gerencia' : 'area') : VZ.empty('No tienes tareas delegadas.')}`;
}
window.renderDelegaciones = renderDelegaciones;

// ─── Integración con el Panel Gerencia ──────────────────────
(function envolverGerTabAreas() {
  if (typeof window.gerTab !== 'function' || window.gerTab.__gd) return;
  const original = window.gerTab;
  const envuelto = function (tab, el) {
    if (tab === 'areas') {
      try { currentGerTab = 'areas'; } catch (e) {}
      document.querySelectorAll('#view-gerencia .tab').forEach(t => t.className = 'tab');
      (el || document.querySelector(`#view-gerencia .tab[onclick*="'areas'"]`))?.classList.add('active');
      const c = document.getElementById('ger-content');
      if (c) { c.innerHTML = '<div id="gd-root"></div>'; renderGerenciaAreas(document.getElementById('gd-root')); }
      return;
    }
    return original(tab, el);
  };
  envuelto.__gd = true; envuelto.__tb = original.__tb;
  window.gerTab = envuelto;
})();
window.GD = GD;
