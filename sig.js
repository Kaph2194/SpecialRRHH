// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH · SISTEMA DE GESTIÓN POR ÁREA
// Biblioteca de manuales, procesos, procedimientos, instructivos,
// formatos y políticas + KPI de cada área, con tableros y kanban.
//
// Áreas: Gerencia, Recursos Humanos y cada área de la empresa (la del
// líder HSEQ incluida). Quién gestiona qué:
//   · Super Admin ............ todas las áreas
//   · Analista / Líder RRHH .. Recursos Humanos (ve todas)
//   · Gerencia ............... Gerencia (ve todas)
//   · Jurídica ............... solo consulta (ve todas)
//   · Líder de área / HSEQ ... su propia área
// La regla real está en Supabase (RLS + bucket privado 'sig'), ver
// supabase_sig_pesv.sql. Aquí solo se oculta la interfaz.
// Usa sigSubir / sigAbrir / sigBorrar / sigNombreSeguro de pesv.js.
// ═══════════════════════════════════════════════════════════════

const SIG_TIPOS = [
  { k: 'manual',        t: 'Manual',        icon: '📘', c: '#2563eb' },
  { k: 'proceso',       t: 'Proceso',       icon: '🔁', c: '#0d9488' },
  { k: 'procedimiento', t: 'Procedimiento', icon: '📋', c: '#7c3aed' },
  { k: 'instructivo',   t: 'Instructivo',   icon: '🧭', c: '#ea580c' },
  { k: 'formato',       t: 'Formato',       icon: '🗂', c: '#0ea5e9' },
  { k: 'politica',      t: 'Política',      icon: '🏛', c: '#111f4d' },
  { k: 'otro',          t: 'Otro',          icon: '📄', c: '#64748b' },
];
const SIG_ESTADOS = [
  { k: 'borrador', t: 'Borrador',    c: 'slate' },
  { k: 'revision', t: 'En revisión', c: 'amber' },
  { k: 'vigente',  t: 'Vigente',     c: 'green' },
  { k: 'obsoleto', t: 'Obsoleto',    c: 'red' },
];
const SIG_FRECUENCIAS = { mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
const SIG_MAX_BYTES = 10 * 1024 * 1024;
const SG = { docs: [], kpis: [], cargado: false, error: null, area: null, tab: null, tipo: 'todos', vistaDocs: 'tarjetas', q: '' };

// ─── Permisos ────────────────────────────────────────────────
const sigRol = () => SC.user?.role;
function sigVeTodo() { return ['superadmin', 'gerencia', 'juridico', 'analista_rrhh', 'lider_rrhh'].includes(sigRol()); }
function sigPuedeGestionar(key) {
  const r = sigRol();
  if (r === 'superadmin') return true;
  if (r === 'analista_rrhh' || r === 'lider_rrhh') return key === 'rrhh';
  if (r === 'gerencia') return key === 'gerencia';
  if (r === 'lider_area') return SC.user?.areaId != null && SC.user.areaId !== '' && key === 'area-' + SC.user.areaId;
  return false;
}
function sigPuedeVer() { return sigVeTodo() || (sigRol() === 'lider_area' && SC.user?.areaId != null && SC.user.areaId !== ''); }
window.sigPuedeVer = sigPuedeVer;
window.sigPuedeGestionar = sigPuedeGestionar;

function sigAreas() {
  const base = [{ key: 'gerencia', nombre: 'Gerencia', icon: '🏛' }, { key: 'rrhh', nombre: 'Recursos Humanos', icon: '👥' }];
  // Las áreas de la empresa que corresponden a RH o a Gerencia ya están cubiertas por los
  // espacios 'rrhh' y 'gerencia': no se repiten en la lista general (salvo que ya tengan contenido).
  const duplicada = a => /recursos humanos|gesti[oó]n humana|talento humano|^gerencia/i.test(a.name || '')
    && !SG.docs.some(d => d.area_key === 'area-' + a.id) && !SG.kpis.some(k => k.area_key === 'area-' + a.id);
  (SC.areas || []).forEach(a => {
    if (sigVeTodo() && duplicada(a) && String(a.id) !== String(SC.user?.areaId)) return;
    base.push({ key: 'area-' + a.id, nombre: a.name, icon: a.icon || '📁' });
  });
  if (sigVeTodo()) return base;
  return base.filter(a => a.key === 'area-' + SC.user?.areaId);
}
const sigAreaNombre = k => sigAreas().find(a => a.key === k)?.nombre || (SC.areas || []).find(a => 'area-' + a.id === k)?.name || k;
const sigTipo = k => SIG_TIPOS.find(t => t.k === k) || SIG_TIPOS[SIG_TIPOS.length - 1];
const sigHoy = () => new Date().toISOString().slice(0, 10);

// ─── Menú lateral (PESV + Biblioteca) ───────────────────────
function agregarNavSIG(nav) {
  if (!SC.user || SC.user.role === 'empleado') return;
  const verPesv = typeof pesvPuedeVer === 'function' && pesvPuedeVer();
  if (!sigPuedeVer() && !verPesv) return;
  addNavSep(nav, 'SISTEMA DE GESTIÓN');
  if (sigPuedeVer()) addNavItem(nav, '📚', 'Procesos y KPI por área', 'biblioteca');
  if (verPesv) addNavItem(nav, '🚦', 'PESV · Seguridad Vial', 'pesv');
}
window.agregarNavSIG = agregarNavSIG;

// ─── Carga ───────────────────────────────────────────────────
function sigJson(v, def) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? def); } catch (e) { return def; } }
async function sigCargar() {
  const [docs, kpis] = await Promise.all([
    sbFetch('sig_documentos', 'GET', null, '?select=*&order=area_key.asc,tipo.asc,codigo.asc'),
    sbFetch('sig_kpis', 'GET', null, '?select=*&order=area_key.asc,nombre.asc'),
  ]);
  SG.cargado = true;
  if (docs === null || kpis === null) { SG.error = 'tabla'; return; }
  SG.error = null;
  SG.docs = docs;
  SG.kpis = kpis.map(k => ({ ...k, mediciones: sigJson(k.mediciones, []) || [] }));
}

// ═══════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════════════════════════════
async function renderBiblioteca(tab) {
  const root = document.getElementById('biblioteca-root');
  if (!root) return;
  if (!sigPuedeVer()) { root.innerHTML = VZ.empty('No tienes acceso a esta sección.'); return; }
  if (!SG.cargado) { root.innerHTML = '<div class="vz-empty">Cargando…</div>'; await sigCargar(); }
  if (SG.error) {
    root.innerHTML = `<div class="glass-card p-4" style="border-left:4px solid var(--amber)"><b>La biblioteca aún no está activada en la base de datos.</b>
      <div class="text-sm text-muted mt-2">Ejecuta el script <code>supabase_sig_pesv.sql</code> en Supabase → SQL Editor y vuelve a abrir esta sección.</div></div>`;
    return;
  }
  const areas = sigAreas();
  if (!SG.area || (SG.area !== 'todas' && !areas.some(a => a.key === SG.area)) || (SG.area === 'todas' && !sigVeTodo())) SG.area = sigVeTodo() ? 'todas' : areas[0]?.key;
  if (tab) SG.tab = tab;
  if (!SG.tab) SG.tab = 'resumen';

  const cuenta = k => SG.docs.filter(d => d.area_key === k).length + SG.kpis.filter(x => x.area_key === k).length;
  const pills = `<div class="vz-pills">
    ${sigVeTodo() ? `<button class="vz-pill ${SG.area === 'todas' ? 'on' : ''}" onclick="SG.area='todas';renderBiblioteca()">🌐 Todas las áreas</button>` : ''}
    ${areas.map(a => `<button class="vz-pill ${SG.area === a.key ? 'on' : ''}" onclick="SG.area='${a.key}';renderBiblioteca()">${a.icon} ${VZ.esc(a.nombre)}${cuenta(a.key) ? `<span class="n">${cuenta(a.key)}</span>` : ''}</button>`).join('')}</div>`;
  const gestiona = SG.area !== 'todas' && sigPuedeGestionar(SG.area);
  const nAl = sigAlertas().filter(a => a.nivel === 'alta').length;
  const tabs = [['resumen', '📊 Tablero'], ['documentos', '📚 Documentos'], ['kpi', '🎯 KPI'], ['reportes', '📑 Reportes'],
                ['alertas', '🚨 Alertas' + (nAl ? ` (${nAl})` : '')]];
  root.innerHTML = `
    <div class="vz-head">
      <h2>Procesos, documentos y KPI${SG.area !== 'todas' ? ' · ' + VZ.esc(sigAreaNombre(SG.area)) : ''}<small>Manuales, procesos, procedimientos, instructivos, formatos e indicadores de cada área</small></h2>
      <div class="vz-head-actions">
        ${gestiona ? `<button class="btn btn-ghost btn-sm" onclick="sigNuevoKPI()">+ Nuevo KPI</button>
          <button class="btn btn-primary btn-sm" onclick="sigNuevoDoc()">+ Cargar documento</button>` : ''}
      </div>
    </div>
    <div class="glass-card p-3 mb-3">${pills}</div>
    ${SG.area !== 'todas' && !gestiona ? '<div class="readonly-banner mb-3"><span>🔒</span><span>Consulta: no gestionas esta área</span></div>' : ''}
    <div class="tabs mb-4">${tabs.map(([k, t]) => `<div class="tab ${SG.tab === k ? 'active' : ''}" onclick="renderBiblioteca('${k}')">${t}</div>`).join('')}</div>
    <div id="sig-body"></div>`;
  const body = document.getElementById('sig-body');
  ({ resumen: sigResumen, documentos: sigDocumentos, kpi: sigKPIs, reportes: sigReportes, alertas: sigAlertasVista })[SG.tab]?.(body);
}
window.renderBiblioteca = renderBiblioteca;

