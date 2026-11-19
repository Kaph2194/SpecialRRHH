// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH · TABLERO ANALÍTICO + VISTAS KANBAN
//   · renderTableroAnalitico(el): KPI, tendencias y distribución de
//     talento humano, más dos tableros kanban (solicitudes y procesos
//     disciplinarios). Se usa en el Dashboard y en Panel Gerencia.
//   · Selector Tabla / Kanban para Permisos y Disciplinarios.
// Solo lee datos que ya están cargados en SC; no escribe nada.
// ═══════════════════════════════════════════════════════════════

const TB_HOY = () => new Date().toISOString().slice(0, 10);
const tbEmp  = id => SC.empleados.find(e => e.id === id);
const tbNom  = id => { const n = tbEmp(id)?.name || 'Colaborador'; return n.split(' ').slice(0, 3).join(' '); };
const tbVis  = id => typeof empVisibleParaUsuario === 'function' ? empVisibleParaUsuario(id) : true;
const tbMes  = f => String(f || '').slice(0, 7);
const tbDiasDesde = f => f ? Math.floor((Date.now() - new Date(f).getTime()) / 86400000) : null;

function tbIncapFin(i) {
  if (!i.fechaInicio) return '';
  const d = new Date(i.fechaInicio); d.setDate(d.getDate() + (Number(i.dias) || 1) - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Métricas base ───────────────────────────────────────────
function tbMetricas() {
  const hoy = TB_HOY();
  const emps = SC.empleados.filter(e => tbVis(e.id));
  const activos = emps.filter(e => (e.status || 'activo') !== 'retirado');
  const meses = VZ.ultimosMeses(12);
  const finMes = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0).toISOString().slice(0, 10); };

  const headcount = meses.map(m => {
    const fin = finMes(m.key);
    return emps.filter(e => (!e.fechaIngreso || e.fechaIngreso <= fin) && (!e.fechaRetiro || e.fechaRetiro > fin)).length;
  });
  const ingresos = meses.map(m => emps.filter(e => tbMes(e.fechaIngreso) === m.key).length);
  const retiros  = meses.map(m => emps.filter(e => tbMes(e.fechaRetiro) === m.key).length);
  const retiros12 = retiros.reduce((a, b) => a + b, 0);
  const promHC = headcount.reduce((a, b) => a + b, 0) / (headcount.length || 1);
  const rotacion = promHC ? (retiros12 / promHC) * 100 : 0;

  const perms = SC.permisos.filter(p => tbVis(p.empId));
  const vacs  = (SC.vacaciones || []).filter(v => tbVis(v.empId));
  const incs  = (SC.incapacidades || []).filter(i => tbVis(i.empId));
  const discs = (SC.disciplinarios || []).filter(d => tbVis(d.empId));

  const enVac   = new Set(vacs.filter(v => v.estado === 'aprobado' && v.inicio <= hoy && v.fin >= hoy).map(v => v.empId));
  const enIncap = new Set(incs.filter(i => i.fechaInicio && i.fechaInicio <= hoy && tbIncapFin(i) >= hoy).map(i => i.empId));
  const enPerm  = new Set(perms.filter(p => p.status === 'aprobado' && p.inicio <= hoy && (p.fin || p.inicio) >= hoy).map(p => p.empId));
  const ausentesHoy = new Set([...enVac, ...enIncap, ...enPerm]).size;

  const m6 = meses.slice(-6);
  const porMes = (arr, campo) => m6.map(m => arr.filter(x => tbMes(x[campo]) === m.key).length);
  const diasIncMes = m6.map(m => incs.filter(i => tbMes(i.fechaInicio) === m.key).reduce((s, i) => s + (Number(i.dias) || 0), 0));

  return { hoy, emps, activos, meses, headcount, ingresos, retiros, rotacion, perms, vacs, incs, discs,
           enVac, enIncap, enPerm, ausentesHoy, m6,
           permMes: porMes(perms, 'inicio'), vacMes: porMes(vacs, 'inicio'), incMes: porMes(incs, 'fechaInicio'), diasIncMes };
}

