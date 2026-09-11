// ═══════════════════════════════════════════════════════════════
// SPECIAL CAR · MÓDULO HSEQ, INDUCCIONES Y CAPACITACIONES
// ───────────────────────────────────────────────────────────────
// Contiene:
//   · Inducciones y capacitaciones por colaborador
//     (presentaciones, documentos, videos y certificado)
//   · Perfil HSEQ: políticas, formatos y procedimientos del área
//   · Certificados de capacitación de todos los colaboradores
//   · COPASST y COCOLAB: miembros, actas y documentos
//   · Certificaciones ISO y otras certificaciones
//   · Acceso de solo lectura para los miembros de cada comité
//   · Vista de gerencia (solo lectura) sobre todo lo anterior
//
// Se carga DESPUÉS de app.js, así que reutiliza sus utilidades:
// SC, sbFetch, uploadToDrive, driveViewUrl, readFile, openModal,
// closeModal, showNotif, registrarAuditoria, hoyISO, empAvatarHtml.
// ═══════════════════════════════════════════════════════════════

// ─── ESTADO ────────────────────────────────────────────────────
SC.capacitaciones   = SC.capacitaciones   || [];   // catálogo
SC.capAsignaciones  = SC.capAsignaciones  || [];   // asignación por colaborador
SC.hseqDocs         = SC.hseqDocs         || [];   // políticas, formatos, procedimientos
SC.hseqCerts        = SC.hseqCerts        || [];   // certificaciones ISO y otras
SC.comiteMiembros   = SC.comiteMiembros   || [];   // integrantes COPASST / COCOLAB
SC.comiteActas      = SC.comiteActas      || [];   // actas y reuniones

// ─── CATÁLOGOS ─────────────────────────────────────────────────
const AREA_HSEQ_ID = '14';   // HSEQ & SIG

const TIPOS_CAPACITACION = {
  induccion:     { label:'Inducción',                  icon:'🚀', color:'var(--navy)'  },
  reinduccion:   { label:'Reinducción',                icon:'🔄', color:'var(--blue)'  },
  capacitacion:  { label:'Capacitación',               icon:'🎓', color:'var(--green)' },
  entrenamiento: { label:'Entrenamiento en el puesto', icon:'🛠',  color:'var(--amber)' },
  sst:           { label:'Capacitación SST',           icon:'🦺', color:'var(--red)'   },
};

const TIPOS_MATERIAL = {
  presentacion: { label:'Presentación', icon:'📊' },
  documento:    { label:'Documento',    icon:'📄' },
  video:        { label:'Video',        icon:'🎬' },
  enlace:       { label:'Enlace',       icon:'🔗' },
  evaluacion:   { label:'Evaluación',   icon:'📝' },
};

const TIPOS_DOC_HSEQ = {
  politica:     { label:'Política',      icon:'📜' },
  formato:      { label:'Formato',       icon:'🗒' },
  procedimiento:{ label:'Procedimiento', icon:'⚙️' },
  manual:       { label:'Manual',        icon:'📕' },
  matriz:       { label:'Matriz',        icon:'🧮' },
  programa:     { label:'Programa',      icon:'📆' },
  plan:         { label:'Plan',          icon:'🗺' },
  instructivo:  { label:'Instructivo',   icon:'📌' },
  acta:         { label:'Acta',          icon:'📋' },
  otro:         { label:'Otro',          icon:'📁' },
};

const COMITES = {
  copasst: {
    label:'COPASST', icon:'🦺',
    nombre:'Comité Paritario de Seguridad y Salud en el Trabajo',
    color:'var(--green)',
  },
  cocolab: {
    label:'COCOLAB', icon:'🤝',
    nombre:'Comité de Convivencia Laboral',
    color:'var(--blue)',
  },
};

const ROLES_COMITE = {
  presidente: { label:'Presidente', icon:'⭐' },
  secretario: { label:'Secretario', icon:'✍️' },
  principal:  { label:'Principal',  icon:'👤' },
  suplente:   { label:'Suplente',   icon:'👥' },
};

// ─── PERMISOS ──────────────────────────────────────────────────
// Gestiona HSEQ: el líder del área HSEQ & SIG y Recursos Humanos.
function puedeGestionarHSEQ() {
  const r = SC.user?.role;
  if (['superadmin','analista_rrhh','lider_rrhh'].includes(r)) return true;
  if (r === 'lider_area' && String(SC.user?.areaId) === AREA_HSEQ_ID) return true;
  return false;
}
// Ve el módulo HSEQ completo (gerencia y jurídica: solo lectura).
function puedeVerHSEQ() {
  return puedeGestionarHSEQ() || ['gerencia','juridico','ceo'].includes(SC.user?.role);
}
// Solo lectura dentro del módulo HSEQ
function hseqSoloLectura() { return !puedeGestionarHSEQ(); }

// ¿El usuario conectado es miembro activo de este comité?
function esMiembroComite(comite) {
  const empId = SC.user?.empId;
  if (!empId) return false;
  return (SC.comiteMiembros || []).some(m =>
    m.comite === comite && m.empId === empId && m.activo !== false);
}
// Comités a los que pertenece el usuario conectado
function misComites() {
  return Object.keys(COMITES).filter(c => esMiembroComite(c));
}
// ¿Puede abrir la vista de lectura del comité?
function puedeVerComite(comite) {
  return puedeVerHSEQ() || esMiembroComite(comite);
}

window.puedeGestionarHSEQ = puedeGestionarHSEQ;
window.puedeVerHSEQ       = puedeVerHSEQ;
window.hseqSoloLectura    = hseqSoloLectura;
window.esMiembroComite    = esMiembroComite;
window.misComites         = misComites;
window.puedeVerComite     = puedeVerComite;

// ─── HELPERS ───────────────────────────────────────────────────
function hseqEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function hseqHoy() { return (typeof hoyISO === 'function') ? hoyISO() : new Date().toISOString().split('T')[0]; }
function hseqNombreEmp(empId) {
  return SC.empleados.find(e => e.id === empId)?.name || '—';
}
function hseqNombreArea(areaId) {
  if (areaId == null || areaId === '') return 'Todas las áreas';
  const a = SC.areas.find(x => String(x.id) === String(areaId));
  return a ? `${a.icon} ${a.name}` : '—';
}
// Suma meses a una fecha ISO y devuelve ISO
function hseqSumarMeses(fechaISO, meses) {
  if (!fechaISO || !meses) return null;
  const d = new Date(fechaISO + 'T00:00:00');
  if (isNaN(d)) return null;
  d.setMonth(d.getMonth() + Number(meses));
  return d.toISOString().split('T')[0];
}
// Estado de vigencia del certificado de una asignación
function hseqVigencia(asig, cap) {
  if (!asig || asig.estado !== 'completada' || !cap?.vigenciaMeses) return { estado:'na' };
  const vence = hseqSumarMeses(asig.fechaCompletado, cap.vigenciaMeses);
  if (!vence) return { estado:'na' };
  const dias = Math.floor((new Date(vence) - new Date(hseqHoy())) / 86400000);
  if (dias < 0)  return { estado:'vencido',   vence, dias };
  if (dias <= 30) return { estado:'por_vencer', vence, dias };
  return { estado:'vigente', vence, dias };
}
function hseqBadgeVigencia(v) {
  if (!v || v.estado === 'na') return '';
  if (v.estado === 'vencido')    return `<span class="badge badge-red" title="Venció el ${v.vence}">⛔ Vencido</span>`;
  if (v.estado === 'por_vencer') return `<span class="badge badge-yellow" title="Vence el ${v.vence}">⏳ Vence en ${v.dias}d</span>`;
  return `<span class="badge badge-green" title="Vence el ${v.vence}">✅ Vigente</span>`;
}
// Empleados que el usuario puede ver (RRHH/HSEQ: todos; líder: su área)
function hseqEmpleadosVisibles() {
  return SC.empleados.filter(e =>
    typeof empVisibleParaUsuario === 'function' ? empVisibleParaUsuario(e.id) : true);
}