const sigDocsArea = () => SG.docs.filter(d => SG.area === 'todas' ? sigAreas().some(a => a.key === d.area_key) : d.area_key === SG.area);
const sigKpisArea = () => SG.kpis.filter(k => SG.area === 'todas' ? sigAreas().some(a => a.key === k.area_key) : k.area_key === SG.area);

function sigUltimaMedicion(k) {
  const m = (k.mediciones || []).filter(x => x.valor != null && x.valor !== '').sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
  return m[m.length - 1] || null;
}
const sigMeta = k => (k.meta == null || k.meta === '' ? null : Number(k.meta));
function sigSemaforoKPI(k) {
  const u = sigUltimaMedicion(k);
  return VZ.semaforo(u ? Number(u.valor) : null, sigMeta(k), k.sentido || 'mayor');
}

// ─── Tablero ────────────────────────────────────────────────
function sigResumen(el) {
  const docs = sigDocsArea(), kpis = sigKpisArea(), hoy = sigHoy();
  const vig = docs.filter(d => d.estado === 'vigente').length;
  const porRevisar = docs.filter(d => d.estado !== 'obsoleto' && d.fecha_revision && d.fecha_revision < hoy).length;
  const enRev = docs.filter(d => d.estado === 'revision' || d.estado === 'borrador').length;
  const sem = kpis.map(sigSemaforoKPI);
  const enMeta = sem.filter(s => s.k === 'verde').length, medidos = sem.filter(s => s.k !== 'gris').length;
  const kpiTiles = [
    VZ.kpi({ label: 'Documentos vigentes', value: VZ.num(vig), icon: '📚', tone: 'navy', sub: `de ${docs.length} documentos`, onclick: "renderBiblioteca('documentos')" }),
    VZ.kpi({ label: 'Revisión vencida', value: VZ.num(porRevisar), icon: '⏰', tone: porRevisar ? 'red' : 'green', sub: porRevisar ? 'requieren actualización' : 'todo al día' }),
    VZ.kpi({ label: 'En elaboración o revisión', value: VZ.num(enRev), icon: '✍️', tone: 'amber', sub: 'borradores y en revisión' }),
    VZ.kpi({ label: 'KPI en meta', value: medidos ? VZ.num(enMeta / medidos * 100, 0) : '—', unit: medidos ? '%' : '', icon: '🎯', tone: medidos && enMeta / medidos >= .8 ? 'green' : 'amber', sub: `${enMeta} de ${medidos} medidos · ${kpis.length} KPI`, onclick: "renderBiblioteca('kpi')" }),
  ].join('');
  const areas = sigAreas();
  const porArea = areas.map(a => ({ label: a.nombre, value: docs.filter(d => d.area_key === a.key).length, onclick: `SG.area='${a.key}';renderBiblioteca('documentos')` })).filter(x => x.value);
  const porTipo = SIG_TIPOS.map(t => ({ label: t.t, value: docs.filter(d => d.tipo === t.k).length, color: t.c }));
  const semDonut = VZ.donut([
    { label: 'En meta', value: sem.filter(s => s.k === 'verde').length, color: 'green' },
    { label: 'En riesgo', value: sem.filter(s => s.k === 'amarillo').length, color: 'amber' },
    { label: 'Fuera de meta', value: sem.filter(s => s.k === 'rojo').length, color: 'red' },
    { label: 'Sin medir', value: sem.filter(s => s.k === 'gris').length, color: '#cbd5e1' },
  ], { centerSub: 'KPI' });
  // Matriz área × semáforo
  const filas = areas.map(a => {
    const d = SG.docs.filter(x => x.area_key === a.key), k = SG.kpis.filter(x => x.area_key === a.key), s = k.map(sigSemaforoKPI);
    const med = s.filter(x => x.k !== 'gris').length, ok = s.filter(x => x.k === 'verde').length;
    if (!d.length && !k.length) return '';
    return `<tr style="cursor:pointer" onclick="SG.area='${a.key}';renderBiblioteca('resumen')"><td><b>${a.icon} ${VZ.esc(a.nombre)}</b></td><td>${d.length}</td><td>${d.filter(x => x.estado === 'vigente').length}</td><td>${k.length}</td>
      <td>${ok}</td><td>${s.filter(x => x.k === 'amarillo').length}</td><td>${s.filter(x => x.k === 'rojo').length}</td>
      <td style="min-width:130px">${med ? VZ.progress(ok / med * 100) + `<span class="text-xs">${VZ.num(ok / med * 100, 0)}%</span>` : '<span class="text-xs text-muted">sin medir</span>'}</td></tr>`;
  }).join('');
  const matriz = SG.area === 'todas' ? `<div style="overflow-x:auto"><table class="data-table" style="font-size:12px"><thead><tr><th>Área</th><th>Docs</th><th>Vigentes</th><th>KPI</th><th style="color:#16a34a">● En meta</th><th style="color:#b45309">● Riesgo</th><th style="color:#dc2626">● Fuera</th><th>KPI en meta</th></tr></thead><tbody>
    ${filas || '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:16px">Aún no hay documentos ni KPI cargados</td></tr>'}</tbody></table></div>` : '';
  el.innerHTML = `<div class="vz-kpis">${kpiTiles}</div>
    <div class="vz-grid">
      ${SG.area === 'todas' ? VZ.panel('Documentos por área', VZ.bars(porArea), { span: 5 }) : ''}
      ${VZ.panel('Documentos por tipo', VZ.donut(porTipo, { centerSub: 'documentos' }), { span: SG.area === 'todas' ? 4 : 6 })}
      ${VZ.panel('Semáforo de KPI', semDonut, { span: SG.area === 'todas' ? 3 : 6 })}
    </div>
    ${matriz ? `<div class="vz-grid">${VZ.panel('Matriz de desempeño por área', matriz, { sub: 'Haz clic en un área para ver su tablero', span: 12 })}</div>` : ''}
    ${SG.area !== 'todas' && kpis.length ? `<div class="vz-grid">${VZ.panel('KPI del área', `<div class="vz-kpis" style="margin:0">${kpis.map(sigTileKPI).join('')}</div>`, { span: 12 })}</div>` : ''}`;
}