// ─── Tablero ────────────────────────────────────────────────
function renderTableroAnalitico(el, { titulo = 'Tablero de Talento Humano', compacto = false } = {}) {
  if (!el || typeof VZ === 'undefined') return;
  const M = tbMetricas();
  const nAct = M.activos.length;
  const pend = typeof pendTotal === 'function' ? pendTotal() : M.perms.filter(p => p.status === 'pendiente').length;
  const ausPct = nAct ? (M.ausentesHoy / nAct) * 100 : 0;
  const permAct = M.permMes[5], permAnt = M.permMes[4];
  const discAbiertos = M.discs.filter(d => !['cerrado', 'archivado'].includes(d.estado)).length;
  const hcAnt = M.headcount[10] || 0, hcAct = M.headcount[11] || nAct;

  const kpis = [
    VZ.kpi({ label: 'Colaboradores activos', value: VZ.num(nAct), icon: '👥', tone: 'navy',
             delta: VZ.pctVar(hcAct, hcAnt), sub: 'vs. mes anterior', trend: M.headcount, onclick: "showView('empleados')" }),
    VZ.kpi({ label: 'Pendientes de gestión', value: VZ.num(pend), icon: '📌', tone: pend ? (pend > 20 ? 'red' : 'amber') : 'green',
             sub: pend ? 'requieren atención' : 'todo al día', onclick: "document.getElementById('dash-pendientes')?.scrollIntoView({behavior:'smooth'})" }),
    VZ.kpi({ label: 'Ausentismo hoy', value: VZ.num(ausPct, 1), unit: '%', icon: '🏥', tone: ausPct > 8 ? 'red' : ausPct > 4 ? 'amber' : 'teal',
             sub: `${M.ausentesHoy} ausentes · ${M.enVac.size} vac · ${M.enIncap.size} incap`, trend: M.diasIncMes }),
    VZ.kpi({ label: 'Rotación 12 meses', value: VZ.num(M.rotacion, 1), unit: '%', icon: '🔄', tone: M.rotacion > 15 ? 'red' : 'blue',
             sub: `${M.retiros.reduce((a, b) => a + b, 0)} retiros · ${M.ingresos.reduce((a, b) => a + b, 0)} ingresos`, trend: M.retiros }),
    VZ.kpi({ label: 'Permisos del mes', value: VZ.num(permAct), icon: '🗓', tone: 'purple',
             delta: VZ.pctVar(permAct, permAnt), deltaGoodUp: false, sub: 'vs. mes anterior', trend: M.permMes, onclick: "showView('permisos-admin')" }),
    VZ.kpi({ label: 'Procesos disciplinarios', value: VZ.num(discAbiertos), icon: '⚖️', tone: discAbiertos ? 'orange' : 'green',
             sub: 'abiertos', onclick: "showView('disciplinarios')" }),
  ].join('');

  // Distribución
  const porArea = SC.areas.map(a => ({ label: a.name, value: M.activos.filter(e => String(e.areaId) === String(a.id)).length }))
    .filter(x => x.value);
  const porEmpresa = SC.empresas.map((em, i) => ({ label: em.name, value: M.activos.filter(e => e.empresaId === em.id).length, color: em.color || VZ.PALETA[i] }))
    .filter(x => x.value);
  const VINC = { directo: ['Directo', 'navy'], contratista: ['Contratista', 'purple'], temporal: ['Temporal', 'amber'], practicante: ['Practicante', 'blue'], tercero: ['Tercero', 'slate'] };
  const porVinc = Object.entries(VINC).map(([k, [t, c]]) => ({ label: t, color: c, value: M.activos.filter(e => (e.tipoVinculacion || 'directo') === k).length }));

  const labels6 = M.m6.map(m => m.label);
  const fila1 = [
    VZ.panel('Colaboradores por área', VZ.bars(porArea, { limit: 10 }), { sub: 'Activos', span: 5 }),
    VZ.panel('Por empresa', VZ.donut(porEmpresa, { centerSub: 'activos' }), { span: 4 }),
    VZ.panel('Tipo de vinculación', VZ.donut(porVinc, { centerSub: 'activos' }), { span: 3 }),
  ].join('');
  const fila2 = [
    VZ.panel('Novedades de ausentismo', VZ.columns(labels6, [
      { name: 'Permisos', values: M.permMes, color: 'purple' },
      { name: 'Incapacidades', values: M.incMes, color: 'red' },
      { name: 'Vacaciones', values: M.vacMes, color: 'teal' },
    ], { stacked: true }), { sub: 'Solicitudes por mes · últimos 6 meses', span: 7 }),
    VZ.panel('Evolución de la planta', VZ.line(M.meses.map(m => m.label), [
      { name: 'Colaboradores', values: M.headcount, color: 'navy' },
    ]), { sub: 'Colaboradores al cierre de cada mes · 12 meses', span: 5 }),
  ].join('');

  el.innerHTML = `
    <div class="vz-head">
      <h2>${VZ.esc(titulo)}<small>Indicadores en tiempo real · corte ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</small></h2>
      <div class="vz-head-actions"><span class="vz-stamp">Haz clic en una tarjeta para ir al módulo</span></div>
    </div>
    <div class="vz-kpis">${kpis}</div>
    <div class="vz-grid">${fila1}</div>
    <div class="vz-grid">${fila2}</div>
    ${compacto ? '' : `
    <div class="vz-grid">${VZ.panel('Flujo de solicitudes', tbKanbanSolicitudes(M), { sub: 'Permisos, vacaciones e incapacidades por estado · aprobadas y rechazadas de los últimos 30 días', span: 12 })}</div>
    <div class="vz-grid">${VZ.panel('Procesos disciplinarios por etapa', tbKanbanDisciplinarios(M.discs), { sub: 'Debido proceso · 8 etapas agrupadas', span: 12 })}</div>`}`;
}
window.renderTableroAnalitico = renderTableroAnalitico;