// ─── CONVERSIÓN BD ↔ APP ───────────────────────────────────────
function dbToCapacitacion(r) {
  let mats = r.materiales;
  if (typeof mats === 'string') { try { mats = JSON.parse(mats); } catch(e) { mats = []; } }
  return {
    id: r.id, titulo: r.titulo || '', tipo: r.tipo || 'capacitacion',
    categoria: r.categoria || '', descripcion: r.descripcion || '',
    areaId: r.area_id || null, cargo: r.cargo || '',
    obligatoria: r.obligatoria !== false,
    duracionHoras: r.duracion_horas || 0,
    vigenciaMeses: r.vigencia_meses || 0,
    fecha: r.fecha || '', instructor: r.instructor || '',
    materiales: Array.isArray(mats) ? mats : [],
    creadoPor: r.creado_por || '', activo: r.activo !== false,
  };
}
async function sbSaveCapacitacion(c) {
  await sbFetch('capacitaciones','POST',{
    id:c.id, titulo:c.titulo, tipo:c.tipo, categoria:c.categoria || '',
    descripcion:c.descripcion || '', area_id:c.areaId || null, cargo:c.cargo || '',
    obligatoria:!!c.obligatoria, duracion_horas:c.duracionHoras || 0,
    vigencia_meses:c.vigenciaMeses || 0, fecha:c.fecha || '',
    instructor:c.instructor || '', materiales:c.materiales || [],
    creado_por:c.creadoPor || '', activo:c.activo !== false,
  },'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}

function dbToCapAsignacion(r) {
  return {
    id: r.id, capId: r.capacitacion_id, empId: r.emp_id,
    estado: r.estado || 'pendiente',
    fechaAsignacion: r.fecha_asignacion || '', fechaCompletado: r.fecha_completado || '',
    calificacion: r.calificacion, certificadoUrl: r.certificado_url || null,
    certificadoNombre: r.certificado_nombre || '',
    certificadoEstado: r.certificado_estado || 'sin_cargar',
    validadoPor: r.validado_por || '', fechaValidacion: r.fecha_validacion || '',
    observaciones: r.observaciones || '', asignadoPor: r.asignado_por || '',
  };
}
async function sbSaveCapAsignacion(a) {
  await sbFetch('capacitacion_asignaciones','POST',{
    id:a.id, capacitacion_id:a.capId, emp_id:a.empId, estado:a.estado || 'pendiente',
    fecha_asignacion:a.fechaAsignacion || '', fecha_completado:a.fechaCompletado || '',
    calificacion:a.calificacion ?? null, certificado_url:a.certificadoUrl || null,
    certificado_nombre:a.certificadoNombre || '',
    certificado_estado:a.certificadoEstado || 'sin_cargar',
    validado_por:a.validadoPor || '', fecha_validacion:a.fechaValidacion || '',
    observaciones:a.observaciones || '', asignado_por:a.asignadoPor || '',
  },'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}

function dbToHseqDoc(r) {
  return {
    id:r.id, tipo:r.tipo || 'politica', ambito:r.ambito || 'general',
    titulo:r.titulo || '', codigo:r.codigo || '', version:r.version || '',
    descripcion:r.descripcion || '', fechaVigencia:r.fecha_vigencia || '',
    visibleEmpleados: r.visible_empleados !== false,
    archivoUrl:r.archivo_url || null, archivoNombre:r.archivo_nombre || '',
    subidoPor:r.subido_por || '',
  };
}
async function sbSaveHseqDoc(d) {
  await sbFetch('hseq_documentos','POST',{
    id:d.id, tipo:d.tipo, ambito:d.ambito, titulo:d.titulo, codigo:d.codigo || '',
    version:d.version || '', descripcion:d.descripcion || '',
    fecha_vigencia:d.fechaVigencia || '', visible_empleados:!!d.visibleEmpleados,
    archivo_url:d.archivoUrl || null, archivo_nombre:d.archivoNombre || '',
    subido_por:d.subidoPor || '',
  },'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}

function dbToHseqCert(r) {
  return {
    id:r.id, norma:r.norma || '', alcance:r.alcance || '',
    ente:r.ente_certificador || '', numero:r.numero || '',
    empresaId:r.empresa_id || null,
    fechaEmision:r.fecha_emision || '', fechaVencimiento:r.fecha_vencimiento || '',
    estado:r.estado || 'vigente', observaciones:r.observaciones || '',
    archivoUrl:r.archivo_url || null, archivoNombre:r.archivo_nombre || '',
    registradoPor:r.registrado_por || '',
  };
}
async function sbSaveHseqCert(c) {
  await sbFetch('hseq_certificaciones','POST',{
    id:c.id, norma:c.norma, alcance:c.alcance || '', ente_certificador:c.ente || '',
    numero:c.numero || '', empresa_id:c.empresaId || null,
    fecha_emision:c.fechaEmision || '', fecha_vencimiento:c.fechaVencimiento || '',
    estado:c.estado || 'vigente', observaciones:c.observaciones || '',
    archivo_url:c.archivoUrl || null, archivo_nombre:c.archivoNombre || '',
    registrado_por:c.registradoPor || '',
  },'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}

function dbToComiteMiembro(r) {
  return {
    id:r.id, comite:r.comite, empId:r.emp_id, rolComite:r.rol_comite || 'principal',
    representacion:r.representacion || 'trabajadores',
    periodoInicio:r.periodo_inicio || '', periodoFin:r.periodo_fin || '',
    activo:r.activo !== false, designadoPor:r.designado_por || '',
  };
}
async function sbSaveComiteMiembro(m) {
  await sbFetch('comite_miembros','POST',{
    id:m.id, comite:m.comite, emp_id:m.empId, rol_comite:m.rolComite,
    representacion:m.representacion, periodo_inicio:m.periodoInicio || '',
    periodo_fin:m.periodoFin || '', activo:m.activo !== false,
    designado_por:m.designadoPor || '',
  },'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}

function dbToComiteActa(r) {
  return {
    id:r.id, comite:r.comite, numero:r.numero || '', fecha:r.fecha || '',
    tipo:r.tipo || 'reunion', tema:r.tema || '', descripcion:r.descripcion || '',
    compromisos:r.compromisos || '', asistentes:r.asistentes || '',
    archivoUrl:r.archivo_url || null, archivoNombre:r.archivo_nombre || '',
    registradoPor:r.registrado_por || '',
  };
}
async function sbSaveComiteActa(a) {
  await sbFetch('comite_actas','POST',{
    id:a.id, comite:a.comite, numero:a.numero || '', fecha:a.fecha || '',
    tipo:a.tipo || 'reunion', tema:a.tema || '', descripcion:a.descripcion || '',
    compromisos:a.compromisos || '', asistentes:a.asistentes || '',
    archivo_url:a.archivoUrl || null, archivo_nombre:a.archivoNombre || '',
    registrado_por:a.registradoPor || '',
  },'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}

// ─── CARGA INICIAL DESDE SUPABASE ──────────────────────────────
// Se invoca desde loadFromSupabase() en app.js. Si alguna tabla aún
// no existe, el módulo sigue funcionando con las demás.
async function cargarHSEQDesdeSupabase() {
  try {
    const [caps, asigs, docs, certs, miem, actas] = await Promise.all([
      sbFetch('capacitaciones',            'GET', null, '?select=*&order=created_at.asc'),
      sbFetch('capacitacion_asignaciones', 'GET', null, '?select=*&order=created_at.asc'),
      sbFetch('hseq_documentos',           'GET', null, '?select=*&order=created_at.asc'),
      sbFetch('hseq_certificaciones',      'GET', null, '?select=*&order=created_at.asc'),
      sbFetch('comite_miembros',           'GET', null, '?select=*&order=created_at.asc'),
      sbFetch('comite_actas',              'GET', null, '?select=*&order=created_at.asc'),
    ]);
    if (caps  !== null) SC.capacitaciones  = caps.map(dbToCapacitacion);
    if (asigs !== null) SC.capAsignaciones = asigs.map(dbToCapAsignacion);
    if (docs  !== null) SC.hseqDocs        = docs.map(dbToHseqDoc);
    if (certs !== null) SC.hseqCerts       = certs.map(dbToHseqCert);
    if (miem  !== null) SC.comiteMiembros  = miem.map(dbToComiteMiembro);
    if (actas !== null) SC.comiteActas     = actas.map(dbToComiteActa);
  } catch(e) {
    console.warn('HSEQ: no se pudieron cargar los datos —', e.message);
  }
}
window.cargarHSEQDesdeSupabase = cargarHSEQDesdeSupabase;

// ─── NAVEGACIÓN (llamado desde buildSidebar) ───────────────────
function agregarNavHSEQ(nav) {
  if (typeof addNavItem !== 'function') return;
  if (puedeVerHSEQ()) {
    addNavSep(nav, 'HSEQ & SIG');
    addNavItem(nav, '🦺', puedeGestionarHSEQ() ? 'Módulo HSEQ' : 'HSEQ (lectura)', 'hseq');
    return;   // los comités ya están dentro del módulo
  }
  agregarNavComites(nav);
}
// Miembros elegidos de COPASST/COCOLAB: acceso de solo lectura al comité
function agregarNavComites(nav) {
  if (typeof addNavItem !== 'function') return;
  const lista = misComites();
  if (!lista.length) return;
  addNavSep(nav, 'MIS COMITÉS');
  lista.forEach(k => addNavItem(nav, COMITES[k].icon, COMITES[k].label, 'comite-' + k));
}
window.agregarNavHSEQ    = agregarNavHSEQ;
window.agregarNavComites = agregarNavComites;


// ═══════════════════════════════════════════════════════════════
// VISTA PRINCIPAL DEL MÓDULO HSEQ
// ═══════════════════════════════════════════════════════════════
let currentHseqTab = 'docs';

function renderHSEQ(tab) {
  const root = document.getElementById('hseq-root');
  if (!root) return;
  if (!puedeVerHSEQ()) {
    root.innerHTML = '<div class="glass-card p-6 text-center text-muted">No tienes acceso al módulo HSEQ.</div>';
    return;
  }
  currentHseqTab = tab || currentHseqTab || 'docs';

  const tabs = [
    ['docs',           '📜 Políticas y Formatos'],
    ['capacitaciones', '🎓 Inducciones y Capacitaciones'],
    ['certificados',   '📑 Certificados de Colaboradores'],
    ['copasst',        '🦺 COPASST'],
    ['cocolab',        '🤝 COCOLAB'],
    ['iso',            '🏅 Certificaciones'],
  ];

  const bannerLectura = hseqSoloLectura()
    ? `<div class="readonly-banner mb-4"><span>🔒</span>
         <span>Modo solo lectura — Rol: ${hseqEsc(SC.user?.roleName || '')}. Puedes consultar toda la información del sistema de gestión.</span>
       </div>` : '';

  root.innerHTML = `
    ${bannerLectura}
    <div class="tabs mb-4" style="flex-wrap:wrap" id="hseq-tabs">
      ${tabs.map(([k,l]) =>
        `<div class="tab ${k === currentHseqTab ? 'active' : ''}" onclick="hseqTab('${k}')">${l}</div>`
      ).join('')}
    </div>
    <div id="hseq-content"></div>`;

  renderHSEQTabContent();
}
window.renderHSEQ = renderHSEQ;

function hseqTab(tab) {
  currentHseqTab = tab;
  document.querySelectorAll('#hseq-tabs .tab').forEach(t => {
    t.className = t.getAttribute('onclick').includes(`'${tab}'`) ? 'tab active' : 'tab';
  });
  renderHSEQTabContent();
}
window.hseqTab = hseqTab;

function renderHSEQTabContent() {
  const c = document.getElementById('hseq-content');
  if (!c) return;
  if (currentHseqTab === 'docs')           renderHSEQDocs(c);
  else if (currentHseqTab === 'capacitaciones') renderHSEQCapacitaciones(c);
  else if (currentHseqTab === 'certificados')   renderHSEQCertificados(c);
  else if (currentHseqTab === 'copasst')   c.innerHTML = buildComiteHTML('copasst', hseqSoloLectura());
  else if (currentHseqTab === 'cocolab')   c.innerHTML = buildComiteHTML('cocolab', hseqSoloLectura());
  else if (currentHseqTab === 'iso')       renderHSEQISO(c);
}

// ─── 1 · POLÍTICAS, FORMATOS Y PROCEDIMIENTOS ──────────────────
function renderHSEQDocs(container) {
  const q    = (document.getElementById('hseq-doc-q')?.value || '').toLowerCase();
  const filt = document.getElementById('hseq-doc-tipo')?.value || '';
  const docs = (SC.hseqDocs || []).filter(d => d.ambito === 'general');

  const vistos = docs.filter(d => {
    if (filt && d.tipo !== filt) return false;
    if (q && !(`${d.titulo} ${d.codigo} ${d.descripcion}`.toLowerCase().includes(q))) return false;
    return true;
  });

  const grupos = {};
  vistos.forEach(d => { (grupos[d.tipo] = grupos[d.tipo] || []).push(d); });

  let html = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">📜 Políticas, Formatos y <span>Procedimientos</span></div>
      ${!hseqSoloLectura()
        ? `<button class="btn btn-primary btn-sm" onclick="openHseqDocModal('general')">+ Nuevo Documento</button>` : ''}
    </div>
    <div class="info-box mb-4" style="font-size:12px">
      Documentos del Sistema de Gestión (HSEQ / SIG). Los marcados como
      <b>visibles para colaboradores</b> aparecen en el portal de cada empleado.
    </div>
    <div class="filter-bar mb-4">
      <input id="hseq-doc-q" class="form-input search-input" placeholder="🔍 Buscar por nombre o código..."
        value="${hseqEsc(q)}" oninput="renderHSEQTabContent()">
      <select id="hseq-doc-tipo" class="form-select" style="width:190px" onchange="renderHSEQTabContent()">
        <option value="">Todos los tipos</option>
        ${Object.entries(TIPOS_DOC_HSEQ).map(([k,v]) =>
          `<option value="${k}" ${filt === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
      </select>
    </div>`;

  if (!vistos.length) {
    html += `<div class="glass-card p-6 text-center text-muted">
      ${docs.length ? 'Ningún documento coincide con el filtro.' : 'Aún no hay documentos cargados en el sistema de gestión.'}
    </div>`;
    container.innerHTML = html;
    return;
  }

  Object.entries(grupos).forEach(([tipo, lista]) => {
    const t = TIPOS_DOC_HSEQ[tipo] || { label:tipo, icon:'📁' };
    html += `<div class="mb-5">
      <div class="bodega-cat-title">${t.icon} ${t.label} <span class="badge badge-grey">${lista.length}</span></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${lista.map(d => hseqDocCard(d)).join('')}
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function hseqDocCard(d) {
  const t = TIPOS_DOC_HSEQ[d.tipo] || { label:d.tipo, icon:'📁' };
  return `<div class="glass-card p-4" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <div style="font-size:26px">${t.icon}</div>
    <div style="flex:1;min-width:200px">
      <div style="font-weight:700;color:var(--navy);font-size:14px">
        ${hseqEsc(d.titulo)}
        ${d.codigo ? `<span class="badge badge-grey" style="margin-left:6px">${hseqEsc(d.codigo)}</span>` : ''}
        ${d.version ? `<span class="badge badge-blue" style="margin-left:4px">v${hseqEsc(d.version)}</span>` : ''}
      </div>
      ${d.descripcion ? `<div class="text-sm text-muted" style="margin-top:2px">${hseqEsc(d.descripcion)}</div>` : ''}
      <div class="text-xs text-muted" style="margin-top:4px">
        ${d.fechaVigencia ? `📅 Vigencia: ${hseqEsc(d.fechaVigencia)} · ` : ''}
        ${d.subidoPor ? `Cargado por ${hseqEsc(d.subidoPor)}` : ''}
        ${d.ambito === 'general'
          ? (d.visibleEmpleados
              ? ' · <span style="color:var(--green)">👁 Visible para colaboradores</span>'
              : ' · <span style="color:var(--text-muted)">🔒 Uso interno HSEQ</span>')
          : ''}
      </div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      ${d.archivoUrl
        ? `<a href="${d.archivoUrl}" target="_blank" class="btn btn-ghost btn-sm">👁️ Ver</a>`
        : '<span class="badge badge-grey">Sin archivo</span>'}
      ${!hseqSoloLectura()
        ? `<button class="btn btn-ghost btn-sm" onclick="openHseqDocModal('${d.ambito}','${d.id}')" title="Editar">✏️</button>
           <button class="btn btn-danger btn-sm" onclick="eliminarHseqDoc('${d.id}')" title="Eliminar">🗑</button>` : ''}
    </div>
  </div>`;
}

// ─── 2 · CATÁLOGO DE INDUCCIONES Y CAPACITACIONES ──────────────
function renderHSEQCapacitaciones(container) {
  const q    = (document.getElementById('hseq-cap-q')?.value || '').toLowerCase();
  const filt = document.getElementById('hseq-cap-tipo')?.value || '';
  const caps = (SC.capacitaciones || []).filter(c => {
    if (filt && c.tipo !== filt) return false;
    if (q && !(`${c.titulo} ${c.categoria} ${c.descripcion}`.toLowerCase().includes(q))) return false;
    return true;
  }).sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));

  let html = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">🎓 Inducciones y <span>Capacitaciones</span></div>
      ${!hseqSoloLectura()
        ? `<button class="btn btn-primary btn-sm" onclick="openCapacitacionModal()">+ Nueva Capacitación</button>` : ''}
    </div>
    <div class="info-box mb-4" style="font-size:12px">
      Cada capacitación puede incluir <b>presentaciones, documentos y videos</b>.
      Al asignarla, el colaborador la ve en su portal, consulta el material y
      <b>carga su certificado</b> para que HSEQ lo valide.
    </div>
    <div class="filter-bar mb-4">
      <input id="hseq-cap-q" class="form-input search-input" placeholder="🔍 Buscar capacitación..."
        value="${hseqEsc(q)}" oninput="renderHSEQTabContent()">
      <select id="hseq-cap-tipo" class="form-select" style="width:200px" onchange="renderHSEQTabContent()">
        <option value="">Todos los tipos</option>
        ${Object.entries(TIPOS_CAPACITACION).map(([k,v]) =>
          `<option value="${k}" ${filt === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
      </select>
    </div>`;

  if (!caps.length) {
    html += '<div class="glass-card p-6 text-center text-muted">Aún no hay capacitaciones registradas.</div>';
    container.innerHTML = html;
    return;
  }

  html += '<div style="display:flex;flex-direction:column;gap:12px">';
  caps.forEach(c => {
    const t     = TIPOS_CAPACITACION[c.tipo] || { label:c.tipo, icon:'🎓', color:'var(--navy)' };
    const asigs = (SC.capAsignaciones || []).filter(a => a.capId === c.id);
    const hechas= asigs.filter(a => a.estado === 'completada').length;
    const pctOk = asigs.length ? Math.round(hechas / asigs.length * 100) : 0;
    const porValidar = asigs.filter(a => a.certificadoEstado === 'pendiente').length;

    html += `<div class="glass-card p-4" style="border-left:4px solid ${t.color}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px">
          <div style="font-weight:700;color:var(--navy);font-size:15px">
            ${t.icon} ${hseqEsc(c.titulo)}
            ${c.obligatoria ? '<span class="badge badge-red" style="margin-left:6px">Obligatoria</span>' : ''}
            ${!c.activo ? '<span class="badge badge-grey" style="margin-left:4px">Inactiva</span>' : ''}
          </div>
          <div class="text-xs text-muted" style="margin:3px 0 6px">
            ${t.label} · ${hseqNombreArea(c.areaId)}
            ${c.duracionHoras ? ` · ⏱ ${c.duracionHoras}h` : ''}
            ${c.vigenciaMeses ? ` · 🔁 Vigencia ${c.vigenciaMeses} meses` : ''}
            ${c.instructor ? ` · 👨‍🏫 ${hseqEsc(c.instructor)}` : ''}
          </div>
          ${c.descripcion ? `<div class="text-sm" style="white-space:pre-wrap;margin-bottom:8px">${hseqEsc(c.descripcion)}</div>` : ''}
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${(c.materiales || []).length
              ? c.materiales.map((m, i) => {
                  const tm = TIPOS_MATERIAL[m.tipo] || { icon:'📎', label:m.tipo };
                  return `<a href="${m.url}" target="_blank" class="btn btn-ghost btn-sm"
                            title="${tm.label}">${tm.icon} ${hseqEsc(m.nombre || tm.label)}</a>`;
                }).join('')
              : '<span class="text-xs text-muted">Sin material cargado todavía</span>'}
          </div>
        </div>
        <div style="min-width:190px">
          <div class="text-xs text-muted mb-1">Cumplimiento: <b>${hechas}/${asigs.length}</b> (${pctOk}%)</div>
          <div style="height:8px;background:var(--surface);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${pctOk}%;background:${pctOk >= 80 ? 'var(--green)' : pctOk >= 40 ? 'var(--amber)' : 'var(--red)'};border-radius:99px"></div>
          </div>
          ${porValidar ? `<div class="text-xs" style="color:var(--amber);margin-top:6px">⏳ ${porValidar} certificado(s) por validar</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
            ${!hseqSoloLectura()
              ? `<button class="btn btn-primary btn-sm" onclick="openAsignarCapModal('${c.id}')">👥 Asignar</button>
                 <button class="btn btn-ghost btn-sm" onclick="openCapacitacionModal('${c.id}')">✏️</button>
                 <button class="btn btn-danger btn-sm" onclick="eliminarCapacitacion('${c.id}')">🗑</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="hseqTab('certificados');setTimeout(()=>{const s=document.getElementById('hseq-cert-cap');if(s){s.value='${c.id}';renderHSEQTabContent();}},60)">📑 Ver avance</button>
          </div>
        </div>
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ─── 3 · CERTIFICADOS DE LOS COLABORADORES ─────────────────────
function renderHSEQCertificados(container) {
  const fArea = document.getElementById('hseq-cert-area')?.value || '';
  const fCap  = document.getElementById('hseq-cert-cap')?.value  || '';
  const fEst  = document.getElementById('hseq-cert-estado')?.value || '';
  const q     = (document.getElementById('hseq-cert-q')?.value || '').toLowerCase();

  const empsVis = hseqEmpleadosVisibles();
  const idsVis  = new Set(empsVis.map(e => e.id));

  let filas = (SC.capAsignaciones || []).filter(a => idsVis.has(a.empId));
  const total       = filas.length;
  const completadas = filas.filter(a => a.estado === 'completada').length;
  const porValidar  = filas.filter(a => a.certificadoEstado === 'pendiente').length;
  const vencidos    = filas.filter(a => {
    const cap = SC.capacitaciones.find(c => c.id === a.capId);
    return hseqVigencia(a, cap).estado === 'vencido';
  }).length;

  filas = filas.filter(a => {
    const emp = SC.empleados.find(e => e.id === a.empId);
    const cap = SC.capacitaciones.find(c => c.id === a.capId);
    if (fArea && String(emp?.areaId) !== String(fArea)) return false;
    if (fCap  && a.capId !== fCap) return false;
    if (fEst === 'pendiente_validar' && a.certificadoEstado !== 'pendiente') return false;
    if (fEst === 'completada'  && a.estado !== 'completada') return false;
    if (fEst === 'pendiente'   && a.estado === 'completada') return false;
    if (fEst === 'vencido'     && hseqVigencia(a, cap).estado !== 'vencido') return false;
    if (fEst === 'sin_certificado' && a.certificadoUrl) return false;
    if (q && !(`${emp?.name || ''} ${emp?.cedula || ''} ${cap?.titulo || ''}`.toLowerCase().includes(q))) return false;
    return true;
  }).sort((a,b) => (b.fechaAsignacion || '').localeCompare(a.fechaAsignacion || ''));

  let html = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">📑 Certificados de <span>Capacitación</span></div>
      <div class="flex gap-2">
        <button class="btn btn-ghost btn-sm" onclick="exportarCertificadosCSV()">⬇ Exportar CSV</button>
      </div>
    </div>
    <div class="stats-grid mb-4">
      <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-label">Asignaciones</div><div class="stat-value">${total}</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Completadas</div><div class="stat-value" style="color:var(--green)">${completadas}</div></div>
      <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-label">Por validar</div><div class="stat-value" style="color:var(--amber)">${porValidar}</div></div>
      <div class="stat-card"><div class="stat-icon">⛔</div><div class="stat-label">Vencidos</div><div class="stat-value" style="color:var(--red)">${vencidos}</div></div>
    </div>
    <div class="filter-bar mb-4">
      <input id="hseq-cert-q" class="form-input search-input" placeholder="🔍 Colaborador o capacitación..."
        value="${hseqEsc(q)}" oninput="renderHSEQTabContent()">
      <select id="hseq-cert-area" class="form-select" style="width:180px" onchange="renderHSEQTabContent()">
        <option value="">Todas las áreas</option>
        ${SC.areas.map(a => `<option value="${a.id}" ${String(fArea) === String(a.id) ? 'selected' : ''}>${a.icon} ${hseqEsc(a.name)}</option>`).join('')}
      </select>
      <select id="hseq-cert-cap" class="form-select" style="width:220px" onchange="renderHSEQTabContent()">
        <option value="">Todas las capacitaciones</option>
        ${SC.capacitaciones.map(c => `<option value="${c.id}" ${fCap === c.id ? 'selected' : ''}>${hseqEsc(c.titulo)}</option>`).join('')}
      </select>
      <select id="hseq-cert-estado" class="form-select" style="width:190px" onchange="renderHSEQTabContent()">
        <option value="">Todos los estados</option>
        <option value="pendiente_validar" ${fEst === 'pendiente_validar' ? 'selected' : ''}>⏳ Por validar</option>
        <option value="completada"        ${fEst === 'completada' ? 'selected' : ''}>✅ Completadas</option>
        <option value="pendiente"         ${fEst === 'pendiente' ? 'selected' : ''}>🕓 Pendientes</option>
        <option value="sin_certificado"   ${fEst === 'sin_certificado' ? 'selected' : ''}>📭 Sin certificado</option>
        <option value="vencido"           ${fEst === 'vencido' ? 'selected' : ''}>⛔ Vencidos</option>
      </select>
    </div>`;

  if (!filas.length) {
    html += '<div class="glass-card p-6 text-center text-muted">No hay registros con estos filtros.</div>';
    container.innerHTML = html;
    return;
  }

  html += `<div class="glass-card p-4"><div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th>Colaborador</th><th>Área</th><th>Capacitación</th><th>Tipo</th>
      <th>Estado</th><th>Completado</th><th>Vigencia</th><th>Certificado</th><th></th>
    </tr></thead><tbody>`;

  filas.forEach(a => {
    const emp = SC.empleados.find(e => e.id === a.empId);
    const cap = SC.capacitaciones.find(c => c.id === a.capId);
    const t   = TIPOS_CAPACITACION[cap?.tipo] || { label:'—', icon:'🎓' };
    const vig = hseqVigencia(a, cap);
    const area= SC.areas.find(x => String(x.id) === String(emp?.areaId));

    const estadoBadge = a.estado === 'completada'
      ? '<span class="badge badge-green">✅ Completada</span>'
      : a.estado === 'en_curso'
        ? '<span class="badge badge-blue">▶ En curso</span>'
        : '<span class="badge badge-yellow">🕓 Pendiente</span>';

    const certCell = a.certificadoUrl
      ? `<a href="${a.certificadoUrl}" target="_blank" class="btn btn-ghost btn-sm">👁️ Ver</a>
         ${a.certificadoEstado === 'aprobado'  ? '<span class="badge badge-green">Validado</span>' : ''}
         ${a.certificadoEstado === 'pendiente' ? '<span class="badge badge-yellow">Por validar</span>' : ''}
         ${a.certificadoEstado === 'rechazado' ? '<span class="badge badge-red">Rechazado</span>' : ''}`
      : '<span class="badge badge-grey">Sin cargar</span>';

    html += `<tr>
      <td><div style="font-weight:600">${hseqEsc(emp?.name || '—')}</div>
          <div class="text-xs text-muted">${hseqEsc(emp?.cedula || '')}</div></td>
      <td class="text-sm">${area ? area.icon + ' ' + hseqEsc(area.name) : '—'}</td>
      <td class="text-sm">${hseqEsc(cap?.titulo || '—')}</td>
      <td class="text-sm">${t.icon} ${t.label}</td>
      <td>${estadoBadge}</td>
      <td class="text-xs text-muted">${hseqEsc(a.fechaCompletado || '—')}</td>
      <td>${hseqBadgeVigencia(vig) || '<span class="text-xs text-muted">—</span>'}</td>
      <td style="white-space:nowrap">${certCell}</td>
      <td style="white-space:nowrap">
        ${!hseqSoloLectura() && a.certificadoUrl && a.certificadoEstado !== 'aprobado'
          ? `<button class="btn btn-primary btn-sm" onclick="validarCertificadoCap('${a.id}',true)" title="Validar certificado">✅</button>
             <button class="btn btn-danger btn-sm" onclick="validarCertificadoCap('${a.id}',false)" title="Rechazar certificado">✗</button>` : ''}
        ${!hseqSoloLectura() && !a.certificadoUrl
          ? `<label class="btn btn-ghost btn-sm" style="cursor:pointer" title="Cargar certificado en nombre del colaborador">📤
               <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none"
                 onchange="subirCertificadoCap('${a.id}',event)"></label>` : ''}
        ${!hseqSoloLectura()
          ? `<button class="btn btn-danger btn-sm" onclick="eliminarAsignacionCap('${a.id}')" title="Quitar asignación">🗑</button>` : ''}
      </td>
    </tr>`;
  });

  html += '</tbody></table></div></div>';
  container.innerHTML = html;
}

// ─── 4 · CERTIFICACIONES ISO Y OTRAS ───────────────────────────
function renderHSEQISO(container) {
  const certs = (SC.hseqCerts || []).slice()
    .sort((a,b) => (a.fechaVencimiento || '').localeCompare(b.fechaVencimiento || ''));

  const estadoReal = c => {
    if (!c.fechaVencimiento) return c.estado || 'vigente';
    const dias = Math.floor((new Date(c.fechaVencimiento) - new Date(hseqHoy())) / 86400000);
    if (dias < 0)  return 'vencida';
    if (dias <= 60) return 'por_vencer';
    return c.estado || 'vigente';
  };
  const badge = e => ({
    vigente:    '<span class="badge badge-green">✅ Vigente</span>',
    por_vencer: '<span class="badge badge-yellow">⏳ Por vencer</span>',
    vencida:    '<span class="badge badge-red">⛔ Vencida</span>',
    en_proceso: '<span class="badge badge-blue">🔄 En proceso</span>',
    suspendida: '<span class="badge badge-red">⏸ Suspendida</span>',
  })[e] || '<span class="badge badge-grey">—</span>';

  let html = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">🏅 Certificaciones <span>ISO y otras</span></div>
      ${!hseqSoloLectura()
        ? `<button class="btn btn-primary btn-sm" onclick="openHseqCertModal()">+ Nueva Certificación</button>` : ''}
    </div>
    <div class="info-box mb-4" style="font-size:12px">
      Registro de certificaciones de la organización (ISO 9001, ISO 14001, ISO 45001,
      RUC, BASC y demás). El sistema avisa cuando falten menos de 60 días para el vencimiento.
    </div>`;

  if (!certs.length) {
    html += '<div class="glass-card p-6 text-center text-muted">Aún no hay certificaciones registradas.</div>';
    container.innerHTML = html;
    return;
  }

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">';
  certs.forEach(c => {
    const est = estadoReal(c);
    const empresa = SC.empresas.find(e => e.id === c.empresaId);
    html += `<div class="glass-card p-4" style="border-left:4px solid ${est === 'vencida' ? 'var(--red)' : est === 'por_vencer' ? 'var(--amber)' : 'var(--green)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="font-weight:700;color:var(--navy);font-size:15px">🏅 ${hseqEsc(c.norma)}</div>
        ${badge(est)}
      </div>
      ${c.alcance ? `<div class="text-sm" style="margin:6px 0">${hseqEsc(c.alcance)}</div>` : ''}
      <div class="text-xs text-muted" style="line-height:1.7;margin-top:6px">
        ${c.ente ? `🏛 Ente certificador: ${hseqEsc(c.ente)}<br>` : ''}
        ${c.numero ? `#️⃣ Certificado: ${hseqEsc(c.numero)}<br>` : ''}
        ${empresa ? `🏢 ${hseqEsc(empresa.name)}<br>` : ''}
        ${c.fechaEmision ? `📅 Emisión: ${hseqEsc(c.fechaEmision)}<br>` : ''}
        ${c.fechaVencimiento ? `⏰ Vence: <b>${hseqEsc(c.fechaVencimiento)}</b>` : ''}
      </div>
      ${c.observaciones ? `<div class="text-xs" style="margin-top:6px;white-space:pre-wrap">${hseqEsc(c.observaciones)}</div>` : ''}
      <div style="display:flex;gap:6px;margin-top:12px">
        ${c.archivoUrl ? `<a href="${c.archivoUrl}" target="_blank" class="btn btn-ghost btn-sm">👁️ Ver certificado</a>`
                       : '<span class="badge badge-grey">Sin archivo</span>'}
        ${!hseqSoloLectura()
          ? `<button class="btn btn-ghost btn-sm" onclick="openHseqCertModal('${c.id}')">✏️</button>
             <button class="btn btn-danger btn-sm" onclick="eliminarHseqCert('${c.id}')">🗑</button>` : ''}
      </div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}


// ═══════════════════════════════════════════════════════════════
// COPASST Y COCOLAB
// Misma vista para HSEQ (edición) y para los miembros elegidos
// del comité (solo lectura).
// ═══════════════════════════════════════════════════════════════
function buildComiteHTML(comite, soloLectura) {
  const info    = COMITES[comite];
  if (!info) return '<div class="text-muted">Comité no encontrado.</div>';
  const ro      = soloLectura !== false;
  const miembros= (SC.comiteMiembros || []).filter(m => m.comite === comite)
                    .sort((a,b) => (a.activo === b.activo) ? 0 : (a.activo ? -1 : 1));
  const activos = miembros.filter(m => m.activo !== false);
  const docs    = (SC.hseqDocs || []).filter(d => d.ambito === comite);
  const actas   = (SC.comiteActas || []).filter(a => a.comite === comite)
                    .sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const periodo = activos.length
    ? `${activos[0].periodoInicio || '—'} a ${activos[0].periodoFin || '—'}` : '—';

  let html = `
    <div class="glass-card p-5 mb-4" style="border-left:4px solid ${info.color}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-weight:800;font-size:18px;color:var(--navy)">${info.icon} ${info.label}</div>
          <div class="text-sm text-muted">${info.nombre}</div>
          <div class="text-xs text-muted" style="margin-top:6px">
            👥 ${activos.length} integrante(s) activo(s) · 📅 Período: ${hseqEsc(periodo)}
            · 📋 ${actas.length} acta(s) · 📄 ${docs.length} documento(s)
          </div>
        </div>
        ${ro ? '<span class="badge badge-grey">🔒 Solo lectura</span>' : ''}
      </div>
    </div>`;

  // ── Integrantes ──
  html += `
    <div class="section-header mb-3">
      <div class="section-title" style="font-size:15px">👥 Integrantes del <span>${info.label}</span></div>
      ${!ro ? `<button class="btn btn-primary btn-sm" onclick="openComiteMiembroModal('${comite}')">+ Agregar Integrante</button>` : ''}
    </div>`;

  if (!miembros.length) {
    html += '<div class="glass-card p-5 text-center text-muted mb-5">Aún no se han designado integrantes de este comité.</div>';
  } else {
    html += '<div class="glass-card p-4 mb-5"><div class="table-wrap"><table class="data-table"><thead><tr>' +
            '<th>Integrante</th><th>Cargo</th><th>Rol en el comité</th><th>Representación</th><th>Período</th><th>Estado</th>' +
            (ro ? '' : '<th></th>') + '</tr></thead><tbody>';
    miembros.forEach(m => {
      const emp = SC.empleados.find(e => e.id === m.empId);
      const rc  = ROLES_COMITE[m.rolComite] || { label:m.rolComite, icon:'👤' };
      html += `<tr style="${m.activo === false ? 'opacity:.55' : ''}">
        <td><div style="font-weight:600">${hseqEsc(emp?.name || '—')}</div>
            <div class="text-xs text-muted">${hseqEsc(emp?.cedula || '')}</div></td>
        <td class="text-sm">${hseqEsc(emp?.cargo || '—')}</td>
        <td>${rc.icon} ${rc.label}</td>
        <td class="text-sm">${m.representacion === 'empleador' ? '🏢 Empleador' : '👷 Trabajadores'}</td>
        <td class="text-xs text-muted">${hseqEsc(m.periodoInicio || '—')} → ${hseqEsc(m.periodoFin || '—')}</td>
        <td>${m.activo === false ? '<span class="badge badge-grey">Inactivo</span>' : '<span class="badge badge-green">Activo</span>'}</td>
        ${ro ? '' : `<td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="openComiteMiembroModal('${comite}','${m.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarComiteMiembro('${m.id}')">🗑</button></td>`}
      </tr>`;
    });
    html += '</tbody></table></div>' +
      (ro ? '' : `<div class="text-xs text-muted mt-3">Los integrantes activos acceden automáticamente a este módulo en modo lectura desde su portal.</div>`) +
      '</div>';
  }

  // ── Documentos del comité ──
  html += `
    <div class="section-header mb-3">
      <div class="section-title" style="font-size:15px">📄 Documentos del <span>${info.label}</span></div>
      ${!ro ? `<button class="btn btn-primary btn-sm" onclick="openHseqDocModal('${comite}')">+ Nuevo Documento</button>` : ''}
    </div>`;
  if (!docs.length) {
    html += '<div class="glass-card p-5 text-center text-muted mb-5">Sin documentos cargados para este comité.</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:22px">' +
            docs.map(d => hseqDocCardComite(d, ro)).join('') + '</div>';
  }

  // ── Actas y reuniones ──
  html += `
    <div class="section-header mb-3">
      <div class="section-title" style="font-size:15px">📋 Actas y <span>Reuniones</span></div>
      ${!ro ? `<button class="btn btn-primary btn-sm" onclick="openComiteActaModal('${comite}')">+ Nueva Acta</button>` : ''}
    </div>`;
  if (!actas.length) {
    html += '<div class="glass-card p-5 text-center text-muted">Aún no hay actas registradas.</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:10px">';
    actas.forEach(a => {
      html += `<div class="glass-card p-4">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:220px">
            <div style="font-weight:700;color:var(--navy)">
              📋 ${hseqEsc(a.tema || 'Reunión')} ${a.numero ? `<span class="badge badge-grey">Acta ${hseqEsc(a.numero)}</span>` : ''}
            </div>
            <div class="text-xs text-muted" style="margin:2px 0 8px">
              ${hseqEsc(a.fecha || '')} · ${hseqEsc(a.tipo || 'reunion')}
              ${a.registradoPor ? ` · por ${hseqEsc(a.registradoPor)}` : ''}
            </div>
            ${a.descripcion ? `<div class="text-sm" style="white-space:pre-wrap">${hseqEsc(a.descripcion)}</div>` : ''}
            ${a.compromisos ? `<div class="text-sm" style="margin-top:8px;white-space:pre-wrap"><b>Compromisos:</b> ${hseqEsc(a.compromisos)}</div>` : ''}
            ${a.asistentes ? `<div class="text-xs text-muted" style="margin-top:6px">👥 Asistentes: ${hseqEsc(a.asistentes)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            ${a.archivoUrl ? `<a href="${a.archivoUrl}" target="_blank" class="btn btn-ghost btn-sm">📎 Ver acta</a>` : ''}
            ${!ro ? `<div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" onclick="openComiteActaModal('${a.comite}','${a.id}')">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="eliminarComiteActa('${a.id}')">🗑</button></div>` : ''}
          </div>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  return html;
}
window.buildComiteHTML = buildComiteHTML;

function hseqDocCardComite(d, ro) {
  const t = TIPOS_DOC_HSEQ[d.tipo] || { label:d.tipo, icon:'📁' };
  return `<div class="glass-card p-4" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <div style="font-size:24px">${t.icon}</div>
    <div style="flex:1;min-width:200px">
      <div style="font-weight:700;color:var(--navy);font-size:14px">${hseqEsc(d.titulo)}
        ${d.codigo ? `<span class="badge badge-grey" style="margin-left:6px">${hseqEsc(d.codigo)}</span>` : ''}</div>
      ${d.descripcion ? `<div class="text-sm text-muted">${hseqEsc(d.descripcion)}</div>` : ''}
      <div class="text-xs text-muted">${t.label}${d.fechaVigencia ? ' · 📅 ' + hseqEsc(d.fechaVigencia) : ''}</div>
    </div>
    <div style="display:flex;gap:6px">
      ${d.archivoUrl ? `<a href="${d.archivoUrl}" target="_blank" class="btn btn-ghost btn-sm">👁️ Ver</a>`
                     : '<span class="badge badge-grey">Sin archivo</span>'}
      ${!ro ? `<button class="btn btn-ghost btn-sm" onclick="openHseqDocModal('${d.ambito}','${d.id}')">✏️</button>
               <button class="btn btn-danger btn-sm" onclick="eliminarHseqDoc('${d.id}')">🗑</button>` : ''}
    </div>
  </div>`;
}

// Vista independiente para los miembros elegidos del comité (solo lectura)
function renderComiteView(comite) {
  const cont = document.getElementById('comite-' + comite + '-content');
  if (!cont) return;
  if (!puedeVerComite(comite)) {
    cont.innerHTML = '<div class="glass-card p-6 text-center text-muted">No perteneces a este comité.</div>';
    return;
  }
  const info = COMITES[comite];
  const soloLectura = !puedeGestionarHSEQ();
  cont.innerHTML = `
    <div class="readonly-banner mb-4">
      <span>🔒</span>
      <span>Acceso de <b>solo lectura</b> otorgado por HSEQ como integrante del ${info.label}.</span>
    </div>
    ${buildComiteHTML(comite, soloLectura)}`;
}
window.renderComiteView = renderComiteView;


// ═══════════════════════════════════════════════════════════════
// LADO DEL COLABORADOR
// ═══════════════════════════════════════════════════════════════

// Asignaciones de un empleado, ordenadas (pendientes primero)
function asignacionesDeEmpleado(empId) {
  return (SC.capAsignaciones || [])
    .filter(a => a.empId === empId)
    .map(a => ({ a, cap: SC.capacitaciones.find(c => c.id === a.capId) }))
    .filter(x => x.cap)
    .sort((x,y) => {
      const peso = z => z.a.estado === 'completada' ? 2 : 1;
      return peso(x) - peso(y) || (y.a.fechaAsignacion || '').localeCompare(x.a.fechaAsignacion || '');
    });
}
window.asignacionesDeEmpleado = asignacionesDeEmpleado;

// Tarjeta de una capacitación con su material y su certificado.
// modo: 'portal' (el propio colaborador) | 'ficha' (RRHH / HSEQ / líder)
function capacitacionCardHTML(a, cap, modo) {
  const t   = TIPOS_CAPACITACION[cap.tipo] || { label:cap.tipo, icon:'🎓', color:'var(--navy)' };
  const vig = hseqVigencia(a, cap);
  const gestor = modo === 'ficha' && (puedeGestionarHSEQ() || esRRHHoAdmin());

  const estadoBadge = a.estado === 'completada'
    ? '<span class="badge badge-green">✅ Completada</span>'
    : a.estado === 'en_curso'
      ? '<span class="badge badge-blue">▶ En curso</span>'
      : '<span class="badge badge-yellow">🕓 Pendiente</span>';

  const certBadge = {
    aprobado:  '<span class="badge badge-green">✅ Certificado validado</span>',
    pendiente: '<span class="badge badge-yellow">⏳ Certificado en revisión</span>',
    rechazado: '<span class="badge badge-red">❌ Certificado rechazado — cargar de nuevo</span>',
  }[a.certificadoEstado] || '';

  const materiales = (cap.materiales || []).length
    ? `<div style="margin-top:10px">
         <div class="text-xs text-muted" style="font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Material de la capacitación</div>
         <div style="display:flex;gap:6px;flex-wrap:wrap">
           ${cap.materiales.map(m => {
             const tm = TIPOS_MATERIAL[m.tipo] || { icon:'📎', label:m.tipo };
             return `<a href="${m.url}" target="_blank" class="btn btn-ghost btn-sm">${tm.icon} ${hseqEsc(m.nombre || tm.label)}</a>`;
           }).join('')}
         </div>
       </div>`
    : '<div class="text-xs text-muted" style="margin-top:10px">HSEQ aún no ha cargado material para esta capacitación.</div>';

  // Bloque del certificado
  const puedeCargar = (modo === 'portal') || gestor;
  const cargaHtml = a.certificadoUrl
    ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
         <a href="${a.certificadoUrl}" target="_blank" class="btn btn-ghost btn-sm">📄 Ver mi certificado</a>
         ${puedeCargar && a.certificadoEstado !== 'aprobado'
           ? `<label class="btn btn-ghost btn-sm" style="cursor:pointer">🔄 Reemplazar
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none"
                  onchange="subirCertificadoCap('${a.id}',event)"></label>` : ''}
         ${gestor && a.certificadoEstado !== 'aprobado'
           ? `<button class="btn btn-primary btn-sm" onclick="validarCertificadoCap('${a.id}',true)">✅ Validar</button>
              <button class="btn btn-danger btn-sm" onclick="validarCertificadoCap('${a.id}',false)">✗ Rechazar</button>` : ''}
       </div>`
    : puedeCargar
      ? `<label class="btn btn-primary btn-sm" style="cursor:pointer">📤 Cargar certificado
           <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none"
             onchange="subirCertificadoCap('${a.id}',event)"></label>`
      : '<span class="badge badge-grey">Certificado no cargado</span>';

  return `<div class="glass-card p-4" style="border-left:4px solid ${t.color}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:240px">
        <div style="font-weight:700;color:var(--navy);font-size:15px">${t.icon} ${hseqEsc(cap.titulo)}</div>
        <div class="text-xs text-muted" style="margin:3px 0 6px">
          ${t.label}
          ${cap.obligatoria ? ' · <span style="color:var(--red);font-weight:600">Obligatoria</span>' : ''}
          ${cap.duracionHoras ? ` · ⏱ ${cap.duracionHoras}h` : ''}
          ${cap.instructor ? ` · 👨‍🏫 ${hseqEsc(cap.instructor)}` : ''}
          ${a.fechaAsignacion ? ` · Asignada ${hseqEsc(a.fechaAsignacion)}` : ''}
        </div>
        ${cap.descripcion ? `<div class="text-sm" style="white-space:pre-wrap">${hseqEsc(cap.descripcion)}</div>` : ''}
        ${materiales}
      </div>
      <div style="min-width:210px;display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        ${estadoBadge}
        ${hseqBadgeVigencia(vig)}
        ${certBadge}
        ${a.fechaCompletado ? `<div class="text-xs text-muted">Completada: ${hseqEsc(a.fechaCompletado)}</div>` : ''}
        ${a.observaciones ? `<div class="text-xs" style="color:var(--red);text-align:right">${hseqEsc(a.observaciones)}</div>` : ''}
        ${cargaHtml}
        ${gestor ? `<button class="btn btn-danger btn-sm" onclick="eliminarAsignacionCap('${a.id}')">🗑 Quitar</button>` : ''}
      </div>
    </div>
  </div>`;
}

// ── Portal del colaborador: pestaña "Mis Capacitaciones" ──
function renderPortalCapacitaciones() {
  const content = document.getElementById('portal-content');
  if (!content) return;
  const empId = SC.user?.empId;
  const emp   = SC.empleados.find(e => e.id === empId);
  if (!emp) { content.innerHTML = '<div class="text-muted text-sm p-4">No se encontró tu ficha de empleado.</div>'; return; }

  const lista  = asignacionesDeEmpleado(empId);
  const hechas = lista.filter(x => x.a.estado === 'completada').length;
  const pend   = lista.length - hechas;
  const pct    = lista.length ? Math.round(hechas / lista.length * 100) : 0;

  // Políticas y formatos publicados por HSEQ para los colaboradores
  const politicas = (SC.hseqDocs || []).filter(d => d.ambito === 'general' && d.visibleEmpleados);

  let html = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">🎓 Mis Inducciones y <span>Capacitaciones</span></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:18px">
      <div class="stat-card" style="padding:14px;border-left:4px solid var(--navy)">
        <div class="stat-label">Asignadas</div>
        <div class="stat-value" style="font-size:24px">${lista.length}</div>
      </div>
      <div class="stat-card" style="padding:14px;border-left:4px solid var(--green)">
        <div class="stat-label">Completadas</div>
        <div class="stat-value" style="font-size:24px;color:var(--green)">${hechas}</div>
      </div>
      <div class="stat-card" style="padding:14px;border-left:4px solid ${pend ? 'var(--amber)' : 'var(--green)'}">
        <div class="stat-label">Pendientes</div>
        <div class="stat-value" style="font-size:24px;color:${pend ? 'var(--amber)' : 'var(--green)'}">${pend}</div>
      </div>
      <div class="stat-card" style="padding:14px;border-left:4px solid var(--blue)">
        <div class="stat-label">Cumplimiento</div>
        <div class="stat-value" style="font-size:24px;color:var(--blue)">${pct}%</div>
      </div>
    </div>
    <div class="info-box mb-4" style="font-size:12px">
      Revisa el material de cada capacitación (presentaciones, documentos y videos) y
      <b>carga tu certificado</b> al terminarla. HSEQ lo valida y queda en tu historial.
    </div>`;

  html += lista.length
    ? '<div style="display:flex;flex-direction:column;gap:12px">' +
      lista.map(x => capacitacionCardHTML(x.a, x.cap, 'portal')).join('') + '</div>'
    : '<div class="glass-card p-6 text-center text-muted">Todavía no tienes capacitaciones asignadas.</div>';

  // Políticas y formatos de HSEQ visibles para el colaborador
  if (politicas.length) {
    html += `<div class="section-header mt-6 mb-3">
      <div class="section-title" style="font-size:15px">📜 Políticas y Formatos <span>HSEQ</span></div></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${politicas.map(d => hseqDocCardComite(d, true)).join('')}
      </div>`;
  }

  // Si el colaborador es miembro de algún comité, se lo recordamos
  const comites = misComites();
  if (comites.length) {
    html += `<div class="info-box mt-6" style="font-size:12px">
      🏅 Eres integrante de ${comites.map(c => `<b>${COMITES[c].label}</b>`).join(' y ')}.
      Encuentras el módulo del comité en el menú lateral, en modo lectura.</div>`;
  }

  content.innerHTML = html;
}
window.renderPortalCapacitaciones = renderPortalCapacitaciones;

// ── Ficha del empleado: pestaña "Inducción y Capacitación" ──
function renderEmpCapacitaciones(emp, container) {
  if (!emp) { container.innerHTML = '<div class="text-muted">No se encontró empleado.</div>'; return; }
  const gestor = puedeGestionarHSEQ() || esRRHHoAdmin();
  const lista  = asignacionesDeEmpleado(emp.id);
  const hechas = lista.filter(x => x.a.estado === 'completada').length;
  const pct    = lista.length ? Math.round(hechas / lista.length * 100) : 0;
  const porValidar = lista.filter(x => x.a.certificadoEstado === 'pendiente').length;

  let html = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">🎓 Inducciones y <span>Capacitaciones</span></div>
      ${gestor ? `<button class="btn btn-primary btn-sm" onclick="openAsignarCapEmpModal('${emp.id}')">+ Asignar Capacitación</button>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:18px">
      <div class="stat-card" style="padding:14px;border-left:4px solid var(--navy)">
        <div class="stat-label">Asignadas</div><div class="stat-value" style="font-size:24px">${lista.length}</div></div>
      <div class="stat-card" style="padding:14px;border-left:4px solid var(--green)">
        <div class="stat-label">Completadas</div><div class="stat-value" style="font-size:24px;color:var(--green)">${hechas}</div></div>
      <div class="stat-card" style="padding:14px;border-left:4px solid var(--blue)">
        <div class="stat-label">Cumplimiento</div><div class="stat-value" style="font-size:24px;color:var(--blue)">${pct}%</div></div>
      ${porValidar ? `<div class="stat-card" style="padding:14px;border-left:4px solid var(--amber)">
        <div class="stat-label">Por validar</div><div class="stat-value" style="font-size:24px;color:var(--amber)">${porValidar}</div></div>` : ''}
    </div>`;

  html += lista.length
    ? '<div style="display:flex;flex-direction:column;gap:12px">' +
      lista.map(x => capacitacionCardHTML(x.a, x.cap, 'ficha')).join('') + '</div>'
    : '<div class="glass-card p-6 text-center text-muted">Este colaborador no tiene capacitaciones asignadas.</div>';

  container.innerHTML = html;
}
window.renderEmpCapacitaciones = renderEmpCapacitaciones;


// ═══════════════════════════════════════════════════════════════
// PANEL DE GERENCIA (solo lectura)
// ═══════════════════════════════════════════════════════════════
function renderGerenciaHSEQ(content) {
  if (!content) return;
  const asigs   = SC.capAsignaciones || [];
  const hechas  = asigs.filter(a => a.estado === 'completada').length;
  const pct     = asigs.length ? Math.round(hechas / asigs.length * 100) : 0;
  const validados = asigs.filter(a => a.certificadoEstado === 'aprobado').length;
  const vencidos  = asigs.filter(a => hseqVigencia(a, SC.capacitaciones.find(c => c.id === a.capId)).estado === 'vencido').length;
  const politicas = (SC.hseqDocs || []).filter(d => d.ambito === 'general');
  const certsISO  = SC.hseqCerts || [];

  // Cumplimiento por área
  const porArea = SC.areas.map(ar => {
    const emps = SC.empleados.filter(e => String(e.areaId) === String(ar.id) && e.status === 'activo');
    const ids  = new Set(emps.map(e => e.id));
    const as   = asigs.filter(a => ids.has(a.empId));
    const ok   = as.filter(a => a.estado === 'completada').length;
    return { ar, total:as.length, ok, pct: as.length ? Math.round(ok / as.length * 100) : 0 };
  }).filter(x => x.total > 0).sort((a,b) => b.pct - a.pct);

  let html = `
    <div class="stats-grid mb-4">
      <div class="stat-card"><div class="stat-icon">🎓</div><div class="stat-label">Capacitaciones</div>
        <div class="stat-value">${(SC.capacitaciones || []).length}</div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-label">Cumplimiento global</div>
        <div class="stat-value" style="color:${pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'}">${pct}%</div></div>
      <div class="stat-card"><div class="stat-icon">📑</div><div class="stat-label">Certificados validados</div>
        <div class="stat-value" style="color:var(--green)">${validados}</div></div>
      <div class="stat-card"><div class="stat-icon">⛔</div><div class="stat-label">Certificados vencidos</div>
        <div class="stat-value" style="color:var(--red)">${vencidos}</div></div>
    </div>`;

  // Cumplimiento por área
  html += `<div class="glass-card p-5 mb-4">
    <div class="section-title mb-4" style="font-size:15px">📊 Cumplimiento de capacitación <span>por área</span></div>`;
  html += porArea.length ? porArea.map(x => `
    <div class="mb-3">
      <div class="flex justify-between mb-1">
        <span style="font-size:12px">${x.ar.icon} ${hseqEsc(x.ar.name)}</span>
        <span style="font-size:12px;font-weight:700">${x.ok}/${x.total} · ${x.pct}%</span>
      </div>
      <div style="height:8px;background:var(--surface);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${x.pct}%;background:${x.pct >= 80 ? 'var(--green)' : x.pct >= 50 ? 'var(--amber)' : 'var(--red)'};border-radius:99px"></div>
      </div>
    </div>`).join('') : '<div class="text-sm text-muted">Aún no hay capacitaciones asignadas.</div>';
  html += '</div>';

  // Certificaciones ISO
  html += `<div class="glass-card p-5 mb-4">
    <div class="section-title mb-4" style="font-size:15px">🏅 Certificaciones <span>de la organización</span></div>`;
  html += certsISO.length
    ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Norma</th><th>Ente</th><th>Emisión</th><th>Vencimiento</th><th>Estado</th><th></th></tr></thead>
        <tbody>${certsISO.map(c => {
          const dias = c.fechaVencimiento
            ? Math.floor((new Date(c.fechaVencimiento) - new Date(hseqHoy())) / 86400000) : null;
          const badge = dias == null ? '<span class="badge badge-grey">—</span>'
            : dias < 0 ? '<span class="badge badge-red">⛔ Vencida</span>'
            : dias <= 60 ? `<span class="badge badge-yellow">⏳ ${dias}d</span>`
            : '<span class="badge badge-green">✅ Vigente</span>';
          return `<tr>
            <td style="font-weight:600">${hseqEsc(c.norma)}</td>
            <td class="text-sm">${hseqEsc(c.ente || '—')}</td>
            <td class="text-xs text-muted">${hseqEsc(c.fechaEmision || '—')}</td>
            <td class="text-xs text-muted">${hseqEsc(c.fechaVencimiento || '—')}</td>
            <td>${badge}</td>
            <td>${c.archivoUrl ? `<a href="${c.archivoUrl}" target="_blank" class="btn btn-ghost btn-sm">👁️</a>` : ''}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`
    : '<div class="text-sm text-muted">Sin certificaciones registradas.</div>';
  html += '</div>';

  // Comités
  html += '<div class="two-col mb-4">';
  Object.keys(COMITES).forEach(k => {
    const info = COMITES[k];
    const act  = (SC.comiteMiembros || []).filter(m => m.comite === k && m.activo !== false);
    const acts = (SC.comiteActas || []).filter(a => a.comite === k);
    html += `<div class="glass-card p-5">
      <div class="section-title mb-3" style="font-size:15px">${info.icon} ${info.label}</div>
      <div class="text-xs text-muted mb-3">${info.nombre}</div>
      ${infoRow('Integrantes activos', String(act.length))}
      ${infoRow('Actas registradas', String(acts.length))}
      ${infoRow('Documentos', String((SC.hseqDocs || []).filter(d => d.ambito === k).length))}
      <div style="margin-top:10px">
        ${act.map(m => {
          const emp = SC.empleados.find(e => e.id === m.empId);
          const rc  = ROLES_COMITE[m.rolComite] || { label:m.rolComite, icon:'👤' };
          return `<div class="text-sm" style="padding:4px 0;border-bottom:1px solid var(--surface)">
            ${rc.icon} <b>${hseqEsc(emp?.name || '—')}</b>
            <span class="text-xs text-muted"> · ${rc.label} · ${m.representacion === 'empleador' ? 'Empleador' : 'Trabajadores'}</span>
          </div>`;
        }).join('') || '<div class="text-sm text-muted">Sin integrantes designados.</div>'}
      </div>
      ${acts.length ? `<div style="margin-top:12px">
        <div class="text-xs text-muted" style="font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Últimas actas</div>
        ${acts.sort((a,b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0,4).map(a =>
          `<div class="text-sm" style="padding:3px 0">📋 ${hseqEsc(a.fecha)} — ${hseqEsc(a.tema || 'Reunión')}
            ${a.archivoUrl ? `<a href="${a.archivoUrl}" target="_blank" class="btn btn-ghost btn-sm">📎</a>` : ''}</div>`
        ).join('')}</div>` : ''}
    </div>`;
  });
  html += '</div>';

  // Políticas
  html += `<div class="glass-card p-5">
    <div class="section-title mb-4" style="font-size:15px">📜 Políticas y documentos <span>del sistema de gestión</span></div>`;
  html += politicas.length
    ? '<div style="display:flex;flex-direction:column;gap:8px">' +
      politicas.map(d => hseqDocCardComite(d, true)).join('') + '</div>'
    : '<div class="text-sm text-muted">Sin documentos cargados.</div>';
  html += '</div>';

  content.innerHTML = html;
}
window.renderGerenciaHSEQ = renderGerenciaHSEQ;


// ═══════════════════════════════════════════════════════════════
// ACCIONES · SUBIDA DE ARCHIVOS
// ═══════════════════════════════════════════════════════════════
// Sube un archivo al almacenamiento y devuelve { url, nombre } o null
function hseqSubirArchivo(file, carpeta, subcarpeta) {
  return new Promise(resolve => {
    if (!file) { resolve(null); return; }
    if (file.size > 25 * 1024 * 1024) {
      showNotif('El archivo supera los 25 MB permitidos', 'error');
      resolve(null); return;
    }
    readFile(file, async d => {
      try {
        const ref = await uploadToDrive(d.data, d.name, carpeta, subcarpeta);
        resolve(ref ? { url: driveViewUrl(ref), nombre: d.name } : null);
      } catch(e) { resolve(null); }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// CRUD · CAPACITACIONES
// ═══════════════════════════════════════════════════════════════
function openCapacitacionModal(id) {
  if (!puedeGestionarHSEQ()) { showNotif('Solo HSEQ y Recursos Humanos gestionan capacitaciones', 'error'); return; }
  const c = id ? SC.capacitaciones.find(x => x.id === id) : null;
  SC._capEditId = id || null;
  SC._capMats   = c ? JSON.parse(JSON.stringify(c.materiales || [])) : [];

  const areaSel = document.getElementById('cap-area');
  if (areaSel) {
    areaSel.innerHTML = '<option value="">Todas las áreas</option>' +
      SC.areas.map(a => `<option value="${a.id}">${a.icon} ${hseqEsc(a.name)}</option>`).join('');
  }
  document.getElementById('modal-cap-title').textContent = c ? '✏️ Editar Capacitación' : '🎓 Nueva Capacitación';
  document.getElementById('cap-titulo').value      = c?.titulo || '';
  document.getElementById('cap-tipo').value        = c?.tipo || 'capacitacion';
  document.getElementById('cap-categoria').value   = c?.categoria || '';
  document.getElementById('cap-desc').value        = c?.descripcion || '';
  document.getElementById('cap-area').value        = c?.areaId || '';
  document.getElementById('cap-instructor').value  = c?.instructor || '';
  document.getElementById('cap-duracion').value    = c?.duracionHoras || '';
  document.getElementById('cap-vigencia').value    = c?.vigenciaMeses || '';
  document.getElementById('cap-fecha').value       = c?.fecha || hseqHoy();
  document.getElementById('cap-obligatoria').checked = c ? !!c.obligatoria : true;
  document.getElementById('cap-activa').checked      = c ? c.activo !== false : true;
  document.getElementById('cap-mat-nombre').value  = '';
  document.getElementById('cap-mat-url').value     = '';
  document.getElementById('cap-mat-file').value    = '';

  renderCapMateriales();
  openModal('modal-capacitacion');
}
window.openCapacitacionModal = openCapacitacionModal;

function renderCapMateriales() {
  const el = document.getElementById('cap-mats-list');
  if (!el) return;
  const mats = SC._capMats || [];
  if (!mats.length) {
    el.innerHTML = '<div class="text-xs text-muted">Sin material agregado. Puedes subir archivos (PDF, PPT, Word) o pegar el enlace de un video.</div>';
    return;
  }
  el.innerHTML = mats.map((m,i) => {
    const t = TIPOS_MATERIAL[m.tipo] || { icon:'📎', label:m.tipo };
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface);border-radius:8px;margin-bottom:6px">
      <span style="font-size:16px">${t.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600">${hseqEsc(m.nombre || t.label)}</div>
        <div class="text-xs text-muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.label} · ${hseqEsc(m.url || '')}</div>
      </div>
      <button type="button" class="btn btn-danger btn-sm" onclick="quitarCapMaterial(${i})">✕</button>
    </div>`;
  }).join('');
}
window.renderCapMateriales = renderCapMateriales;

function quitarCapMaterial(i) {
  (SC._capMats || []).splice(i, 1);
  renderCapMateriales();
}
window.quitarCapMaterial = quitarCapMaterial;

// Agregar material por enlace (videos de YouTube/Drive, páginas, etc.)
function agregarCapEnlace() {
  const nombre = document.getElementById('cap-mat-nombre').value.trim();
  const url    = document.getElementById('cap-mat-url').value.trim();
  const tipo   = document.getElementById('cap-mat-tipo').value;
  if (!url) { showNotif('Pega el enlace del material', 'error'); return; }
  if (!/^https?:\/\//i.test(url)) { showNotif('El enlace debe comenzar por http:// o https://', 'error'); return; }
  SC._capMats = SC._capMats || [];
  SC._capMats.push({ tipo: tipo || 'enlace', nombre: nombre || url, url });
  document.getElementById('cap-mat-nombre').value = '';
  document.getElementById('cap-mat-url').value    = '';
  renderCapMateriales();
}
window.agregarCapEnlace = agregarCapEnlace;

// Agregar material subiendo el archivo
async function handleCapMaterialFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const tipo = document.getElementById('cap-mat-tipo').value || 'documento';
  showNotif('⏳ Subiendo material...');
  const res = await hseqSubirArchivo(f, 'capacitaciones', 'material');
  e.target.value = '';
  if (!res) { showNotif('No se pudo subir el archivo. Intenta de nuevo.', 'error'); return; }
  SC._capMats = SC._capMats || [];
  SC._capMats.push({ tipo, nombre: res.nombre, url: res.url });
  renderCapMateriales();
  showNotif('Material agregado ✅');
}
window.handleCapMaterialFile = handleCapMaterialFile;

async function guardarCapacitacion() {
  if (!puedeGestionarHSEQ()) { showNotif('No tienes permiso para esta acción', 'error'); return; }
  const titulo = document.getElementById('cap-titulo').value.trim();
  if (!titulo) { showNotif('Escribe el nombre de la capacitación', 'error'); return; }

  const editId = SC._capEditId;
  const base   = editId ? SC.capacitaciones.find(c => c.id === editId) : null;
  const cap = {
    id: editId || 'cap' + Date.now(),
    titulo,
    tipo:         document.getElementById('cap-tipo').value,
    categoria:    document.getElementById('cap-categoria').value.trim(),
    descripcion:  document.getElementById('cap-desc').value.trim(),
    areaId:       document.getElementById('cap-area').value || null,
    cargo:        base?.cargo || '',
    instructor:   document.getElementById('cap-instructor').value.trim(),
    duracionHoras:parseFloat(document.getElementById('cap-duracion').value) || 0,
    vigenciaMeses:parseInt(document.getElementById('cap-vigencia').value) || 0,
    fecha:        document.getElementById('cap-fecha').value || hseqHoy(),
    obligatoria:  document.getElementById('cap-obligatoria').checked,
    activo:       document.getElementById('cap-activa').checked,
    materiales:   SC._capMats || [],
    creadoPor:    base?.creadoPor || SC.user?.name || '',
  };

  if (base) Object.assign(base, cap);
  else SC.capacitaciones.push(cap);

  await sbSaveCapacitacion(cap);
  registrarAuditoria(editId ? 'editar' : 'crear', 'capacitacion', cap.id, cap.titulo);
  closeModal('modal-capacitacion');
  showNotif(editId ? 'Capacitación actualizada ✅' : 'Capacitación creada ✅');
  SC._capEditId = null; SC._capMats = [];
  if (document.getElementById('hseq-content')) renderHSEQTabContent();
}
window.guardarCapacitacion = guardarCapacitacion;

async function eliminarCapacitacion(id) {
  if (!puedeGestionarHSEQ()) return;
  const c = SC.capacitaciones.find(x => x.id === id);
  const nAsig = (SC.capAsignaciones || []).filter(a => a.capId === id).length;
  if (!c || !confirm(`¿Eliminar "${c.titulo}"?${nAsig ? `\n\nSe eliminarán también ${nAsig} asignación(es) y sus certificados quedarán sin referencia.` : ''}`)) return;

  SC.capacitaciones = SC.capacitaciones.filter(x => x.id !== id);
  SC.capAsignaciones = (SC.capAsignaciones || []).filter(a => a.capId !== id);
  await sbFetch('capacitacion_asignaciones','DELETE',null,`?capacitacion_id=eq.${encodeURIComponent(id)}`);
  await sbFetch('capacitaciones','DELETE',null,`?id=eq.${encodeURIComponent(id)}`);
  registrarAuditoria('eliminar','capacitacion', id, c.titulo);
  showNotif('Capacitación eliminada');
  renderHSEQTabContent();
}
window.eliminarCapacitacion = eliminarCapacitacion;

// ═══════════════════════════════════════════════════════════════
// ASIGNACIÓN DE CAPACITACIONES
// ═══════════════════════════════════════════════════════════════
function openAsignarCapModal(capId) {
  if (!puedeGestionarHSEQ()) { showNotif('No tienes permiso para asignar capacitaciones', 'error'); return; }
  const cap = SC.capacitaciones.find(c => c.id === capId);
  if (!cap) return;
  SC._asigCapId = capId;
  document.getElementById('asig-cap-nombre').textContent = cap.titulo;

  const areaSel = document.getElementById('asig-area');
  areaSel.innerHTML = '<option value="">Todas las áreas</option>' +
    SC.areas.map(a => `<option value="${a.id}">${a.icon} ${hseqEsc(a.name)}</option>`).join('');
  areaSel.value = cap.areaId || '';
  document.getElementById('asig-buscar').value = '';
  renderAsignarLista();
  openModal('modal-asignar-cap');
}
window.openAsignarCapModal = openAsignarCapModal;

function renderAsignarLista() {
  const cont = document.getElementById('asig-lista');
  if (!cont) return;
  const capId = SC._asigCapId;
  const area  = document.getElementById('asig-area')?.value || '';
  const q     = (document.getElementById('asig-buscar')?.value || '').toLowerCase();

  const yaAsignados = new Set((SC.capAsignaciones || [])
    .filter(a => a.capId === capId).map(a => a.empId));

  const emps = hseqEmpleadosVisibles()
    .filter(e => e.status === 'activo')
    .filter(e => !area || String(e.areaId) === String(area))
    .filter(e => !q || `${e.name} ${e.cedula} ${e.cargo}`.toLowerCase().includes(q))
    .sort((a,b) => a.name.localeCompare(b.name));

  if (!emps.length) { cont.innerHTML = '<div class="text-sm text-muted p-3">No hay colaboradores con estos filtros.</div>'; return; }

  cont.innerHTML = emps.map(e => {
    const ya = yaAsignados.has(e.id);
    const ar = SC.areas.find(a => String(a.id) === String(e.areaId));
    return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--surface);cursor:${ya ? 'default' : 'pointer'};opacity:${ya ? '.5' : '1'}">
      <input type="checkbox" class="asig-chk" value="${e.id}" ${ya ? 'disabled' : ''}>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${hseqEsc(e.name)}</div>
        <div class="text-xs text-muted">${hseqEsc(e.cargo || '')} · ${ar ? hseqEsc(ar.name) : '—'}</div>
      </div>
      ${ya ? '<span class="badge badge-green">Ya asignada</span>' : ''}
    </label>`;
  }).join('');
}
window.renderAsignarLista = renderAsignarLista;

function toggleTodosAsignar(check) {
  document.querySelectorAll('#asig-lista .asig-chk').forEach(c => { if (!c.disabled) c.checked = check; });
}
window.toggleTodosAsignar = toggleTodosAsignar;

async function guardarAsignacionCap() {
  if (!puedeGestionarHSEQ()) return;
  const capId = SC._asigCapId;
  const cap   = SC.capacitaciones.find(c => c.id === capId);
  const ids   = [...document.querySelectorAll('#asig-lista .asig-chk')]
                  .filter(c => c.checked && !c.disabled).map(c => c.value);
  if (!ids.length) { showNotif('Selecciona al menos un colaborador', 'error'); return; }

  const nuevas = ids.map(empId => ({
    id: 'asg' + Date.now() + Math.random().toString(36).slice(2,6),
    capId, empId, estado:'pendiente',
    fechaAsignacion: hseqHoy(), fechaCompletado:'',
    calificacion:null, certificadoUrl:null, certificadoNombre:'',
    certificadoEstado:'sin_cargar', validadoPor:'', fechaValidacion:'',
    observaciones:'', asignadoPor: SC.user?.name || '',
  }));

  SC.capAsignaciones = (SC.capAsignaciones || []).concat(nuevas);
  for (const a of nuevas) await sbSaveCapAsignacion(a);
  registrarAuditoria('asignar','capacitacion', capId, `${cap?.titulo || ''} · ${ids.length} colaborador(es)`);
  closeModal('modal-asignar-cap');
  showNotif(`✅ Capacitación asignada a ${ids.length} colaborador(es)`);
  if (document.getElementById('hseq-content')) renderHSEQTabContent();
}
window.guardarAsignacionCap = guardarAsignacionCap;

// Asignar desde la ficha de un colaborador concreto
function openAsignarCapEmpModal(empId) {
  if (!puedeGestionarHSEQ() && !esRRHHoAdmin()) { showNotif('No tienes permiso para asignar capacitaciones', 'error'); return; }
  const emp = SC.empleados.find(e => e.id === empId);
  if (!emp) return;
  SC._asigEmpId = empId;
  document.getElementById('asigemp-nombre').textContent = emp.name;
  const yaTiene = new Set((SC.capAsignaciones || []).filter(a => a.empId === empId).map(a => a.capId));
  const disponibles = (SC.capacitaciones || []).filter(c => c.activo !== false && !yaTiene.has(c.id));
  const sel = document.getElementById('asigemp-cap');
  sel.innerHTML = disponibles.length
    ? disponibles.map(c => {
        const t = TIPOS_CAPACITACION[c.tipo] || { icon:'🎓' };
        return `<option value="${c.id}">${t.icon} ${hseqEsc(c.titulo)}</option>`;
      }).join('')
    : '<option value="">— No hay capacitaciones disponibles —</option>';
  openModal('modal-asignar-cap-emp');
}
window.openAsignarCapEmpModal = openAsignarCapEmpModal;

async function guardarAsignacionCapEmp() {
  const empId = SC._asigEmpId;
  const capId = document.getElementById('asigemp-cap').value;
  if (!capId) { showNotif('Selecciona una capacitación', 'error'); return; }
  const a = {
    id: 'asg' + Date.now(), capId, empId, estado:'pendiente',
    fechaAsignacion: hseqHoy(), fechaCompletado:'', calificacion:null,
    certificadoUrl:null, certificadoNombre:'', certificadoEstado:'sin_cargar',
    validadoPor:'', fechaValidacion:'', observaciones:'', asignadoPor: SC.user?.name || '',
  };
  SC.capAsignaciones = (SC.capAsignaciones || []).concat([a]);
  await sbSaveCapAsignacion(a);
  registrarAuditoria('asignar','capacitacion', capId, hseqNombreEmp(empId));
  closeModal('modal-asignar-cap-emp');
  showNotif('Capacitación asignada ✅');
  if (typeof renderEmpTab === 'function' && SC.currentEmpId === empId) renderEmpTab('capacitacion');
}
window.guardarAsignacionCapEmp = guardarAsignacionCapEmp;

async function eliminarAsignacionCap(asigId) {
  if (!puedeGestionarHSEQ() && !esRRHHoAdmin()) return;
  const a = (SC.capAsignaciones || []).find(x => x.id === asigId);
  if (!a || !confirm('¿Quitar esta capacitación al colaborador? También se pierde el registro del certificado.')) return;
  SC.capAsignaciones = SC.capAsignaciones.filter(x => x.id !== asigId);
  await sbFetch('capacitacion_asignaciones','DELETE',null,`?id=eq.${encodeURIComponent(asigId)}`);
  registrarAuditoria('eliminar','capacitacion_asignacion', asigId, hseqNombreEmp(a.empId));
  showNotif('Asignación eliminada');
  refrescarVistasCapacitacion(a.empId);
}
window.eliminarAsignacionCap = eliminarAsignacionCap;

// ═══════════════════════════════════════════════════════════════
// CERTIFICADOS DE CAPACITACIÓN
// ═══════════════════════════════════════════════════════════════
async function subirCertificadoCap(asigId, e) {
  const f = e?.target?.files?.[0];
  if (!f) return;
  const a = (SC.capAsignaciones || []).find(x => x.id === asigId);
  if (!a) return;
  // El colaborador solo puede cargar el suyo
  const esPropio = SC.user?.empId === a.empId;
  if (!esPropio && !puedeGestionarHSEQ() && !esRRHHoAdmin()) {
    showNotif('No puedes cargar certificados de otro colaborador', 'error'); return;
  }
  const emp = SC.empleados.find(x => x.id === a.empId);
  showNotif('⏳ Subiendo certificado...');
  const res = await hseqSubirArchivo(f, 'capacitaciones', emp?.name || 'certificados');
  e.target.value = '';
  if (!res) { showNotif('No se pudo subir el certificado. Intenta de nuevo.', 'error'); return; }

  a.certificadoUrl    = res.url;
  a.certificadoNombre = res.nombre;
  a.certificadoEstado = 'pendiente';
  a.estado            = 'completada';
  a.fechaCompletado   = a.fechaCompletado || hseqHoy();
  a.observaciones     = '';
  await sbSaveCapAsignacion(a);
  registrarAuditoria('subir','certificado_capacitacion', a.id,
    `${SC.capacitaciones.find(c => c.id === a.capId)?.titulo || ''} · ${emp?.name || ''}`);
  showNotif('📄 Certificado cargado ✅ — queda pendiente de validación por HSEQ');
  refrescarVistasCapacitacion(a.empId);
}
window.subirCertificadoCap = subirCertificadoCap;

async function validarCertificadoCap(asigId, aprobar) {
  if (!puedeGestionarHSEQ() && !esRRHHoAdmin()) { showNotif('Solo HSEQ valida certificados', 'error'); return; }
  const a = (SC.capAsignaciones || []).find(x => x.id === asigId);
  if (!a) return;

  if (aprobar) {
    a.certificadoEstado = 'aprobado';
    a.estado            = 'completada';
    a.fechaCompletado   = a.fechaCompletado || hseqHoy();
    a.observaciones     = '';
  } else {
    const motivo = prompt('Motivo del rechazo (lo verá el colaborador):', '');
    if (motivo === null) return;
    a.certificadoEstado = 'rechazado';
    a.estado            = 'pendiente';
    a.observaciones     = motivo || 'Certificado rechazado por HSEQ';
    a.certificadoUrl    = null;
    a.certificadoNombre = '';
    a.fechaCompletado   = '';
  }
  a.validadoPor     = SC.user?.name || '';
  a.fechaValidacion = hseqHoy();
  await sbSaveCapAsignacion(a);
  registrarAuditoria(aprobar ? 'aprobar' : 'rechazar', 'certificado_capacitacion', a.id, hseqNombreEmp(a.empId));
  showNotif(aprobar ? '✅ Certificado validado' : 'Certificado rechazado — el colaborador deberá cargarlo de nuevo');
  refrescarVistasCapacitacion(a.empId);
}
window.validarCertificadoCap = validarCertificadoCap;

// Vuelve a pintar la vista visible tras un cambio
function refrescarVistasCapacitacion(empId) {
  if (document.getElementById('hseq-content') && SC.currentView === 'hseq') { renderHSEQTabContent(); return; }
  if (SC.currentView === 'portal' && typeof renderPortal === 'function') { renderPortalCapacitaciones(); return; }
  if (SC.currentView === 'empleado-detail' && SC.currentEmpId === empId && typeof renderEmpTab === 'function') {
    renderEmpTab('capacitacion');
  }
}

// Exportar la matriz de certificados
function exportarCertificadosCSV() {
  const idsVis = new Set(hseqEmpleadosVisibles().map(e => e.id));
  const filas  = (SC.capAsignaciones || []).filter(a => idsVis.has(a.empId));
  const cab = ['Colaborador','Cedula','Area','Cargo','Capacitacion','Tipo','Estado',
               'Fecha asignacion','Fecha completado','Certificado','Estado certificado','Vence'];
  const lineas = [cab.join(';')];
  filas.forEach(a => {
    const e   = SC.empleados.find(x => x.id === a.empId);
    const cap = SC.capacitaciones.find(c => c.id === a.capId);
    const ar  = SC.areas.find(x => String(x.id) === String(e?.areaId));
    const vig = hseqVigencia(a, cap);
    lineas.push([
      e?.name || '', e?.cedula || '', ar?.name || '', e?.cargo || '',
      cap?.titulo || '', TIPOS_CAPACITACION[cap?.tipo]?.label || '',
      a.estado, a.fechaAsignacion, a.fechaCompletado,
      a.certificadoUrl ? 'SI' : 'NO', a.certificadoEstado, vig.vence || '',
    ].map(v => String(v).replace(/;/g, ',')).join(';'));
  });
  const blob = new Blob(['\uFEFF' + lineas.join('\n')], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `certificados_capacitacion_${hseqHoy()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  registrarAuditoria('exportar','certificados_capacitacion', '', `${filas.length} registros`);
}
window.exportarCertificadosCSV = exportarCertificadosCSV;


// ═══════════════════════════════════════════════════════════════
// CRUD · DOCUMENTOS HSEQ (políticas, formatos, procedimientos)
// ═══════════════════════════════════════════════════════════════
function openHseqDocModal(ambito, id) {
  if (!puedeGestionarHSEQ()) { showNotif('Solo HSEQ y Recursos Humanos cargan estos documentos', 'error'); return; }
  const d = id ? (SC.hseqDocs || []).find(x => x.id === id) : null;
  SC._hseqDocEditId = id || null;
  SC._hseqDocAmbito = d?.ambito || ambito || 'general';
  SC._hseqDocFile   = null;

  const tSel = document.getElementById('hdoc-tipo');
  tSel.innerHTML = Object.entries(TIPOS_DOC_HSEQ)
    .map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('');

  const ambitoLbl = SC._hseqDocAmbito === 'general'
    ? 'Sistema de Gestión (HSEQ)'
    : COMITES[SC._hseqDocAmbito]?.label || SC._hseqDocAmbito;
  document.getElementById('modal-hdoc-title').textContent =
    (d ? '✏️ Editar documento · ' : '📜 Nuevo documento · ') + ambitoLbl;

  document.getElementById('hdoc-titulo').value   = d?.titulo || '';
  document.getElementById('hdoc-tipo').value     = d?.tipo || (SC._hseqDocAmbito === 'general' ? 'politica' : 'acta');
  document.getElementById('hdoc-codigo').value   = d?.codigo || '';
  document.getElementById('hdoc-version').value  = d?.version || '';
  document.getElementById('hdoc-desc').value     = d?.descripcion || '';
  document.getElementById('hdoc-vigencia').value = d?.fechaVigencia || '';
  document.getElementById('hdoc-visible').checked = d ? d.visibleEmpleados !== false : true;
  document.getElementById('hdoc-file').value     = '';
  document.getElementById('hdoc-file-lbl').textContent = d?.archivoNombre
    ? '📎 Archivo actual: ' + d.archivoNombre + ' (elige otro para reemplazarlo)'
    : '📎 Adjuntar archivo (PDF, Word, Excel, imagen)';
  // La casilla "visible para colaboradores" solo aplica a documentos generales
  document.getElementById('hdoc-visible-group').style.display =
    SC._hseqDocAmbito === 'general' ? '' : 'none';

  openModal('modal-hseq-doc');
}
window.openHseqDocModal = openHseqDocModal;

function handleHseqDocFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  SC._hseqDocFile = f;
  document.getElementById('hdoc-file-lbl').textContent = '✅ ' + f.name;
}
window.handleHseqDocFile = handleHseqDocFile;

async function guardarHseqDoc() {
  if (!puedeGestionarHSEQ()) return;
  const titulo = document.getElementById('hdoc-titulo').value.trim();
  if (!titulo) { showNotif('Escribe el nombre del documento', 'error'); return; }

  const editId = SC._hseqDocEditId;
  const base   = editId ? SC.hseqDocs.find(x => x.id === editId) : null;
  if (!base && !SC._hseqDocFile) { showNotif('Adjunta el archivo del documento', 'error'); return; }

  const doc = {
    id: editId || 'hd' + Date.now(),
    tipo:   document.getElementById('hdoc-tipo').value,
    ambito: SC._hseqDocAmbito || 'general',
    titulo,
    codigo:      document.getElementById('hdoc-codigo').value.trim(),
    version:     document.getElementById('hdoc-version').value.trim(),
    descripcion: document.getElementById('hdoc-desc').value.trim(),
    fechaVigencia: document.getElementById('hdoc-vigencia').value || '',
    visibleEmpleados: document.getElementById('hdoc-visible').checked,
    archivoUrl:    base?.archivoUrl || null,
    archivoNombre: base?.archivoNombre || '',
    subidoPor:     base?.subidoPor || SC.user?.name || '',
  };

  closeModal('modal-hseq-doc');
  if (SC._hseqDocFile) {
    showNotif('⏳ Subiendo documento...');
    const res = await hseqSubirArchivo(SC._hseqDocFile, 'hseq', doc.ambito);
    if (res) { doc.archivoUrl = res.url; doc.archivoNombre = res.nombre; }
    else if (!base) { showNotif('No se pudo subir el archivo. Intenta de nuevo.', 'error'); return; }
  }

  if (base) Object.assign(base, doc);
  else SC.hseqDocs.push(doc);
  await sbSaveHseqDoc(doc);
  registrarAuditoria(editId ? 'editar' : 'subir', 'hseq_documento', doc.id, `${doc.ambito} · ${doc.titulo}`);
  SC._hseqDocFile = null; SC._hseqDocEditId = null;
  showNotif(editId ? 'Documento actualizado ✅' : 'Documento cargado ✅');
  refrescarVistaHSEQ();
}
window.guardarHseqDoc = guardarHseqDoc;

async function eliminarHseqDoc(id) {
  if (!puedeGestionarHSEQ()) return;
  const d = (SC.hseqDocs || []).find(x => x.id === id);
  if (!d || !confirm(`¿Eliminar "${d.titulo}"?`)) return;
  SC.hseqDocs = SC.hseqDocs.filter(x => x.id !== id);
  await sbFetch('hseq_documentos','DELETE',null,`?id=eq.${encodeURIComponent(id)}`);
  registrarAuditoria('eliminar','hseq_documento', id, d.titulo);
  showNotif('Documento eliminado');
  refrescarVistaHSEQ();
}
window.eliminarHseqDoc = eliminarHseqDoc;

// ═══════════════════════════════════════════════════════════════
// CRUD · CERTIFICACIONES ISO Y OTRAS
// ═══════════════════════════════════════════════════════════════
function openHseqCertModal(id) {
  if (!puedeGestionarHSEQ()) { showNotif('Solo HSEQ y Recursos Humanos registran certificaciones', 'error'); return; }
  const c = id ? (SC.hseqCerts || []).find(x => x.id === id) : null;
  SC._hseqCertEditId = id || null;
  SC._hseqCertFile   = null;

  const eSel = document.getElementById('hcert-empresa');
  eSel.innerHTML = '<option value="">Todas / Corporativa</option>' +
    SC.empresas.map(e => `<option value="${e.id}">${hseqEsc(e.name)}</option>`).join('');

  document.getElementById('modal-hcert-title').textContent = c ? '✏️ Editar Certificación' : '🏅 Nueva Certificación';
  document.getElementById('hcert-norma').value    = c?.norma || '';
  document.getElementById('hcert-alcance').value  = c?.alcance || '';
  document.getElementById('hcert-ente').value     = c?.ente || '';
  document.getElementById('hcert-numero').value   = c?.numero || '';
  document.getElementById('hcert-empresa').value  = c?.empresaId || '';
  document.getElementById('hcert-emision').value  = c?.fechaEmision || '';
  document.getElementById('hcert-vence').value    = c?.fechaVencimiento || '';
  document.getElementById('hcert-estado').value   = c?.estado || 'vigente';
  document.getElementById('hcert-obs').value      = c?.observaciones || '';
  document.getElementById('hcert-file').value     = '';
  document.getElementById('hcert-file-lbl').textContent = c?.archivoNombre
    ? '📎 Archivo actual: ' + c.archivoNombre + ' (elige otro para reemplazarlo)'
    : '📎 Adjuntar certificado (PDF o imagen)';
  openModal('modal-hseq-cert');
}
window.openHseqCertModal = openHseqCertModal;

function handleHseqCertFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  SC._hseqCertFile = f;
  document.getElementById('hcert-file-lbl').textContent = '✅ ' + f.name;
}
window.handleHseqCertFile = handleHseqCertFile;

async function guardarHseqCert() {
  if (!puedeGestionarHSEQ()) return;
  const norma = document.getElementById('hcert-norma').value.trim();
  if (!norma) { showNotif('Indica la norma o certificación (ej: ISO 9001:2015)', 'error'); return; }

  const editId = SC._hseqCertEditId;
  const base   = editId ? SC.hseqCerts.find(x => x.id === editId) : null;
  const cert = {
    id: editId || 'hc' + Date.now(),
    norma,
    alcance:   document.getElementById('hcert-alcance').value.trim(),
    ente:      document.getElementById('hcert-ente').value.trim(),
    numero:    document.getElementById('hcert-numero').value.trim(),
    empresaId: document.getElementById('hcert-empresa').value || null,
    fechaEmision:     document.getElementById('hcert-emision').value || '',
    fechaVencimiento: document.getElementById('hcert-vence').value || '',
    estado:    document.getElementById('hcert-estado').value,
    observaciones: document.getElementById('hcert-obs').value.trim(),
    archivoUrl:    base?.archivoUrl || null,
    archivoNombre: base?.archivoNombre || '',
    registradoPor: base?.registradoPor || SC.user?.name || '',
  };

  closeModal('modal-hseq-cert');
  if (SC._hseqCertFile) {
    showNotif('⏳ Subiendo certificado...');
    const res = await hseqSubirArchivo(SC._hseqCertFile, 'hseq', 'certificaciones');
    if (res) { cert.archivoUrl = res.url; cert.archivoNombre = res.nombre; }
  }

  if (base) Object.assign(base, cert);
  else SC.hseqCerts.push(cert);
  await sbSaveHseqCert(cert);
  registrarAuditoria(editId ? 'editar' : 'crear', 'hseq_certificacion', cert.id, cert.norma);
  SC._hseqCertFile = null; SC._hseqCertEditId = null;
  showNotif(editId ? 'Certificación actualizada ✅' : 'Certificación registrada ✅');
  refrescarVistaHSEQ();
}
window.guardarHseqCert = guardarHseqCert;

async function eliminarHseqCert(id) {
  if (!puedeGestionarHSEQ()) return;
  const c = (SC.hseqCerts || []).find(x => x.id === id);
  if (!c || !confirm(`¿Eliminar la certificación "${c.norma}"?`)) return;
  SC.hseqCerts = SC.hseqCerts.filter(x => x.id !== id);
  await sbFetch('hseq_certificaciones','DELETE',null,`?id=eq.${encodeURIComponent(id)}`);
  registrarAuditoria('eliminar','hseq_certificacion', id, c.norma);
  showNotif('Certificación eliminada');
  refrescarVistaHSEQ();
}
window.eliminarHseqCert = eliminarHseqCert;

// ═══════════════════════════════════════════════════════════════
// CRUD · INTEGRANTES DE COPASST Y COCOLAB
// ═══════════════════════════════════════════════════════════════
function openComiteMiembroModal(comite, id) {
  if (!puedeGestionarHSEQ()) { showNotif('Solo HSEQ designa los integrantes del comité', 'error'); return; }
  const m = id ? (SC.comiteMiembros || []).find(x => x.id === id) : null;
  SC._comMiembroEditId = id || null;
  SC._comMiembroComite = m?.comite || comite;

  const info = COMITES[SC._comMiembroComite];
  document.getElementById('modal-cmiem-title').textContent =
    (m ? '✏️ Editar integrante · ' : '👤 Nuevo integrante · ') + (info?.label || '');

  const sel = document.getElementById('cmiem-emp');
  const emps = SC.empleados.filter(e => e.status === 'activo').sort((a,b) => a.name.localeCompare(b.name));
  sel.innerHTML = '<option value="">— Selecciona un colaborador —</option>' +
    emps.map(e => `<option value="${e.id}">${hseqEsc(e.name)} — ${hseqEsc(e.cargo || '')}</option>`).join('');

  document.getElementById('cmiem-emp').value    = m?.empId || '';
  document.getElementById('cmiem-rol').value    = m?.rolComite || 'principal';
  document.getElementById('cmiem-repr').value   = m?.representacion || 'trabajadores';
  document.getElementById('cmiem-inicio').value = m?.periodoInicio || hseqHoy();
  document.getElementById('cmiem-fin').value    = m?.periodoFin || '';
  document.getElementById('cmiem-activo').checked = m ? m.activo !== false : true;
  openModal('modal-comite-miembro');
}
window.openComiteMiembroModal = openComiteMiembroModal;

async function guardarComiteMiembro() {
  if (!puedeGestionarHSEQ()) return;
  const empId = document.getElementById('cmiem-emp').value;
  if (!empId) { showNotif('Selecciona el colaborador', 'error'); return; }
  const comite = SC._comMiembroComite;
  const editId = SC._comMiembroEditId;

  // No duplicar integrante en el mismo comité
  const dup = (SC.comiteMiembros || []).find(m =>
    m.comite === comite && m.empId === empId && m.id !== editId);
  if (dup) { showNotif('Ese colaborador ya está registrado en este comité', 'error'); return; }

  const base = editId ? SC.comiteMiembros.find(x => x.id === editId) : null;
  const m = {
    id: editId || 'cm' + Date.now(),
    comite, empId,
    rolComite:      document.getElementById('cmiem-rol').value,
    representacion: document.getElementById('cmiem-repr').value,
    periodoInicio:  document.getElementById('cmiem-inicio').value || '',
    periodoFin:     document.getElementById('cmiem-fin').value || '',
    activo:         document.getElementById('cmiem-activo').checked,
    designadoPor:   base?.designadoPor || SC.user?.name || '',
  };

  if (base) Object.assign(base, m);
  else SC.comiteMiembros.push(m);
  await sbSaveComiteMiembro(m);
  registrarAuditoria(editId ? 'editar' : 'crear', 'comite_miembro', m.id,
    `${COMITES[comite]?.label} · ${hseqNombreEmp(empId)}`);
  closeModal('modal-comite-miembro');
  showNotif(`✅ Integrante ${editId ? 'actualizado' : 'designado'} — ya tiene acceso de lectura al ${COMITES[comite]?.label}`);
  refrescarVistaHSEQ();
}
window.guardarComiteMiembro = guardarComiteMiembro;

async function eliminarComiteMiembro(id) {
  if (!puedeGestionarHSEQ()) return;
  const m = (SC.comiteMiembros || []).find(x => x.id === id);
  if (!m || !confirm(`¿Retirar a ${hseqNombreEmp(m.empId)} del ${COMITES[m.comite]?.label}?\n\nPerderá el acceso de lectura al módulo del comité.`)) return;
  SC.comiteMiembros = SC.comiteMiembros.filter(x => x.id !== id);
  await sbFetch('comite_miembros','DELETE',null,`?id=eq.${encodeURIComponent(id)}`);
  registrarAuditoria('eliminar','comite_miembro', id, hseqNombreEmp(m.empId));
  showNotif('Integrante retirado del comité');
  refrescarVistaHSEQ();
}
window.eliminarComiteMiembro = eliminarComiteMiembro;

// ═══════════════════════════════════════════════════════════════
// CRUD · ACTAS DE LOS COMITÉS
// ═══════════════════════════════════════════════════════════════
function openComiteActaModal(comite, id) {
  if (!puedeGestionarHSEQ()) { showNotif('Solo HSEQ registra las actas del comité', 'error'); return; }
  const a = id ? (SC.comiteActas || []).find(x => x.id === id) : null;
  SC._comActaEditId = id || null;
  SC._comActaComite = a?.comite || comite;
  SC._comActaFile   = null;

  document.getElementById('modal-cacta-title').textContent =
    (a ? '✏️ Editar acta · ' : '📋 Nueva acta · ') + (COMITES[SC._comActaComite]?.label || '');
  document.getElementById('cacta-numero').value = a?.numero || '';
  document.getElementById('cacta-fecha').value  = a?.fecha || hseqHoy();
  document.getElementById('cacta-tipo').value   = a?.tipo || 'reunion';
  document.getElementById('cacta-tema').value   = a?.tema || '';
  document.getElementById('cacta-desc').value   = a?.descripcion || '';
  document.getElementById('cacta-comp').value   = a?.compromisos || '';
  document.getElementById('cacta-asist').value  = a?.asistentes || '';
  document.getElementById('cacta-file').value   = '';
  document.getElementById('cacta-file-lbl').textContent = a?.archivoNombre
    ? '📎 Archivo actual: ' + a.archivoNombre + ' (elige otro para reemplazarlo)'
    : '📎 Adjuntar acta firmada (PDF) — opcional';
  openModal('modal-comite-acta');
}
window.openComiteActaModal = openComiteActaModal;

function handleComiteActaFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  SC._comActaFile = f;
  document.getElementById('cacta-file-lbl').textContent = '✅ ' + f.name;
}
window.handleComiteActaFile = handleComiteActaFile;

async function guardarComiteActa() {
  if (!puedeGestionarHSEQ()) return;
  const tema = document.getElementById('cacta-tema').value.trim();
  if (!tema) { showNotif('Escribe el tema o asunto del acta', 'error'); return; }

  const editId = SC._comActaEditId;
  const base   = editId ? SC.comiteActas.find(x => x.id === editId) : null;
  const acta = {
    id: editId || 'ca' + Date.now(),
    comite: SC._comActaComite,
    numero: document.getElementById('cacta-numero').value.trim(),
    fecha:  document.getElementById('cacta-fecha').value || hseqHoy(),
    tipo:   document.getElementById('cacta-tipo').value,
    tema,
    descripcion: document.getElementById('cacta-desc').value.trim(),
    compromisos: document.getElementById('cacta-comp').value.trim(),
    asistentes:  document.getElementById('cacta-asist').value.trim(),
    archivoUrl:    base?.archivoUrl || null,
    archivoNombre: base?.archivoNombre || '',
    registradoPor: base?.registradoPor || SC.user?.name || '',
  };

  closeModal('modal-comite-acta');
  if (SC._comActaFile) {
    showNotif('⏳ Subiendo acta...');
    const res = await hseqSubirArchivo(SC._comActaFile, 'comites', acta.comite);
    if (res) { acta.archivoUrl = res.url; acta.archivoNombre = res.nombre; }
  }

  if (base) Object.assign(base, acta);
  else SC.comiteActas.push(acta);
  await sbSaveComiteActa(acta);
  registrarAuditoria(editId ? 'editar' : 'crear', 'comite_acta', acta.id,
    `${COMITES[acta.comite]?.label} · ${acta.tema}`);
  SC._comActaFile = null; SC._comActaEditId = null;
  showNotif(editId ? 'Acta actualizada ✅' : 'Acta registrada ✅');
  refrescarVistaHSEQ();
}
window.guardarComiteActa = guardarComiteActa;

async function eliminarComiteActa(id) {
  if (!puedeGestionarHSEQ()) return;
  const a = (SC.comiteActas || []).find(x => x.id === id);
  if (!a || !confirm(`¿Eliminar el acta "${a.tema}"?`)) return;
  SC.comiteActas = SC.comiteActas.filter(x => x.id !== id);
  await sbFetch('comite_actas','DELETE',null,`?id=eq.${encodeURIComponent(id)}`);
  registrarAuditoria('eliminar','comite_acta', id, a.tema);
  showNotif('Acta eliminada');
  refrescarVistaHSEQ();
}
window.eliminarComiteActa = eliminarComiteActa;

// Repinta la vista activa (módulo HSEQ o vista de comité)
function refrescarVistaHSEQ() {
  if (SC.currentView === 'hseq') { renderHSEQTabContent(); return; }
  if (SC.currentView === 'comite-copasst') { renderComiteView('copasst'); return; }
  if (SC.currentView === 'comite-cocolab') { renderComiteView('cocolab'); return; }
  if (SC.currentView === 'gerencia' && typeof currentGerTab !== 'undefined' && currentGerTab === 'hseq') {
    renderGerenciaHSEQ(document.getElementById('ger-content'));
  }
}
window.refrescarVistaHSEQ = refrescarVistaHSEQ;
