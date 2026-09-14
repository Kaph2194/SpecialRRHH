// ═══════════════════════════════════════════════════════════════
// SPECIAL CAR · BUZÓN DE SUGERENCIAS, PETICIONES Y CONSULTAS
// ───────────────────────────────────────────────────────────────
// Canal interno tipo correo. El colaborador escribe desde su portal
// a Recursos Humanos, a su líder de área, a otra área, a Gerencia o
// a un comité; el destinatario responde y el hilo queda registrado.
//
// No sustituye al Canal de Denuncias: ese sigue siendo el canal
// confidencial para acoso laboral y faltas graves.
//
// Se carga después de app.js, hseq.js y pendientes.js.
// ═══════════════════════════════════════════════════════════════

SC.buzon = SC.buzon || [];

// ─── CATÁLOGOS ─────────────────────────────────────────────────
const BUZON_CATEGORIAS = {
  sugerencia:   { label:'Sugerencia',           icon:'💡', color:'var(--blue)'  },
  idea:         { label:'Idea de mejora',       icon:'🚀', color:'var(--green)' },
  peticion:     { label:'Petición',             icon:'🙋', color:'var(--navy)'  },
  consulta:     { label:'Consulta',             icon:'❓', color:'var(--navy)'  },
  queja:        { label:'Queja',                icon:'😕', color:'var(--amber)' },
  reclamo:      { label:'Reclamo',              icon:'⚠️', color:'var(--red)'   },
  felicitacion: { label:'Felicitación',         icon:'🎉', color:'var(--green)' },
};

const BUZON_ESTADOS = {
  nuevo:      { label:'Nuevo',       badge:'badge-red',    icon:'🆕' },
  leido:      { label:'Leído',       badge:'badge-yellow', icon:'👁' },
  en_gestion: { label:'En gestión',  badge:'badge-blue',   icon:'🔄' },
  respondido: { label:'Respondido',  badge:'badge-green',  icon:'💬' },
  cerrado:    { label:'Cerrado',     badge:'badge-grey',   icon:'✅' },
};

// ─── UTILIDADES ────────────────────────────────────────────────
function buzEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function buzHoy() { return (typeof hoyISO === 'function') ? hoyISO() : new Date().toISOString().split('T')[0]; }
function buzAreaNombre(id) {
  const a = SC.areas.find(x => String(x.id) === String(id));
  return a ? `${a.icon} ${a.name}` : 'Área';
}
// Nombre legible del destinatario de un mensaje
function buzDestinoLabel(m) {
  if (m.destino === 'rrhh')     return '👥 Recursos Humanos';
  if (m.destino === 'gerencia') return '📊 Gerencia';
  if (m.destino === 'copasst')  return '🦺 COPASST';
  if (m.destino === 'cocolab')  return '🤝 Comité de Convivencia';
  if (m.destino === 'area')     return buzAreaNombre(m.destinoAreaId);
  return 'Destinatario';
}

// ─── PERMISOS ──────────────────────────────────────────────────
// El superadmin recibe TODO el buzón en copia oculta, sin importar a
// quién vaya dirigido el mensaje.
function buzEsSuper() { return SC.user?.role === 'superadmin'; }

// ¿El usuario conectado es el destinatario REAL del mensaje?
// (sin contar la copia oculta del superadmin)
function buzDestinatarioReal(m) {
  const u = SC.user;
  if (!u) return false;
  if (m.destino === 'rrhh')     return ['analista_rrhh','lider_rrhh'].includes(u.role);
  if (m.destino === 'gerencia') return ['gerencia','ceo','juridico'].includes(u.role);
  if (m.destino === 'area')     return u.role === 'lider_area' && String(u.areaId) === String(m.destinoAreaId);
  if (m.destino === 'copasst' || m.destino === 'cocolab') {
    return typeof esMiembroComite === 'function' ? esMiembroComite(m.destino) : false;
  }
  return false;
}