// ─── Kanban de solicitudes ───────────────────────────────────
function tbKanbanSolicitudes(M) {
  const reciente = f => { const d = tbDiasDesde(f); return d == null || d <= 30; };
  const cards = [];
  M.perms.forEach(p => cards.push({
    estado: p.status, fecha: p.inicio, id: 'p:' + p.id,
    title: tbNom(p.empId),
    sub: `${typeof tipoPermisoLabel === 'function' ? tipoPermisoLabel(p.tipo) : p.tipo} · ${p.inicio || ''}${p.esPorHoras ? ` ${p.horaInicio || ''}–${p.horaFin || ''}` : ''}`,
    chips: [{ t: '🗓 Permiso', c: 'purple' }, { t: p.esPorHoras ? `${p.dias || 0} h` : `${p.dias || 0} d` }],
    onclick: `openPermisoDetail('${p.id}')`, color: '#7c3aed',
  }));
  M.vacs.forEach(v => cards.push({
    estado: v.estado, fecha: v.inicio, id: 'v:' + v.id,
    title: tbNom(v.empId), sub: `Vacaciones · ${v.inicio || ''} → ${v.fin || ''}`,
    chips: [{ t: '🏖 Vacaciones', c: 'blue' }, { t: `${v.dias || 0} d` }],
    onclick: `showView('vacaciones-admin')`, color: '#0d9488',
  }));
  M.incs.forEach(i => cards.push({
    estado: i.status === 'pendiente' ? 'pendiente' : (i.status === 'rechazado' ? 'rechazado' : 'aprobado'),
    fecha: i.fechaInicio, id: 'i:' + i.id,
    title: tbNom(i.empId), sub: `Incapacidad · ${i.fechaInicio || ''} · ${i.eps || ''}`,
    chips: [{ t: '🏥 Incapacidad', c: 'red' }, { t: `${i.dias || 0} d` }, ...(i.requiereEpicrisis ? [{ t: 'Epicrisis', c: 'amber' }] : [])],
    onclick: `showView('incapacidades-admin')`, color: '#dc2626',
  }));
  const ord = (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''));
  const col = (key, title, color, filtro) => ({ key, title, color, cards: cards.filter(filtro).sort(ord) });
  return VZ.kanban([
    col('pendiente',  'Por gestionar',  'amber',  c => c.estado === 'pendiente'),
    col('aclaracion', 'En aclaración',  'orange', c => c.estado === 'aclaracion'),
    col('aprobado',   'Aprobadas',      'green',  c => c.estado === 'aprobado' && reciente(c.fecha)),
    col('rechazado',  'Rechazadas',     'red',    c => c.estado === 'rechazado' && reciente(c.fecha)),
  ], { limit: 12 });
}