// ─── Documentos ─────────────────────────────────────────────
function sigDocumentos(el) {
  const hoy = sigHoy();
  let docs = sigDocsArea();
  if (SG.tipo !== 'todos') docs = docs.filter(d => d.tipo === SG.tipo);
  if (SG.q) { const q = SG.q.toLowerCase(); docs = docs.filter(d => `${d.codigo || ''} ${d.nombre || ''} ${d.descripcion || ''} ${d.responsable || ''}`.toLowerCase().includes(q)); }
  const filtros = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
    <div class="vz-pills"><button class="vz-pill ${SG.tipo === 'todos' ? 'on' : ''}" onclick="SG.tipo='todos';renderBiblioteca()">Todos</button>
      ${SIG_TIPOS.map(t => `<button class="vz-pill ${SG.tipo === t.k ? 'on' : ''}" onclick="SG.tipo='${t.k}';renderBiblioteca()">${t.icon} ${t.t}</button>`).join('')}</div>
    <span style="flex:1"></span>
    <input class="form-input" id="sig-buscar" style="width:220px;padding:6px 10px" placeholder="🔍 Buscar código o nombre" value="${VZ.esc(SG.q)}" oninput="sigBuscar(this.value)">
    ${VZ.toggle(SG.vistaDocs, [{ k: 'tarjetas', t: '▤ Tarjetas' }, { k: 'kanban', t: '▦ Kanban' }], 'sigVistaDocs')}</div>`;
  if (!docs.length) { el.innerHTML = filtros + VZ.empty(SG.area !== 'todas' && sigPuedeGestionar(SG.area) ? 'Aún no hay documentos. Usa "+ Cargar documento".' : 'No hay documentos para mostrar.'); return; }
  if (SG.vistaDocs === 'kanban') {
    const gest = SG.area !== 'todas' && sigPuedeGestionar(SG.area);
    el.innerHTML = filtros + `<div class="text-xs text-muted mb-2">${gest ? 'Arrastra un documento a otra columna para cambiar su estado.' : ''}</div>` +
      VZ.kanban(SIG_ESTADOS.map(s => ({ key: s.k, title: s.t, color: s.c,
        cards: docs.filter(d => (d.estado || 'vigente') === s.k).map(d => {
          const t = sigTipo(d.tipo), venc = d.estado !== 'obsoleto' && d.fecha_revision && d.fecha_revision < hoy;
          return { id: d.id, title: `${d.codigo ? d.codigo + ' · ' : ''}${d.nombre}`, color: t.c,
                   sub: `${t.icon} ${t.t} · v${d.version || '1'}${SG.area === 'todas' ? ' · ' + sigAreaNombre(d.area_key) : ''}`,
                   chips: [...(venc ? [{ t: '⏰ Revisión vencida', c: 'red' }] : []), ...(d.archivo_nombre ? [{ t: '📎 Archivo', c: 'blue' }] : [])],
                   onclick: d.archivo_ruta ? `sigAbrir('${VZ.esc(d.archivo_ruta)}')` : '' };
        }) })), { limit: 60, onDrop: gest ? 'sigMoverDoc' : null });
    return;
  }
  const grupos = SIG_TIPOS.filter(t => docs.some(d => d.tipo === t.k));
  el.innerHTML = filtros + grupos.map(t => `
    <div style="margin-bottom:18px"><div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:8px">${t.icon} ${t.t}${t.k === 'otro' ? 's' : t.t.endsWith('n') ? 'es' : 's'} <span class="text-xs text-muted">(${docs.filter(d => d.tipo === t.k).length})</span></div>
    <div class="vz-doc-grid">${docs.filter(d => d.tipo === t.k).map(d => {
      const est = SIG_ESTADOS.find(s => s.k === (d.estado || 'vigente')) || SIG_ESTADOS[2];
      const venc = d.estado !== 'obsoleto' && d.fecha_revision && d.fecha_revision < hoy;
      const g = sigPuedeGestionar(d.area_key);
      return `<div class="vz-doc" style="--doc-c:${t.c}">
        <div class="vz-doc-ico">${t.icon}</div>
        <div style="flex:1;min-width:0">
          ${d.codigo ? `<div class="text-xs" style="font-weight:700;color:${t.c};letter-spacing:.4px">${VZ.esc(d.codigo)}</div>` : ''}
          <div style="font-weight:700;font-size:13px;color:var(--navy);line-height:1.3">${VZ.esc(d.nombre)}</div>
          <div class="text-xs text-muted" style="margin-top:2px">v${VZ.esc(d.version || '1')}${d.fecha_emision ? ' · ' + VZ.esc(d.fecha_emision) : ''}${d.responsable ? ' · ' + VZ.esc(d.responsable) : ''}${SG.area === 'todas' ? ' · ' + VZ.esc(sigAreaNombre(d.area_key)) : ''}</div>
          <div class="vz-card-meta"><span class="vz-chip ${est.c === 'slate' ? '' : 'c-' + est.c}">${est.t}</span>
            ${venc ? '<span class="vz-chip c-red">⏰ Revisión vencida</span>' : d.fecha_revision ? `<span class="vz-chip">Revisión ${VZ.esc(d.fecha_revision)}</span>` : ''}</div>
          <div class="vz-card-actions" style="justify-content:flex-start">
            ${d.archivo_ruta ? `<button class="btn btn-ghost btn-sm" onclick="sigAbrir('${VZ.esc(d.archivo_ruta)}')">👁️ Ver</button>` : '<span class="text-xs text-muted">Sin archivo</span>'}
            ${g ? `<button class="btn btn-ghost btn-sm" onclick="sigEditarDoc('${VZ.esc(d.id)}')">✏️ Editar</button>
                   <button class="btn btn-ghost btn-sm" onclick="sigEliminarDoc('${VZ.esc(d.id)}')" title="Eliminar">🗑</button>` : ''}
          </div></div></div>`;
    }).join('')}</div></div>`).join('');
}
function sigVistaDocs(v) { SG.vistaDocs = v; renderBiblioteca(); }
function sigBuscar(v) {
  SG.q = v; clearTimeout(SG.qT);
  SG.qT = setTimeout(() => {
    renderBiblioteca();
    const i = document.getElementById('sig-buscar');
    if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }, 350);
}
window.sigVistaDocs = sigVistaDocs; window.sigBuscar = sigBuscar;

async function sigMoverDoc(id, estado) {
  const d = SG.docs.find(x => x.id === id);
  if (!d || !sigPuedeGestionar(d.area_key) || d.estado === estado || !SIG_ESTADOS.some(s => s.k === estado)) return;
  const r = await sbFetch('sig_documentos', 'PATCH', { estado, updated_at: new Date().toISOString() }, `?id=eq.${encodeURIComponent(id)}`);
  if (r === null) { showNotif('No se pudo cambiar el estado', 'error'); return; }
  d.estado = estado;
  if (typeof registrarAuditoria === 'function') registrarAuditoria('estado_documento', 'sig', id, `${d.codigo || d.nombre} → ${estado}`);
  renderBiblioteca();
}
window.sigMoverDoc = sigMoverDoc;

// Modal genérico
function sigModal(titulo, html, ancho = 640) {
  let m = document.getElementById('modal-sig');
  if (!m) {
    m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'modal-sig';
    m.innerHTML = `<div class="modal" style="width:96vw"><div class="modal-header"><div class="modal-title" id="sig-modal-titulo"></div>
      <button class="modal-close" onclick="closeModal('modal-sig')">✕</button></div><div class="modal-body" id="sig-modal-body" style="max-height:76vh;overflow:auto"></div></div>`;
    document.body.appendChild(m);
  }
  m.querySelector('.modal').style.maxWidth = ancho + 'px';
  document.getElementById('sig-modal-titulo').textContent = titulo;
  document.getElementById('sig-modal-body').innerHTML = html;
  openModal('modal-sig');
}

function sigFormDoc(d = {}) {
  const areas = sigAreas().filter(a => sigPuedeGestionar(a.key));
  const area = d.area_key || (SG.area !== 'todas' && sigPuedeGestionar(SG.area) ? SG.area : areas[0]?.key);
  return `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Área</label><select class="form-select" id="sd-area" ${d.id ? 'disabled' : ''}>${areas.map(a => `<option value="${a.key}" ${a.key === area ? 'selected' : ''}>${VZ.esc(a.nombre)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="sd-tipo">${SIG_TIPOS.map(t => `<option value="${t.k}" ${t.k === (d.tipo || 'procedimiento') ? 'selected' : ''}>${t.icon} ${t.t}</option>`).join('')}</select></div></div>
    <div class="form-row">
      <div class="form-group" style="flex:0 0 34%"><label class="form-label">Código</label><input class="form-input" id="sd-codigo" placeholder="GH-PR-01" value="${VZ.esc(d.codigo || '')}"></div>
      <div class="form-group"><label class="form-label">Nombre *</label><input class="form-input" id="sd-nombre" value="${VZ.esc(d.nombre || '')}"></div></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Versión</label><input class="form-input" id="sd-version" value="${VZ.esc(d.version || '1')}"></div>
      <div class="form-group"><label class="form-label">Fecha de emisión</label><input type="date" class="form-input" id="sd-emision" value="${VZ.esc(d.fecha_emision || sigHoy())}"></div>
      <div class="form-group"><label class="form-label">Próxima revisión</label><input type="date" class="form-input" id="sd-revision" value="${VZ.esc(d.fecha_revision || '')}"></div></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Responsable</label><input class="form-input" id="sd-resp" value="${VZ.esc(d.responsable || '')}"></div>
      <div class="form-group"><label class="form-label">Estado</label><select class="form-select" id="sd-estado">${SIG_ESTADOS.map(s => `<option value="${s.k}" ${s.k === (d.estado || 'vigente') ? 'selected' : ''}>${s.t}</option>`).join('')}</select></div></div>
    <div class="form-group"><label class="form-label">Descripción / alcance</label><textarea class="form-textarea" id="sd-desc" rows="2">${VZ.esc(d.descripcion || '')}</textarea></div>
    <div class="form-group"><label class="form-label">Archivo <span class="text-muted" style="font-weight:400">· máx. 10 MB${d.archivo_nombre ? ` · actual: ${VZ.esc(d.archivo_nombre)} (súbelo solo si lo reemplazas)` : ''}</span></label>
      <input type="file" class="form-input" id="sd-file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.vsdx,.bpmn"></div>
    <div class="flex gap-3 mt-2"><button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-sig')">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" id="sd-btn" onclick="sigGuardarDoc('${VZ.esc(d.id || '')}')">💾 Guardar</button></div>`;
}
function sigNuevoDoc() {
  if (!sigAreas().some(a => sigPuedeGestionar(a.key))) { showNotif('No gestionas ninguna área', 'error'); return; }
  sigModal('📚 Cargar documento', sigFormDoc());
}
function sigEditarDoc(id) {
  const d = SG.docs.find(x => x.id === id);
  if (!d || !sigPuedeGestionar(d.area_key)) return;
  sigModal('✏️ Editar documento', sigFormDoc(d));
}
window.sigNuevoDoc = sigNuevoDoc; window.sigEditarDoc = sigEditarDoc;

async function sigGuardarDoc(id) {
  const prev = id ? SG.docs.find(x => x.id === id) : null;
  const area = prev?.area_key || document.getElementById('sd-area').value;
  if (!sigPuedeGestionar(area)) { showNotif('No gestionas esta área', 'error'); return; }
  const nombre = document.getElementById('sd-nombre').value.trim();
  if (!nombre) { showNotif('Escribe el nombre del documento', 'error'); return; }
  const file = document.getElementById('sd-file').files[0];
  if (!prev && !file) { showNotif('Adjunta el archivo del documento', 'error'); return; }
  if (file && file.size > SIG_MAX_BYTES) { showNotif('⛔ El archivo supera 10 MB', 'error'); return; }
  const btn = document.getElementById('sd-btn'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }
  const fila = {
    id: prev?.id || 'sd' + Date.now() + Math.random().toString(36).slice(2, 5), area_key: area,
    tipo: document.getElementById('sd-tipo').value, codigo: document.getElementById('sd-codigo').value.trim(), nombre,
    version: document.getElementById('sd-version').value.trim() || '1', fecha_emision: document.getElementById('sd-emision').value || null,
    fecha_revision: document.getElementById('sd-revision').value || null, responsable: document.getElementById('sd-resp').value.trim(),
    estado: document.getElementById('sd-estado').value, descripcion: document.getElementById('sd-desc').value.trim(),
    archivo_ruta: prev?.archivo_ruta || null, archivo_nombre: prev?.archivo_nombre || null, archivo_tamano: prev?.archivo_tamano || 0,
    subido_por: SC.user?.name || '', updated_at: new Date().toISOString(),
  };
  let rutaNueva = null;
  try {
    if (file) {
      rutaNueva = `${area}/${fila.tipo}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${sigNombreSeguro(file.name)}`;
      await sigSubir(rutaNueva, file);
      fila.archivo_ruta = rutaNueva; fila.archivo_nombre = file.name; fila.archivo_tamano = file.size;
    }
    const r = await sbFetch('sig_documentos', 'POST', fila, '', { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
    if (r === null) throw new Error('no se pudo registrar en la base de datos');
  } catch (e) {
    if (rutaNueva) sigBorrar(rutaNueva).catch(() => {});
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    showNotif('No se pudo guardar: ' + e.message, 'error'); return;
  }
  // Al reemplazar el archivo, el anterior queda en el almacenamiento como respaldo de la versión previa
  if (prev) Object.assign(prev, fila); else SG.docs.push(fila);
  if (typeof registrarAuditoria === 'function') registrarAuditoria(prev ? 'editar_documento' : 'cargar_documento', 'sig', fila.id, `${sigAreaNombre(area)} · ${fila.codigo || ''} ${nombre}`);
  closeModal('modal-sig');
  showNotif(prev ? '✅ Documento actualizado' : '📚 Documento cargado');
  renderBiblioteca('documentos');
}
window.sigGuardarDoc = sigGuardarDoc;

async function sigEliminarDoc(id) {
  const d = SG.docs.find(x => x.id === id);
  if (!d || !sigPuedeGestionar(d.area_key)) return;
  if (!confirm(`¿Eliminar "${d.nombre}"? Si solo dejó de aplicar, mejor márcalo como "Obsoleto" para conservar el historial.`)) return;
  const r = await sbFetch('sig_documentos', 'DELETE', null, `?id=eq.${encodeURIComponent(id)}`);
  if (r === null) { showNotif('No se pudo eliminar', 'error'); return; }
  if (d.archivo_ruta) sigBorrar(d.archivo_ruta).catch(() => {});
  SG.docs = SG.docs.filter(x => x.id !== id);
  if (typeof registrarAuditoria === 'function') registrarAuditoria('eliminar_documento', 'sig', id, `${d.codigo || ''} ${d.nombre}`);
  showNotif('🗑 Documento eliminado');
  renderBiblioteca();
}
window.sigEliminarDoc = sigEliminarDoc;

// ─── KPI ────────────────────────────────────────────────────
function sigFmtKPI(v, k) {
  if (v == null || v === '') return '—';
  if (k.unidad === '$') return '$' + VZ.num(v);
  return VZ.num(v, 2) + (k.unidad ? (k.unidad === '%' ? '%' : ' ' + k.unidad) : '');
}
function sigTileKPI(k) {
  const u = sigUltimaMedicion(k), s = sigSemaforoKPI(k);
  const serie = (k.mediciones || []).slice().sort((a, b) => String(a.periodo).localeCompare(String(b.periodo))).map(m => Number(m.valor)).filter(v => !isNaN(v));
  return VZ.kpi({ label: k.nombre, value: u ? (k.unidad === '$' ? '$' + VZ.num(u.valor) : VZ.num(u.valor, 2)) : '—',
    unit: u && k.unidad && k.unidad !== '$' ? (k.unidad === '%' ? '%' : ' ' + k.unidad) : '',
    icon: s.k === 'verde' ? '🟢' : s.k === 'amarillo' ? '🟡' : s.k === 'rojo' ? '🔴' : '⚪', tone: s.c,
    sub: `Meta ${sigFmtKPI(k.meta, k)} · ${u ? u.periodo : 'sin medir'}`, trend: serie.slice(-12), onclick: `sigDetalleKPI('${k.id}')` });
}
function sigKPIs(el) {
  const kpis = sigKpisArea();
  if (!kpis.length) { el.innerHTML = VZ.empty(SG.area !== 'todas' && sigPuedeGestionar(SG.area) ? 'Aún no hay KPI. Usa "+ Nuevo KPI".' : 'No hay KPI para mostrar.'); return; }
  const areas = SG.area === 'todas' ? sigAreas().filter(a => kpis.some(k => k.area_key === a.key)) : [{ key: SG.area, nombre: sigAreaNombre(SG.area) }];
  el.innerHTML = `<div class="text-sm text-muted mb-3">Haz clic en un KPI para ver su tendencia, registrar mediciones o editarlo.</div>` +
    areas.map(a => `${SG.area === 'todas' ? `<div style="font-weight:700;color:var(--navy);font-size:13px;margin:6px 0 8px">${VZ.esc(a.nombre)}</div>` : ''}
      <div class="vz-kpis">${kpis.filter(k => k.area_key === a.key).map(sigTileKPI).join('')}</div>`).join('');
}

function sigFormKPI(k = {}) {
  const areas = sigAreas().filter(a => sigPuedeGestionar(a.key));
  const area = k.area_key || (SG.area !== 'todas' && sigPuedeGestionar(SG.area) ? SG.area : areas[0]?.key);
  return `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Área</label><select class="form-select" id="sk-area" ${k.id ? 'disabled' : ''}>${areas.map(a => `<option value="${a.key}" ${a.key === area ? 'selected' : ''}>${VZ.esc(a.nombre)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Nombre del KPI *</label><input class="form-input" id="sk-nombre" value="${VZ.esc(k.nombre || '')}" placeholder="Ej. Índice de ausentismo"></div></div>
    <div class="form-group"><label class="form-label">Objetivo</label><input class="form-input" id="sk-obj" value="${VZ.esc(k.objetivo || '')}"></div>
    <div class="form-group"><label class="form-label">Fórmula</label><input class="form-input" id="sk-formula" value="${VZ.esc(k.formula || '')}" placeholder="Ej. Días de ausencia ÷ días programados × 100"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Meta</label><input type="number" step="any" class="form-input" id="sk-meta" value="${VZ.esc(k.meta ?? '')}"></div>
      <div class="form-group"><label class="form-label">Unidad</label><input class="form-input" id="sk-unidad" value="${VZ.esc(k.unidad ?? '%')}" placeholder="%, días, $, #"></div>
      <div class="form-group"><label class="form-label">Sentido</label><select class="form-select" id="sk-sentido">
        <option value="mayor" ${k.sentido !== 'menor' ? 'selected' : ''}>Mayor es mejor</option><option value="menor" ${k.sentido === 'menor' ? 'selected' : ''}>Menor es mejor</option></select></div></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Frecuencia</label><select class="form-select" id="sk-frec">${Object.entries(SIG_FRECUENCIAS).map(([v, t]) => `<option value="${v}" ${v === (k.frecuencia || 'mensual') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Responsable</label><input class="form-input" id="sk-resp" value="${VZ.esc(k.responsable || '')}"></div></div>
    <div class="flex gap-3 mt-2"><button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-sig')">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" onclick="sigGuardarKPI('${VZ.esc(k.id || '')}')">💾 Guardar KPI</button></div>`;
}
function sigNuevoKPI() {
  if (!sigAreas().some(a => sigPuedeGestionar(a.key))) { showNotif('No gestionas ninguna área', 'error'); return; }
  sigModal('🎯 Nuevo KPI', sigFormKPI());
}
function sigEditarKPI(id) { const k = SG.kpis.find(x => x.id === id); if (k && sigPuedeGestionar(k.area_key)) sigModal('✏️ Editar KPI', sigFormKPI(k)); }
window.sigNuevoKPI = sigNuevoKPI; window.sigEditarKPI = sigEditarKPI;

async function sigGuardarKPI(id) {
  const prev = id ? SG.kpis.find(x => x.id === id) : null;
  const area = prev?.area_key || document.getElementById('sk-area').value;
  if (!sigPuedeGestionar(area)) { showNotif('No gestionas esta área', 'error'); return; }
  const nombre = document.getElementById('sk-nombre').value.trim();
  if (!nombre) { showNotif('Escribe el nombre del KPI', 'error'); return; }
  const meta = document.getElementById('sk-meta').value;
  const fila = {
    id: prev?.id || 'sk' + Date.now() + Math.random().toString(36).slice(2, 5), area_key: area, nombre,
    objetivo: document.getElementById('sk-obj').value.trim(), formula: document.getElementById('sk-formula').value.trim(),
    meta: meta === '' ? null : Number(meta), unidad: document.getElementById('sk-unidad').value.trim(),
    sentido: document.getElementById('sk-sentido').value, frecuencia: document.getElementById('sk-frec').value,
    responsable: document.getElementById('sk-resp').value.trim(), mediciones: prev?.mediciones || [], activo: true,
    updated_at: new Date().toISOString(),
  };
  const r = await sbFetch('sig_kpis', 'POST', fila, '', { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
  if (r === null) { showNotif('No se pudo guardar el KPI', 'error'); return; }
  if (prev) Object.assign(prev, fila); else SG.kpis.push(fila);
  if (typeof registrarAuditoria === 'function') registrarAuditoria(prev ? 'editar_kpi' : 'crear_kpi', 'sig', fila.id, `${sigAreaNombre(area)} · ${nombre}`);
  closeModal('modal-sig');
  showNotif(prev ? '✅ KPI actualizado' : '🎯 KPI creado');
  renderBiblioteca('kpi');
  if (prev) sigDetalleKPI(fila.id);
}
window.sigGuardarKPI = sigGuardarKPI;

function sigDetalleKPI(id) {
  const k = SG.kpis.find(x => x.id === id); if (!k) return;
  const g = sigPuedeGestionar(k.area_key), s = sigSemaforoKPI(k), u = sigUltimaMedicion(k);
  const med = (k.mediciones || []).slice().sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
  const chart = med.length ? VZ.line(med.map(m => m.periodo), [{ name: k.nombre, values: med.map(m => Number(m.valor)), color: s.c }],
    { meta: sigMeta(k), unit: k.unidad === '%' ? '%' : '' }) : VZ.empty('Sin mediciones todavía');
  sigModal(`🎯 ${k.nombre}`, `
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <div><div class="text-xs text-muted">Último valor</div><div style="font-size:26px;font-weight:800;color:${s.c}">${u ? sigFmtKPI(u.valor, k) : '—'}</div></div>
      <div><div class="text-xs text-muted">Meta</div><div style="font-size:18px;font-weight:700">${sigFmtKPI(k.meta, k)}</div></div>
      <span class="vz-chip" style="background:${s.c};color:#fff">${s.txt}</span>
      <span class="vz-chip">${SIG_FRECUENCIAS[k.frecuencia] || 'Mensual'}</span>
      <span class="vz-chip">${k.sentido === 'menor' ? 'Menor es mejor' : 'Mayor es mejor'}</span>
      <span style="flex:1"></span>${g ? `<button class="btn btn-ghost btn-sm" onclick="sigEditarKPI('${VZ.esc(k.id)}')">✏️ Editar</button><button class="btn btn-ghost btn-sm" onclick="sigEliminarKPI('${VZ.esc(k.id)}')">🗑</button>` : ''}
    </div>
    ${k.objetivo ? `<div class="text-sm"><b>Objetivo:</b> ${VZ.esc(k.objetivo)}</div>` : ''}
    ${k.formula ? `<div class="text-sm" style="margin-top:2px"><b>Fórmula:</b> ${VZ.esc(k.formula)}</div>` : ''}
    <div class="text-xs text-muted" style="margin:2px 0 10px">${VZ.esc(sigAreaNombre(k.area_key))}${k.responsable ? ' · Responsable: ' + VZ.esc(k.responsable) : ''}</div>
    <div class="vz-panel" style="margin-bottom:12px"><div class="vz-panel-body" style="padding-top:12px">${chart}</div></div>
    ${g ? `<div class="glass-card p-3 mb-3"><div style="font-weight:700;font-size:12px;color:var(--navy);margin-bottom:8px">Registrar medición</div>
      <div class="form-row" style="align-items:flex-end">
        <div class="form-group"><label class="form-label">Periodo</label><input type="month" class="form-input" id="km-per" value="${new Date().toISOString().slice(0, 7)}"></div>
        <div class="form-group"><label class="form-label">Valor</label><input type="number" step="any" class="form-input" id="km-val"></div>
        <div class="form-group" style="flex:2"><label class="form-label">Análisis / nota</label><input class="form-input" id="km-nota"></div>
        <div class="form-group" style="flex:0"><button class="btn btn-primary" onclick="sigGuardarMedicion('${VZ.esc(k.id)}')">Guardar</button></div></div></div>` : ''}
    ${med.length ? `<table class="data-table" style="font-size:12px"><thead><tr><th>Periodo</th><th>Valor</th><th>Semáforo</th><th>Análisis</th>${g ? '<th></th>' : ''}</tr></thead><tbody>
      ${med.slice().reverse().map(m => { const sm = VZ.semaforo(Number(m.valor), sigMeta(k), k.sentido);
        return `<tr><td>${VZ.esc(m.periodo)}</td><td><b>${sigFmtKPI(m.valor, k)}</b></td><td><span class="vz-chip" style="background:${sm.c};color:#fff">${sm.txt}</span></td>
          <td>${VZ.esc(m.nota || '')}</td>${g ? `<td><button class="btn btn-ghost btn-sm" onclick="sigBorrarMedicion('${VZ.esc(k.id)}','${VZ.esc(m.periodo)}')" title="Borrar">✕</button></td>` : ''}</tr>`; }).join('')}
    </tbody></table>` : ''}`, 780);
}
window.sigDetalleKPI = sigDetalleKPI;

async function sigGuardarKPIMediciones(k) {
  const r = await sbFetch('sig_kpis', 'PATCH', { mediciones: k.mediciones, updated_at: new Date().toISOString() }, `?id=eq.${encodeURIComponent(k.id)}`);
  if (r === null) { showNotif('No se pudo guardar la medición', 'error'); return false; }
  return true;
}
async function sigGuardarMedicion(id) {
  const k = SG.kpis.find(x => x.id === id); if (!k || !sigPuedeGestionar(k.area_key)) return;
  const periodo = document.getElementById('km-per').value, val = document.getElementById('km-val').value;
  if (!periodo || val === '' || isNaN(Number(val))) { showNotif('Indica el periodo y un valor numérico', 'error'); return; }
  const antes = (k.mediciones || []).slice();
  k.mediciones = antes.filter(m => m.periodo !== periodo);
  k.mediciones.push({ periodo, valor: Number(val), nota: document.getElementById('km-nota').value.trim(), por: SC.user?.name || '', fecha: new Date().toISOString() });
  if (!(await sigGuardarKPIMediciones(k))) { k.mediciones = antes; return; }
  showNotif(`📈 Medición ${periodo} registrada`);
  sigAvisarSiFueraDeMeta(k, periodo, Number(val));
  renderBiblioteca();
  sigDetalleKPI(id);
}
async function sigBorrarMedicion(id, periodo) {
  const k = SG.kpis.find(x => x.id === id); if (!k || !sigPuedeGestionar(k.area_key) || !confirm(`¿Borrar la medición de ${periodo}?`)) return;
  const antes = (k.mediciones || []).slice();
  k.mediciones = antes.filter(m => m.periodo !== periodo);
  if (!(await sigGuardarKPIMediciones(k))) { k.mediciones = antes; return; }
  renderBiblioteca();
  sigDetalleKPI(id);
}
async function sigEliminarKPI(id) {
  const k = SG.kpis.find(x => x.id === id); if (!k || !sigPuedeGestionar(k.area_key) || !confirm(`¿Eliminar el KPI "${k.nombre}" y todas sus mediciones?`)) return;
  const r = await sbFetch('sig_kpis', 'DELETE', null, `?id=eq.${encodeURIComponent(id)}`);
  if (r === null) { showNotif('No se pudo eliminar', 'error'); return; }
  SG.kpis = SG.kpis.filter(x => x.id !== id);
  if (typeof registrarAuditoria === 'function') registrarAuditoria('eliminar_kpi', 'sig', id, k.nombre);
  closeModal('modal-sig'); renderBiblioteca('kpi');
}
window.sigGuardarMedicion = sigGuardarMedicion; window.sigBorrarMedicion = sigBorrarMedicion; window.sigEliminarKPI = sigEliminarKPI;
window.SG = SG;

// ═══════════════════════════════════════════════════════════════
// ALERTAS Y REPORTERÍA DE KPI Y DOCUMENTOS
// La tarea del día 5 (supabase_pesv_autoevaluacion.sql) envía estas
// mismas alertas por la campana 🔔 al área responsable.
// ═══════════════════════════════════════════════════════════════
const sigDestino = key => ({ rol: key });   // 'rrhh' · 'gerencia' · 'area-<id>'

// Último periodo que ya debería estar medido según la frecuencia
function sigPeriodoEsperado(frec, hoy = new Date()) {
  const y = hoy.getFullYear(), m = hoy.getMonth() + 1, pad = n => String(n).padStart(2, '0');
  if (frec === 'trimestral') { const q = Math.floor((m - 1) / 3); return q === 0 ? `${y - 1}-12` : `${y}-${pad(q * 3)}`; }
  if (frec === 'semestral') return m <= 6 ? `${y - 1}-12` : `${y}-06`;
  if (frec === 'anual') return `${y - 1}-12`;
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}
const sigMesTxt = per => { const [y, m] = String(per || '').split('-'); return m ? `${VZ.MESES[Number(m) - 1]} ${y}` : per; };

function sigAlertas() {
  const hoy = sigHoy(), en30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), out = [];
  const visibles = a => SG.area === 'todas' ? sigAreas().some(x => x.key === a) : a === SG.area;
  SG.kpis.filter(k => visibles(k.area_key) && k.activo !== false).forEach(k => {
    const s = sigSemaforoKPI(k), u = sigUltimaMedicion(k), esp = sigPeriodoEsperado(k.frecuencia);
    const area = sigAreaNombre(k.area_key);
    if (s.k === 'rojo') out.push({ nivel: 'alta', tipo: 'KPI fuera de meta', icon: '🔴', txt: k.nombre, sub: `${area} · ${sigFmtKPI(u.valor, k)} vs meta ${sigFmtKPI(k.meta, k)} (${sigMesTxt(u.periodo)})`, onclick: `sigDetalleKPI('${k.id}')` });
    else if (s.k === 'amarillo') out.push({ nivel: 'media', tipo: 'KPI en riesgo', icon: '🟡', txt: k.nombre, sub: `${area} · ${sigFmtKPI(u.valor, k)} vs meta ${sigFmtKPI(k.meta, k)}`, onclick: `sigDetalleKPI('${k.id}')` });
    if (!u || String(u.periodo) < esp) out.push({ nivel: 'media', tipo: 'KPI sin medir', icon: '⏰', txt: k.nombre, sub: `${area} · falta la medición de ${sigMesTxt(esp)} (${SIG_FRECUENCIAS[k.frecuencia] || 'Mensual'})`, onclick: `sigDetalleKPI('${k.id}')` });
  });
  SG.docs.filter(d => visibles(d.area_key) && d.estado !== 'obsoleto' && d.fecha_revision && d.fecha_revision <= en30).forEach(d => {
    const venc = d.fecha_revision < hoy;
    out.push({ nivel: venc ? 'alta' : 'media', tipo: venc ? 'Revisión vencida' : 'Revisión próxima', icon: venc ? '⏰' : '📅',
               txt: `${d.codigo ? d.codigo + ' · ' : ''}${d.nombre}`, sub: `${sigAreaNombre(d.area_key)} · revisión ${d.fecha_revision}`,
               onclick: d.archivo_ruta ? `sigAbrir('${VZ.esc(d.archivo_ruta)}')` : '' });
  });
  const orden = { alta: 0, media: 1 };
  return out.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}
window.sigAlertas = sigAlertas;

function sigAlertasVista(el) {
  const al = sigAlertas();
  const cuenta = t => al.filter(a => a.tipo === t).length;
  const kpis = [
    VZ.kpi({ label: 'KPI fuera de meta', value: VZ.num(cuenta('KPI fuera de meta')), icon: '🔴', tone: cuenta('KPI fuera de meta') ? 'red' : 'green' }),
    VZ.kpi({ label: 'KPI en riesgo', value: VZ.num(cuenta('KPI en riesgo')), icon: '🟡', tone: 'amber' }),
    VZ.kpi({ label: 'KPI sin medir', value: VZ.num(cuenta('KPI sin medir')), icon: '⏰', tone: cuenta('KPI sin medir') ? 'orange' : 'green' }),
    VZ.kpi({ label: 'Documentos por revisar', value: VZ.num(cuenta('Revisión vencida') + cuenta('Revisión próxima')), icon: '📅', tone: cuenta('Revisión vencida') ? 'red' : 'blue', sub: `${cuenta('Revisión vencida')} vencidos · ${cuenta('Revisión próxima')} en 30 días` }),
  ].join('');
  const col = { alta: '#dc2626', media: '#f59e0b' };
  const lista = al.length ? al.map(a => `
    <div ${a.onclick ? `onclick="${VZ.esc(a.onclick)}"` : ''} style="display:flex;gap:12px;align-items:center;padding:10px 12px;background:#fff;border:1px solid var(--vz-line);border-left:4px solid ${col[a.nivel]};border-radius:10px;margin-bottom:8px;${a.onclick ? 'cursor:pointer' : ''}">
      <span style="font-size:18px">${a.icon}</span>
      <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--navy)">${VZ.esc(a.txt)}</div><div class="text-xs text-muted">${VZ.esc(a.sub)}</div></div>
      <span class="vz-chip ${a.nivel === 'alta' ? 'c-red' : 'c-amber'}">${VZ.esc(a.tipo)}</span></div>`).join('') : VZ.empty('Sin alertas: KPI medidos y en meta, documentos al día');
  el.innerHTML = `<div class="info-box mb-3" style="font-size:12px">🔔 Además de esta lista, el <b>día 5 de cada mes</b> el sistema envía estas alertas por la campana al área responsable (y a Gerencia cuando un KPI queda fuera de meta). Al registrar una medición fuera de meta, el aviso sale de inmediato.</div>
    <div class="vz-kpis">${kpis}</div>
    ${SC.user?.role === 'superadmin' ? `<div style="text-align:right;margin-bottom:10px"><button class="btn btn-ghost btn-sm" onclick="sigEnviarAlertasAhora()">📣 Enviar alertas ahora</button></div>` : ''}
    ${lista}`;
}
async function sigEnviarAlertasAhora() {
  if (SC.user?.role !== 'superadmin' || !confirm('¿Enviar ahora las alertas de KPI, documentos y acciones PESV a cada área por la campana?')) return;
  const r = await sbFetch('rpc/sig_alertas_mensuales', 'POST', {});
  if (r === null) { showNotif('No se pudieron enviar. Verifica que se haya ejecutado supabase_pesv_autoevaluacion.sql', 'error'); return; }
  showNotif(`📣 ${Number(r) || 0} alerta(s) nueva(s) enviada(s)`);
  if (typeof cargarNotificaciones === 'function') cargarNotificaciones();
}
window.sigEnviarAlertasAhora = sigEnviarAlertasAhora;

function sigAvisarSiFueraDeMeta(k, periodo, valor) {
  if (typeof crearNotificacion !== 'function') return;
  const s = VZ.semaforo(valor, sigMeta(k), k.sentido || 'mayor');
  if (s.k !== 'rojo') return;
  const msg = `${sigAreaNombre(k.area_key)} · ${sigFmtKPI(valor, k)} frente a meta ${sigFmtKPI(k.meta, k)} (${sigMesTxt(periodo)})`;
  const destinos = [k.area_key, 'gerencia'].filter((v, i, a) => a.indexOf(v) === i);
  destinos.forEach(d => crearNotificacion(sigDestino(d), { titulo: `🔴 KPI fuera de meta: ${k.nombre}`, mensaje: msg, tipo: 'alerta', refTabla: 'sig_kpis', refId: k.id, vista: 'biblioteca' }));
}

// ─── Reportes ───────────────────────────────────────────────
function sigPeriodosDisponibles() {
  const set = new Set(); SG.kpis.forEach(k => (k.mediciones || []).forEach(m => m.periodo && set.add(m.periodo)));
  set.add(new Date().toISOString().slice(0, 7));
  return [...set].sort().reverse();
}
function sigDatosReporte(periodo) {
  const kpis = sigKpisArea();
  return kpis.map(k => {
    const med = (k.mediciones || []).slice().sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
    const act = med.filter(m => m.periodo <= periodo).pop() || null;
    const ant = act ? med.filter(m => m.periodo < act.periodo).pop() || null : null;
    const meta = sigMeta(k), v = act ? Number(act.valor) : null;
    const s = VZ.semaforo(v, meta, k.sentido || 'mayor');
    let cumpl = null;
    if (v != null && meta != null) cumpl = k.sentido === 'menor' ? (v === 0 ? 100 : Math.min(150, meta / v * 100)) : (meta === 0 ? 100 : Math.min(150, v / meta * 100));
    return { k, act, ant, v, meta, s, cumpl, serie: med.filter(m => m.periodo <= periodo).slice(-6).map(m => Number(m.valor)),
             delta: act && ant && Number(ant.valor) ? (Number(act.valor) - Number(ant.valor)) / Math.abs(Number(ant.valor)) * 100 : null, alDia: act && act.periodo === periodo };
  });
}
function sigReportes(el) {
  SG.repPer = SG.repPer || new Date().toISOString().slice(0, 7);
  const filas = sigDatosReporte(SG.repPer), docs = sigDocsArea();
  const conCumpl = filas.filter(f => f.cumpl != null);
  const prom = conCumpl.length ? conCumpl.reduce((s, f) => s + Math.min(100, f.cumpl), 0) / conCumpl.length : null;
  const kpis = [
    VZ.kpi({ label: 'Cumplimiento promedio de KPI', value: prom == null ? '—' : VZ.num(prom, 0), unit: prom == null ? '' : '%', icon: '🎯', tone: prom >= 90 ? 'green' : prom >= 70 ? 'amber' : 'red', sub: `${conCumpl.length} KPI con meta y medición` }),
    VZ.kpi({ label: 'En meta', value: VZ.num(filas.filter(f => f.s.k === 'verde').length), icon: '🟢', tone: 'green', sub: `de ${filas.length} KPI` }),
    VZ.kpi({ label: 'Fuera de meta', value: VZ.num(filas.filter(f => f.s.k === 'rojo').length), icon: '🔴', tone: 'red' }),
    VZ.kpi({ label: 'Medidos en el periodo', value: VZ.num(filas.filter(f => f.alDia).length), icon: '📏', tone: 'blue', sub: sigMesTxt(SG.repPer) }),
    VZ.kpi({ label: 'Documentos vigentes', value: VZ.num(docs.filter(d => d.estado === 'vigente').length), icon: '📚', tone: 'navy', sub: `de ${docs.length}` }),
  ].join('');
  const tabla = filas.length ? `<div style="overflow-x:auto"><table class="data-table" style="font-size:12px">
    <thead><tr>${SG.area === 'todas' ? '<th>Área</th>' : ''}<th>KPI</th><th>Meta</th><th>Valor</th><th>Periodo</th><th>Var. vs anterior</th><th>Cumplimiento</th><th>Semáforo</th><th>Tendencia</th></tr></thead>
    <tbody>${filas.map(f => `<tr style="cursor:pointer" onclick="sigDetalleKPI('${f.k.id}')">
      ${SG.area === 'todas' ? `<td>${VZ.esc(sigAreaNombre(f.k.area_key))}</td>` : ''}
      <td><b>${VZ.esc(f.k.nombre)}</b><div class="text-xs text-muted">${f.k.sentido === 'menor' ? 'menor es mejor' : 'mayor es mejor'}</div></td>
      <td>${sigFmtKPI(f.meta, f.k)}</td><td><b>${f.act ? sigFmtKPI(f.v, f.k) : '—'}</b></td>
      <td>${f.act ? VZ.esc(sigMesTxt(f.act.periodo)) + (f.alDia ? '' : ' <span class="vz-chip c-amber">desactualizado</span>') : '<span class="vz-chip c-amber">sin medir</span>'}</td>
      <td>${f.delta == null ? '—' : `<span class="vz-delta ${f.delta === 0 ? 'flat' : ((f.k.sentido === 'menor') === (f.delta < 0) ? 'up' : 'down')}">${f.delta > 0 ? '▲' : f.delta < 0 ? '▼' : '■'} ${VZ.num(Math.abs(f.delta), 1)}%</span>`}</td>
      <td style="min-width:110px">${f.cumpl == null ? '—' : VZ.progress(Math.min(100, f.cumpl), f.s.c) + `<span class="text-xs">${VZ.num(f.cumpl, 0)}%</span>`}</td>
      <td><span class="vz-chip" style="background:${f.s.c};color:#fff">${f.s.txt}</span></td>
      <td>${VZ.spark(f.serie, { w: 80, h: 24, c: f.s.c })}</td></tr>`).join('')}</tbody></table></div>` : VZ.empty('No hay KPI en esta selección.');
  const porArea = sigAreas().map(a => {
    const fs = filas.filter(f => f.k.area_key === a.key && f.cumpl != null);
    return fs.length ? { label: a.nombre, value: Math.round(fs.reduce((s, f) => s + Math.min(100, f.cumpl), 0) / fs.length), color: 'blue' } : null;
  }).filter(Boolean);
  el.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
      <label class="text-sm" style="font-weight:600;color:var(--navy)">Periodo</label>
      <select class="form-select" style="width:auto" onchange="SG.repPer=this.value;renderBiblioteca('reportes')">${sigPeriodosDisponibles().map(p => `<option value="${p}" ${p === SG.repPer ? 'selected' : ''}>${sigMesTxt(p)}</option>`).join('')}</select>
      <span class="text-xs text-muted">${SG.area === 'todas' ? 'Todas las áreas' : VZ.esc(sigAreaNombre(SG.area))}</span>
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-sm" onclick="sigExportarReporte()">⬇️ Excel (CSV)</button>
      <button class="btn btn-primary btn-sm" onclick="sigImprimirReporte()">🖨️ Imprimir / PDF</button>
    </div>
    <div class="vz-kpis">${kpis}</div>
    ${SG.area === 'todas' && porArea.length ? `<div class="vz-grid">${VZ.panel('Cumplimiento promedio de KPI por área', VZ.bars(porArea, { max: 100, unit: '%' }), { span: 12 })}</div>` : ''}
    <div class="vz-grid">${VZ.panel(`Informe de indicadores · ${sigMesTxt(SG.repPer)}`, tabla, { sub: 'Último valor registrado hasta el periodo elegido', span: 12 })}</div>`;
}
function sigExportarReporte() {
  const filas = sigDatosReporte(SG.repPer || new Date().toISOString().slice(0, 7));
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const out = [['Área', 'KPI', 'Fórmula', 'Unidad', 'Sentido', 'Meta', 'Valor', 'Periodo del valor', 'Valor anterior', 'Variación %', 'Cumplimiento %', 'Semáforo', 'Responsable', 'Frecuencia'].map(q).join(';')];
  filas.forEach(f => out.push([sigAreaNombre(f.k.area_key), f.k.nombre, f.k.formula, f.k.unidad, f.k.sentido === 'menor' ? 'Menor es mejor' : 'Mayor es mejor', f.meta,
    f.v, f.act?.periodo, f.ant?.valor, f.delta == null ? '' : f.delta.toFixed(1), f.cumpl == null ? '' : f.cumpl.toFixed(0), f.s.txt, f.k.responsable, SIG_FRECUENCIAS[f.k.frecuencia] || ''].map(q).join(';')));
  const blob = new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `Reporte_KPI_${SG.area === 'todas' ? 'todas' : sigAreaNombre(SG.area).replace(/\W+/g, '_')}_${SG.repPer}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function sigImprimirReporte() {
  const per = SG.repPer || new Date().toISOString().slice(0, 7);
  const filas = sigDatosReporte(per), al = sigAlertas();
  const w = window.open('', '_blank');
  if (!w) { showNotif('Permite las ventanas emergentes para imprimir el reporte', 'error'); return; }
  const fila = f => `<tr><td>${VZ.esc(sigAreaNombre(f.k.area_key))}</td><td><b>${VZ.esc(f.k.nombre)}</b></td><td>${sigFmtKPI(f.meta, f.k)}</td>
    <td><b>${f.act ? sigFmtKPI(f.v, f.k) : '—'}</b></td><td>${f.act ? VZ.esc(sigMesTxt(f.act.periodo)) : 'sin medir'}</td>
    <td>${f.cumpl == null ? '—' : VZ.num(f.cumpl, 0) + '%'}</td><td><span style="background:${f.s.c};color:#fff;padding:2px 8px;border-radius:10px">${f.s.txt}</span></td>
    <td>${VZ.spark(f.serie, { w: 80, h: 22, c: f.s.c })}</td></tr>`;
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte de KPI · ${sigMesTxt(per)}</title>
    <style>body{font-family:Arial,sans-serif;color:#0d1a3a;margin:28px;font-size:12px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:22px 0 8px;color:#111f4d}
    .sub{color:#64748b;margin:4px 0 16px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:middle}
    th{background:#f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569}.tiles{display:flex;gap:10px}.tile{flex:1;border:1px solid #e5e7eb;border-left:4px solid #111f4d;border-radius:8px;padding:8px 12px}
    .tile b{display:block;font-size:20px}@media print{button{display:none}}</style></head><body>
    <button onclick="window.print()" style="float:right;padding:8px 14px">🖨️ Imprimir / Guardar PDF</button>
    <h1>Reporte de indicadores · ${VZ.esc(sigMesTxt(per))}</h1>
    <div class="sub">${SG.area === 'todas' ? 'Todas las áreas' : VZ.esc(sigAreaNombre(SG.area))} · Generado ${new Date().toLocaleString('es-CO')} · ${VZ.esc(SC.user?.name || '')}</div>
    <div class="tiles"><div class="tile">KPI<b>${filas.length}</b></div><div class="tile" style="border-left-color:#16a34a">En meta<b>${filas.filter(f => f.s.k === 'verde').length}</b></div>
      <div class="tile" style="border-left-color:#f59e0b">En riesgo<b>${filas.filter(f => f.s.k === 'amarillo').length}</b></div><div class="tile" style="border-left-color:#dc2626">Fuera de meta<b>${filas.filter(f => f.s.k === 'rojo').length}</b></div>
      <div class="tile" style="border-left-color:#94a3b8">Sin medir<b>${filas.filter(f => !f.act).length}</b></div></div>
    <h2>Indicadores</h2><table><thead><tr><th>Área</th><th>KPI</th><th>Meta</th><th>Valor</th><th>Periodo</th><th>Cumplimiento</th><th>Semáforo</th><th>Tendencia</th></tr></thead>
    <tbody>${filas.map(fila).join('') || '<tr><td colspan="8">Sin KPI</td></tr>'}</tbody></table>
    <h2>Alertas (${al.length})</h2><table><thead><tr><th>Tipo</th><th>Detalle</th><th>Área / dato</th></tr></thead>
    <tbody>${al.map(a => `<tr><td>${a.icon} ${VZ.esc(a.tipo)}</td><td>${VZ.esc(a.txt)}</td><td>${VZ.esc(a.sub)}</td></tr>`).join('') || '<tr><td colspan="3">Sin alertas</td></tr>'}</tbody></table>
    </body></html>`);
  w.document.close();
}
window.sigExportarReporte = sigExportarReporte; window.sigImprimirReporte = sigImprimirReporte;