// ¿Puede ver este mensaje? El destinatario real o el superadmin.
function buzEsDestinatario(m) {
  return buzEsSuper() || buzDestinatarioReal(m);
}
// ¿Lo está viendo en copia oculta, sin ser el destinatario?
function buzEsCopiaOculta(m) {
  return buzEsSuper() && !buzDestinatarioReal(m);
}
// ¿Tiene bandeja de entrada? (le puede llegar algo)
function buzTieneBandeja() {
  const u = SC.user;
  if (!u) return false;
  if (['superadmin','analista_rrhh','lider_rrhh','gerencia','ceo','juridico','lider_area'].includes(u.role)) return true;
  return typeof misComites === 'function' ? misComites().length > 0 : false;
}
// Mensajes que le corresponden al usuario conectado
function buzBandeja() {
  return (SC.buzon || []).filter(buzEsDestinatario);
}
function buzSinAtender() {
  return buzBandeja().filter(m => m.estado === 'nuevo' || m.estado === 'leido' || m.estado === 'en_gestion');
}
window.buzEsSuper          = buzEsSuper;
window.buzDestinatarioReal = buzDestinatarioReal;
window.buzEsCopiaOculta    = buzEsCopiaOculta;
window.buzEsDestinatario   = buzEsDestinatario;
window.buzTieneBandeja   = buzTieneBandeja;
window.buzBandeja        = buzBandeja;
window.buzSinAtender     = buzSinAtender;

// ─── CONVERSIÓN BD ↔ APP ───────────────────────────────────────
function dbToBuzon(r) {
  let resp = r.respuestas;
  if (typeof resp === 'string') { try { resp = JSON.parse(resp); } catch(e) { resp = []; } }
  return {
    id: r.id, empId: r.emp_id || null, remitente: r.remitente || '',
    anonimo: !!r.anonimo, destino: r.destino || 'rrhh',
    destinoAreaId: r.destino_area_id || null,
    categoria: r.categoria || 'sugerencia', asunto: r.asunto || '',
    mensaje: r.mensaje || '', prioridad: r.prioridad || 'normal',
    estado: r.estado || 'nuevo', fecha: r.fecha || '',
    fechaLectura: r.fecha_lectura || '', leidoPor: r.leido_por || '',
    cerradoPor: r.cerrado_por || '', fechaCierre: r.fecha_cierre || '',
    archivoUrl: r.archivo_url || null, archivoNombre: r.archivo_nombre || '',
    respuestas: Array.isArray(resp) ? resp : [],
  };
}
async function sbSaveBuzon(m) {
  await sbFetch('buzon_mensajes','POST',{
    id:m.id, emp_id:m.empId || null, remitente:m.remitente || '', anonimo:!!m.anonimo,
    destino:m.destino, destino_area_id:m.destinoAreaId || null,
    categoria:m.categoria, asunto:m.asunto, mensaje:m.mensaje || '',
    prioridad:m.prioridad || 'normal', estado:m.estado || 'nuevo',
    fecha:m.fecha || '', fecha_lectura:m.fechaLectura || '', leido_por:m.leidoPor || '',
    cerrado_por:m.cerradoPor || '', fecha_cierre:m.fechaCierre || '',
    archivo_url:m.archivoUrl || null, archivo_nombre:m.archivoNombre || '',
    respuestas:m.respuestas || [],
  },'',{'Prefer':'resolution=merge-duplicates,return=minimal'});
}

async function cargarBuzonDesdeSupabase() {
  try {
    const r = await sbFetch('buzon_mensajes','GET',null,'?select=*&order=created_at.desc');
    if (r !== null) SC.buzon = r.map(dbToBuzon);
  } catch(e) {
    console.warn('Buzón: no se pudieron cargar los mensajes —', e.message);
  }
}
window.cargarBuzonDesdeSupabase = cargarBuzonDesdeSupabase;