// ─── Kanban disciplinario ────────────────────────────────────
const TB_GRUPOS_DISC = [
  { key: 'inicio',   title: 'Solicitud y apertura',   color: 'slate',  etapas: ['solicitud', 'apertura'] },
  { key: 'notif',    title: 'Notificación y pruebas', color: 'blue',   etapas: ['notificacion', 'traslado_pruebas'] },
  { key: 'defensa',  title: 'Descargos y evaluación', color: 'amber',  etapas: ['descargos', 'evaluacion'] },
  { key: 'decision', title: 'Decisión e impugnación', color: 'purple', etapas: ['decision', 'impugnacion'] },
  { key: 'cerrado',  title: 'Cerrados',               color: 'green',  etapas: [] },
];
function tbKanbanDisciplinarios(discs, { limit = 10 } = {}) {
  const tipoLbl = t => (typeof TIPOS_DISCIPLINARIO !== 'undefined' && TIPOS_DISCIPLINARIO[t]?.label) || 'Sin tipo';
  const cerrado = d => ['cerrado', 'archivado', 'sancionado'].includes(d.estado);
  const cols = TB_GRUPOS_DISC.map(g => ({
    key: g.key, title: g.title, color: g.color,
    cards: discs.filter(d => g.key === 'cerrado' ? cerrado(d) : (!cerrado(d) && g.etapas.includes(d.etapaActual || 'solicitud')))
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
      .map(d => {
        const dias = tbDiasDesde(d.fecha);
        const chips = [{ t: tipoLbl(d.tipo) }];
        if (!cerrado(d) && dias != null) chips.push({ t: `${dias} días`, c: dias > 30 ? 'red' : dias > 15 ? 'amber' : 'blue' });
        if (d.estado === 'pendiente_apertura') chips.push({ t: 'Pendiente apertura', c: 'amber' });
        if (d.requiereVistoBuenoLider && d.vistoBuenolider === null) chips.push({ t: 'Visto bueno pendiente', c: 'amber' });
        const et = typeof getEtapaNombre === 'function' ? getEtapaNombre(d.etapaActual) : d.etapaActual;
        return { id: d.id, title: tbNom(d.empId), sub: cerrado(d) ? `Cerrado · ${d.fecha || ''}` : `${et} · desde ${d.fecha || ''}`,
                 chips, onclick: `openDiscDetail('${d.id}')` };
      }),
  }));
  return VZ.kanban(cols, { limit });
}
window.tbKanbanDisciplinarios = tbKanbanDisciplinarios;

// ═══════════════════════════════════════════════════════════════
// SELECTOR TABLA / KANBAN EN PERMISOS Y DISCIPLINARIOS
// ═══════════════════════════════════════════════════════════════
let TB_VISTA_PERM = 'tabla';
let TB_VISTA_DISC = 'tabla';
try { TB_VISTA_PERM = localStorage.getItem('sc_vista_perm') || 'tabla'; TB_VISTA_DISC = localStorage.getItem('sc_vista_disc') || 'tabla'; } catch (e) {}

function tbSetVistaPerm(v) { TB_VISTA_PERM = v; try { localStorage.setItem('sc_vista_perm', v); } catch (e) {} renderPermisosAdmin(); }
function tbSetVistaDisc(v) { TB_VISTA_DISC = v; try { localStorage.setItem('sc_vista_disc', v); } catch (e) {} renderDisciplinarios(); }
window.tbSetVistaPerm = tbSetVistaPerm;
window.tbSetVistaDisc = tbSetVistaDisc;

function tbAsegurarContenedor(viewId, tbodyId, kanbanId, toggleId, onchange, actual) {
  const view = document.getElementById(viewId);
  const tbody = document.getElementById(tbodyId);
  if (!view || !tbody) return null;
  const tablaCard = tbody.closest('.glass-card');
  if (!tablaCard) return null;
  let tg = document.getElementById(toggleId);
  if (!tg) {
    tg = document.createElement('div');
    tg.id = toggleId;
    tg.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:10px';
    tablaCard.parentNode.insertBefore(tg, tablaCard);
  }
  tg.innerHTML = VZ.toggle(actual, [{ k: 'tabla', t: '☰ Tabla' }, { k: 'kanban', t: '▦ Kanban' }], onchange);
  let kb = document.getElementById(kanbanId);
  if (!kb) {
    kb = document.createElement('div');
    kb.id = kanbanId;
    tablaCard.parentNode.insertBefore(kb, tablaCard.nextSibling);
  }
  tablaCard.style.display = actual === 'kanban' ? 'none' : '';
  kb.style.display = actual === 'kanban' ? '' : 'none';
  return kb;
}

function tbRenderKanbanPermisos() {
  const kb = tbAsegurarContenedor('view-permisos-admin', 'permisos-admin-tbody', 'permisos-kanban', 'permisos-vista-toggle', 'tbSetVistaPerm', TB_VISTA_PERM);
  if (!kb || TB_VISTA_PERM !== 'kanban') return;
  const vis = SC.permisos.filter(p => tbVis(p.empId));
  const card = p => {
    const chips = [{ t: p.esPorHoras ? `${p.dias || 0} h` : `${p.dias || 0} d` }];
    if (p.status === 'pendiente' && p.aclaraciones?.length && p.aclaraciones[p.aclaraciones.length - 1].tipo === 'respuesta') chips.push({ t: '↩️ Respondió', c: 'blue' });
    if (p.fileName || p.fileUrl) chips.push({ t: '📎 Soporte', c: 'green' });
    if (typeof esPermisoMenor === 'function' && esPermisoMenor(p) && p.status === 'pendiente') chips.push({ t: 'Aprueba jefe', c: 'purple' });
    let actions = '';
    if (p.status === 'pendiente' && typeof puedeAprobarPermiso === 'function' && puedeAprobarPermiso(p)) {
      actions = `<button class="btn btn-ghost btn-sm" onclick="actualizarPermiso('${p.id}','aprobado')" title="Aprobar">✅</button>
                 <button class="btn btn-ghost btn-sm" onclick="actualizarPermiso('${p.id}','rechazado')" title="Rechazar">❌</button>
                 <button class="btn btn-ghost btn-sm" onclick="openSolicitarAclaracion('${p.id}')" title="Solicitar aclaración">💬</button>`;
    }
    return { id: p.id, title: tbNom(p.empId),
             sub: `${typeof tipoPermisoLabel === 'function' ? tipoPermisoLabel(p.tipo) : p.tipo} · ${p.inicio || ''}${p.esPorHoras ? ` ${p.horaInicio || ''}–${p.horaFin || ''}` : ` → ${p.fin || ''}`}${p.motivo ? ' · ' + p.motivo : ''}`,
             chips, actions, onclick: `openPermisoDetail('${p.id}')` };
  };
  const ord = (a, b) => String(b.inicio || '').localeCompare(String(a.inicio || ''));
  const col = (key, title, color) => ({ key, title, color, cards: vis.filter(p => p.status === key).sort(ord).map(card) });
  kb.innerHTML = VZ.kanban([
    col('pendiente', 'Pendientes', 'amber'),
    col('aclaracion', 'En aclaración', 'orange'),
    col('aprobado', 'Aprobados', 'green'),
    col('rechazado', 'Rechazados', 'red'),
  ], { limit: 40 });
}
window.tbRenderKanbanPermisos = tbRenderKanbanPermisos;

function tbRenderKanbanDisciplinarios() {
  const kb = tbAsegurarContenedor('view-disciplinarios', 'disc-tbody', 'disc-kanban', 'disc-vista-toggle', 'tbSetVistaDisc', TB_VISTA_DISC);
  if (!kb || TB_VISTA_DISC !== 'kanban') return;
  const vis = (SC.disciplinarios || []).filter(d => {
    if (SC.user?.role !== 'lider_area') return true;
    const a = SC.user?.areaId != null && SC.user.areaId !== '' ? String(SC.user.areaId) : null;
    if (!a) return false;
    return tbVis(d.empId) || String(d.areaIdSolicitante || '') === a || String(d.liderOtraAreaId || '') === a;
  });
  kb.innerHTML = tbKanbanDisciplinarios(vis, { limit: 40 });
}
window.tbRenderKanbanDisciplinarios = tbRenderKanbanDisciplinarios;

// ─── Panel Gerencia: anteponer el tablero ejecutivo al Resumen ─
(function envolverGerTab() {
  if (typeof window.gerTab !== 'function' || window.gerTab.__tb) return;
  const original = window.gerTab;
  const envuelto = function (tab, el) {
    original(tab, el);
    if (tab === 'resumen') {
      const c = document.getElementById('ger-content');
      if (!c) return;
      const box = document.createElement('div');
      box.style.marginBottom = '20px';
      c.insertBefore(box, c.firstChild);
      renderTableroAnalitico(box, { titulo: 'Tablero ejecutivo de Talento Humano' });
    }
  };
  envuelto.__tb = true;
  window.gerTab = envuelto;
})();