// ─── NAVEGACIÓN ────────────────────────────────────────────────
function agregarNavBuzon(nav) {
  if (typeof addNavItem !== 'function' || !buzTieneBandeja()) return;
  const n = buzSinAtender().length;
  addNavItem(nav, '✉️', n ? `Buzón (${n})` : 'Buzón', 'buzon');
}
window.agregarNavBuzon = agregarNavBuzon;


// ═══════════════════════════════════════════════════════════════
// PORTAL DEL COLABORADOR · ESCRIBIR Y VER MIS MENSAJES
// ═══════════════════════════════════════════════════════════════
function renderPortalBuzon() {
  const content = document.getElementById('portal-content');
  if (!content) return;
  const empId = SC.user?.empId;
  const emp   = SC.empleados.find(e => e.id === empId);
  if (!emp) { content.innerHTML = '<div class="text-muted text-sm p-4">No se encontró tu ficha de empleado.</div>'; return; }

  const mios = (SC.buzon || []).filter(m => m.empId === empId)
    .sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const respondidos = mios.filter(m => (m.respuestas || []).some(r => !r.interna)).length;

  // Destinatarios disponibles
  const miArea = SC.areas.find(a => String(a.id) === String(emp.areaId));
  let opciones = `<option value="rrhh">👥 Recursos Humanos</option>`;
  if (miArea) opciones += `<option value="area:${miArea.id}">${miArea.icon} Mi líder — ${buzEsc(miArea.name)}</option>`;
  opciones += `<option value="gerencia">📊 Gerencia</option>`;
  opciones += `<option value="cocolab">🤝 Comité de Convivencia Laboral</option>`;
  opciones += `<option value="copasst">🦺 COPASST (seguridad y salud)</option>`;
  const otras = SC.areas.filter(a => String(a.id) !== String(emp.areaId));
  if (otras.length) {
    opciones += `<optgroup label="Otras áreas">` +
      otras.map(a => `<option value="area:${a.id}">${a.icon} ${buzEsc(a.name)}</option>`).join('') +
      `</optgroup>`;
  }

  content.innerHTML = `
    <div class="section-header mb-4">
      <div class="section-title" style="font-size:16px">✉️ Buzón de <span>Sugerencias y Peticiones</span></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:18px">
      <div class="stat-card" style="padding:14px;border-left:4px solid var(--navy)">
        <div class="stat-label">Enviados</div><div class="stat-value" style="font-size:24px">${mios.length}</div></div>
      <div class="stat-card" style="padding:14px;border-left:4px solid var(--green)">
        <div class="stat-label">Con respuesta</div>
        <div class="stat-value" style="font-size:24px;color:var(--green)">${respondidos}</div></div>
      <div class="stat-card" style="padding:14px;border-left:4px solid var(--amber)">
        <div class="stat-label">En trámite</div>
        <div class="stat-value" style="font-size:24px;color:var(--amber)">${mios.filter(m => m.estado !== 'cerrado' && !(m.respuestas||[]).some(r=>!r.interna)).length}</div></div>
    </div>

    <div class="glass-card p-5 mb-5">
      <div style="font-weight:700;color:var(--navy);font-size:14px;margin-bottom:12px">📝 Escribir un mensaje</div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Para *</label>
          <select class="form-select" id="buz-destino">${opciones}</select></div>
        <div class="form-group"><label class="form-label">Tipo de mensaje *</label>
          <select class="form-select" id="buz-categoria">
            ${Object.entries(BUZON_CATEGORIAS).map(([k,v]) =>
              `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
          </select></div>
      </div>
      <div class="form-group"><label class="form-label">Asunto *</label>
        <input type="text" class="form-input" id="buz-asunto" maxlength="120"
          placeholder="Resume en una línea de qué se trata"></div>
      <div class="form-group"><label class="form-label">Mensaje *</label>
        <textarea class="form-input" id="buz-mensaje" rows="6"
          placeholder="Cuéntanos con detalle tu sugerencia, petición o consulta..."></textarea></div>
      <div class="form-group" style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="buz-anonimo" onchange="buzAvisoAnonimo()">
          <span class="text-sm">Enviar de forma anónima</span></label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="buz-prioridad">
          <span class="text-sm">Marcar como urgente</span></label>
      </div>
      <div id="buz-aviso-anonimo" style="display:none" class="info-box mb-3">
        <span class="text-sm">Al enviarlo de forma anónima <b>no guardamos tu nombre</b>, así que
        este mensaje no aparecerá en tu historial y no podrás ver la respuesta.
        Si esperas respuesta, envíalo con tu nombre.</span>
      </div>
      <div class="info-box mb-3" style="font-size:12px">
        ¿Vas a reportar acoso laboral o una falta grave? Usa la pestaña
        <b>🔒 Denuncias</b>: ese es el canal confidencial y tiene otro tratamiento.
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="enviarMensajeBuzon()">✉️ Enviar mensaje</button>
    </div>

    <div class="section-header mb-3">
      <div class="section-title" style="font-size:15px">📬 Mis <span>mensajes</span></div>
    </div>
    ${mios.length
      ? `<div style="display:flex;flex-direction:column;gap:10px">${mios.map(m => buzCardEmpleado(m)).join('')}</div>`
      : '<div class="glass-card p-6 text-center text-muted">Todavía no has enviado ningún mensaje.</div>'}
  `;
}
window.renderPortalBuzon = renderPortalBuzon;

function buzAvisoAnonimo() {
  const chk = document.getElementById('buz-anonimo');
  const av  = document.getElementById('buz-aviso-anonimo');
  if (av) av.style.display = chk?.checked ? '' : 'none';
}
window.buzAvisoAnonimo = buzAvisoAnonimo;

// Tarjeta del mensaje tal como la ve quien lo envió
function buzCardEmpleado(m) {
  const c = BUZON_CATEGORIAS[m.categoria] || { label:m.categoria, icon:'✉️', color:'var(--navy)' };
  const e = BUZON_ESTADOS[m.estado] || BUZON_ESTADOS.nuevo;
  const publicas = (m.respuestas || []).filter(r => !r.interna);
  return `<div class="glass-card p-4" style="border-left:4px solid ${c.color}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <div style="font-weight:700;color:var(--navy);font-size:14px">
          ${c.icon} ${buzEsc(m.asunto)}
          ${m.prioridad === 'alta' ? '<span class="badge badge-red" style="margin-left:6px">Urgente</span>' : ''}
        </div>
        <div class="text-xs text-muted" style="margin:3px 0 8px">
          Para ${buzDestinoLabel(m)} · ${c.label} · Enviado el ${buzEsc(m.fecha)}
        </div>
        <div class="text-sm" style="white-space:pre-wrap">${buzEsc(m.mensaje)}</div>
      </div>
      <span class="badge ${e.badge}">${e.icon} ${e.label}</span>
    </div>
    ${publicas.length ? `
      <div style="margin-top:12px;border-top:1px solid var(--surface);padding-top:10px">
        <div class="text-xs text-muted" style="font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
          Respuestas</div>
        ${publicas.map(r => `
          <div style="background:var(--surface);border-radius:10px;padding:10px 12px;margin-bottom:8px">
            <div class="text-xs text-muted" style="margin-bottom:4px">
              <b>${buzEsc(r.autor || '')}</b>${r.rol ? ' · ' + buzEsc(r.rol) : ''} · ${buzEsc(r.fecha || '')}</div>
            <div class="text-sm" style="white-space:pre-wrap">${buzEsc(r.texto || '')}</div>
          </div>`).join('')}
      </div>`
      : `<div class="text-xs text-muted" style="margin-top:10px">Aún sin respuesta.</div>`}
  </div>`;
}

// ─── ENVIAR MENSAJE ────────────────────────────────────────────
async function enviarMensajeBuzon() {
  const empId = SC.user?.empId;
  if (!empId) { showNotif('Solo los colaboradores pueden escribir al buzón', 'error'); return; }
  const asunto  = document.getElementById('buz-asunto')?.value.trim();
  const mensaje = document.getElementById('buz-mensaje')?.value.trim();
  if (!asunto)  { showNotif('Escribe el asunto del mensaje', 'error'); return; }
  if (!mensaje) { showNotif('Escribe el contenido del mensaje', 'error'); return; }
  if (mensaje.length < 10) { showNotif('Cuéntanos un poco más para poder gestionarlo', 'error'); return; }

  const destinoRaw = document.getElementById('buz-destino').value;
  const esArea     = destinoRaw.startsWith('area:');
  const anonimo    = !!document.getElementById('buz-anonimo')?.checked;
  const emp        = SC.empleados.find(e => e.id === empId);

  const m = {
    id: 'buz' + Date.now(),
    empId:     anonimo ? null : empId,
    remitente: anonimo ? '' : (emp?.name || SC.user?.name || ''),
    anonimo,
    destino:       esArea ? 'area' : destinoRaw,
    destinoAreaId: esArea ? destinoRaw.slice(5) : null,
    categoria: document.getElementById('buz-categoria').value,
    asunto, mensaje,
    prioridad: document.getElementById('buz-prioridad')?.checked ? 'alta' : 'normal',
    estado: 'nuevo', fecha: buzHoy(),
    fechaLectura:'', leidoPor:'', cerradoPor:'', fechaCierre:'',
    archivoUrl:null, archivoNombre:'', respuestas: [],
  };

  SC.buzon.unshift(m);
  await sbSaveBuzon(m);
  registrarAuditoria('enviar','buzon_mensaje', m.id, `${m.categoria} → ${m.destino}`);
  showNotif(anonimo
    ? '✉️ Mensaje anónimo enviado — no quedará en tu historial'
    : '✉️ Mensaje enviado — te responderán por este mismo buzón');
  renderPortalBuzon();
}
window.enviarMensajeBuzon = enviarMensajeBuzon;


// ═══════════════════════════════════════════════════════════════
// BANDEJA DE ENTRADA (RRHH, LÍDERES, GERENCIA, COMITÉS)
// ═══════════════════════════════════════════════════════════════
function renderBuzon() {
  const root = document.getElementById('buzon-root');
  if (!root) return;
  if (!buzTieneBandeja()) {
    root.innerHTML = '<div class="glass-card p-6 text-center text-muted">No tienes bandeja de entrada en el buzón.</div>';
    return;
  }

  const fEstado = document.getElementById('buz-f-estado')?.value || '';
  const fCat    = document.getElementById('buz-f-cat')?.value || '';
  const fDest   = document.getElementById('buz-f-destino')?.value || '';
  const q       = (document.getElementById('buz-f-q')?.value || '').toLowerCase();

  const todos = buzBandeja();
  const stats = {
    nuevos:  todos.filter(m => m.estado === 'nuevo').length,
    gestion: todos.filter(m => m.estado === 'leido' || m.estado === 'en_gestion').length,
    resp:    todos.filter(m => m.estado === 'respondido').length,
    cerr:    todos.filter(m => m.estado === 'cerrado').length,
  };

  const lista = todos.filter(m => {
    if (fEstado && m.estado !== fEstado) return false;
    if (fCat && m.categoria !== fCat) return false;
    if (fDest) {
      if (fDest === 'propios' && buzEsCopiaOculta(m)) return false;
      else if (fDest.startsWith('area:') && (m.destino !== 'area' || String(m.destinoAreaId) !== fDest.slice(5))) return false;
      else if (!fDest.startsWith('area:') && fDest !== 'propios' && m.destino !== fDest) return false;
    }
    if (q && !(`${m.asunto} ${m.mensaje} ${m.remitente}`.toLowerCase().includes(q))) return false;
    return true;
  }).sort((a,b) => {
    // Urgentes primero, luego lo más antiguo sin atender
    const peso = m => (m.estado === 'cerrado' ? 3 : m.estado === 'respondido' ? 2 : m.prioridad === 'alta' ? 0 : 1);
    return peso(a) - peso(b) || (a.fecha || '').localeCompare(b.fecha || '');
  });

  const avisoSuper = buzEsSuper() ? `
    <div class="info-box mb-4" style="font-size:12px">
      <b>👁 Copia oculta.</b> Como superadministrador recibes todos los mensajes del
      buzón, vayan dirigidos a quien vayan. Abrir uno que no es tuyo no lo marca como
      leído para su destinatario real.
    </div>` : '';

  root.innerHTML = `
    ${avisoSuper}
    <div class="stats-grid mb-4">
      <div class="stat-card"><div class="stat-icon">🆕</div><div class="stat-label">Nuevos</div>
        <div class="stat-value" style="color:var(--red)">${stats.nuevos}</div></div>
      <div class="stat-card"><div class="stat-icon">🔄</div><div class="stat-label">En gestión</div>
        <div class="stat-value" style="color:var(--amber)">${stats.gestion}</div></div>
      <div class="stat-card"><div class="stat-icon">💬</div><div class="stat-label">Respondidos</div>
        <div class="stat-value" style="color:var(--green)">${stats.resp}</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Cerrados</div>
        <div class="stat-value">${stats.cerr}</div></div>
    </div>

    <div class="filter-bar mb-4">
      <input id="buz-f-q" class="form-input search-input" placeholder="🔍 Buscar por asunto, texto o remitente..."
        value="${buzEsc(q)}" oninput="renderBuzon()">
      <select id="buz-f-estado" class="form-select" style="width:170px" onchange="renderBuzon()">
        <option value="">Todos los estados</option>
        ${Object.entries(BUZON_ESTADOS).map(([k,v]) =>
          `<option value="${k}" ${fEstado === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
      </select>
      <select id="buz-f-cat" class="form-select" style="width:180px" onchange="renderBuzon()">
        <option value="">Todos los tipos</option>
        ${Object.entries(BUZON_CATEGORIAS).map(([k,v]) =>
          `<option value="${k}" ${fCat === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
      </select>
      ${buzEsSuper() ? `
        <select id="buz-f-destino" class="form-select" style="width:210px" onchange="renderBuzon()">
          <option value="">Todos los destinatarios</option>
          <option value="propios"  ${fDest === 'propios' ? 'selected' : ''}>📥 Solo los dirigidos a mí</option>
          <option value="rrhh"     ${fDest === 'rrhh' ? 'selected' : ''}>👥 Recursos Humanos</option>
          <option value="gerencia" ${fDest === 'gerencia' ? 'selected' : ''}>📊 Gerencia</option>
          <option value="copasst"  ${fDest === 'copasst' ? 'selected' : ''}>🦺 COPASST</option>
          <option value="cocolab"  ${fDest === 'cocolab' ? 'selected' : ''}>🤝 Convivencia Laboral</option>
          <optgroup label="Áreas">
            ${SC.areas.map(a => `<option value="area:${a.id}" ${fDest === 'area:' + a.id ? 'selected' : ''}>${a.icon} ${buzEsc(a.name)}</option>`).join('')}
          </optgroup>
        </select>` : ''}
    </div>

    ${lista.length
      ? `<div style="display:flex;flex-direction:column;gap:10px">${lista.map(m => buzCardBandeja(m)).join('')}</div>`
      : `<div class="glass-card p-6 text-center text-muted">${
          todos.length ? 'Ningún mensaje coincide con el filtro.' : 'No tienes mensajes en el buzón.'}</div>`}
  `;
}
window.renderBuzon = renderBuzon;

// Tarjeta del mensaje tal como la ve el destinatario
function buzCardBandeja(m) {
  const c = BUZON_CATEGORIAS[m.categoria] || { label:m.categoria, icon:'✉️', color:'var(--navy)' };
  const e = BUZON_ESTADOS[m.estado] || BUZON_ESTADOS.nuevo;
  const abierto = SC._buzAbierto === m.id;
  const emp = m.empId ? SC.empleados.find(x => x.id === m.empId) : null;
  const area = emp ? SC.areas.find(a => String(a.id) === String(emp.areaId)) : null;

  const remitente = m.anonimo
    ? '🕵️ Remitente anónimo'
    : `${buzEsc(m.remitente || emp?.name || '—')}${area ? ` · ${area.icon} ${buzEsc(area.name)}` : ''}`;

  return `<div class="glass-card p-4" style="border-left:4px solid ${m.estado === 'nuevo' ? 'var(--red)' : c.color}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;cursor:pointer"
         onclick="buzAbrir('${m.id}')">
      <div style="flex:1;min-width:220px">
        <div style="font-weight:700;color:var(--navy);font-size:14px">
          ${c.icon} ${buzEsc(m.asunto)}
          ${m.prioridad === 'alta' ? '<span class="badge badge-red" style="margin-left:6px">Urgente</span>' : ''}
        </div>
        <div class="text-xs text-muted" style="margin-top:3px">
          De ${remitente} · Para ${buzDestinoLabel(m)} · ${buzEsc(m.fecha)} · ${c.label}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        ${buzEsCopiaOculta(m) ? '<span class="badge badge-grey" title="Lo ves por ser superadministrador">👁 Copia oculta</span>' : ''}
        <span class="badge ${e.badge}">${e.icon} ${e.label}</span>
        <span class="text-xs text-muted">${abierto ? '▲' : '▼'}</span>
      </div>
    </div>

    ${abierto ? `
      <div style="margin-top:12px;border-top:1px solid var(--surface);padding-top:12px">
        <div class="text-sm" style="white-space:pre-wrap;margin-bottom:12px">${buzEsc(m.mensaje)}</div>
        ${m.archivoUrl ? `<a href="${m.archivoUrl}" target="_blank" class="btn btn-ghost btn-sm mb-3">📎 ${buzEsc(m.archivoNombre || 'Adjunto')}</a>` : ''}

        ${(m.respuestas || []).length ? `
          <div class="text-xs text-muted" style="font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
            Hilo de respuestas</div>
          ${m.respuestas.map(r => `
            <div style="background:${r.interna ? 'rgba(245,158,11,.10)' : 'var(--surface)'};border-radius:10px;padding:10px 12px;margin-bottom:8px">
              <div class="text-xs text-muted" style="margin-bottom:4px">
                <b>${buzEsc(r.autor || '')}</b>${r.rol ? ' · ' + buzEsc(r.rol) : ''} · ${buzEsc(r.fecha || '')}
                ${r.interna ? ' · <span style="color:var(--amber);font-weight:600">Nota interna</span>' : ''}</div>
              <div class="text-sm" style="white-space:pre-wrap">${buzEsc(r.texto || '')}</div>
            </div>`).join('')}
        ` : ''}

        ${m.estado !== 'cerrado' ? `
          <div class="form-group" style="margin-top:10px">
            <textarea class="form-input" id="buz-resp-${m.id}" rows="3"
              placeholder="${m.anonimo
                ? 'El remitente es anónimo y no verá esta respuesta. Úsala como registro de la gestión.'
                : 'Escribe tu respuesta al colaborador...'}"></textarea>
          </div>
          ${buzEsCopiaOculta(m) ? `<div class="text-xs text-muted" style="margin-bottom:8px">
            Este mensaje va dirigido a ${buzDestinoLabel(m)}. Si respondes, quedará a tu nombre.</div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="responderBuzon('${m.id}',false)">💬 Responder</button>
            <button class="btn btn-ghost btn-sm" onclick="responderBuzon('${m.id}',true)"
              title="Solo la ven quienes gestionan el buzón">🔒 Nota interna</button>
            ${m.estado !== 'en_gestion' ? `<button class="btn btn-ghost btn-sm" onclick="buzEstado('${m.id}','en_gestion')">🔄 Marcar en gestión</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="buzEstado('${m.id}','cerrado')">✅ Cerrar</button>
          </div>
          ${m.anonimo ? `<div class="text-xs text-muted" style="margin-top:8px">
            Mensaje anónimo: no hay a quién responder. Lo registrado queda como trazabilidad de la gestión.</div>` : ''}
        ` : `<div class="text-xs text-muted">
              Cerrado por ${buzEsc(m.cerradoPor || '—')} el ${buzEsc(m.fechaCierre || '—')}.
              <button class="btn btn-ghost btn-sm" onclick="buzEstado('${m.id}','en_gestion')">↩ Reabrir</button>
             </div>`}
      </div>` : ''}
  </div>`;
}

// Abrir/cerrar un mensaje. Al abrirlo por primera vez queda marcado como leído.
async function buzAbrir(id) {
  const m = (SC.buzon || []).find(x => x.id === id);
  if (!m || !buzEsDestinatario(m)) return;
  SC._buzAbierto = (SC._buzAbierto === id) ? null : id;
  // Si lo abre el superadmin en copia oculta, el mensaje sigue "nuevo"
  // para su destinatario real: un observador no consume el acuse de lectura.
  if (SC._buzAbierto === id && m.estado === 'nuevo' && !buzEsCopiaOculta(m)) {
    m.estado       = 'leido';
    m.fechaLectura = buzHoy();
    m.leidoPor     = SC.user?.name || '';
    await sbSaveBuzon(m);
    if (typeof buildSidebar === 'function') buildSidebar();
  }
  renderBuzon();
}
window.buzAbrir = buzAbrir;

async function responderBuzon(id, interna) {
  const m = (SC.buzon || []).find(x => x.id === id);
  if (!m) return;
  if (!buzEsDestinatario(m)) { showNotif('Este mensaje no está dirigido a ti', 'error'); return; }
  const ta = document.getElementById('buz-resp-' + id);
  const texto = ta?.value.trim();
  if (!texto) { showNotif('Escribe la respuesta', 'error'); return; }

  m.respuestas = m.respuestas || [];
  m.respuestas.push({
    autor: SC.user?.name || '', rol: SC.user?.roleName || SC.user?.role || '',
    fecha: buzHoy(), texto, interna: !!interna,
  });
  if (!interna) m.estado = 'respondido';
  else if (m.estado === 'nuevo' || m.estado === 'leido') m.estado = 'en_gestion';

  await sbSaveBuzon(m);
  registrarAuditoria(interna ? 'nota_interna' : 'responder', 'buzon_mensaje', m.id, m.asunto);
  showNotif(interna ? '🔒 Nota interna guardada' : '💬 Respuesta enviada al colaborador');
  if (typeof buildSidebar === 'function') buildSidebar();
  renderBuzon();
}
window.responderBuzon = responderBuzon;

async function buzEstado(id, estado) {
  const m = (SC.buzon || []).find(x => x.id === id);
  if (!m) return;
  if (!buzEsDestinatario(m)) { showNotif('Este mensaje no está dirigido a ti', 'error'); return; }
  m.estado = estado;
  if (estado === 'cerrado') {
    m.cerradoPor  = SC.user?.name || '';
    m.fechaCierre = buzHoy();
  } else {
    m.cerradoPor = ''; m.fechaCierre = '';
  }
  await sbSaveBuzon(m);
  registrarAuditoria('cambio_estado','buzon_mensaje', m.id, estado);
  showNotif('Estado actualizado ✅');
  if (typeof buildSidebar === 'function') buildSidebar();
  renderBuzon();
}
window.buzEstado = buzEstado;
