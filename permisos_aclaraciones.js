// ═══════════════════════════════════════════════════════════════
// SPECIAL RRHH — PERMISOS: SOLICITAR ACLARACIÓN AL EMPLEADO
//
// Tercera opción además de Aprobar y Rechazar:
//   1. Quien puede decidir el permiso escribe sus observaciones y
//      pide aclaración o documentos → estado 'aclaracion'.
//      El empleado recibe una notificación 🔔.
//   2. El empleado ve las observaciones en Mi Portal → Permisos y
//      responde con texto y/o uno o varios adjuntos (máx. 10 MB c/u).
//      El permiso vuelve a 'pendiente' y se notifica a quien pidió
//      la aclaración (RRHH o el jefe directo).
//   3. Se puede repetir las veces que haga falta; todo queda en el
//      historial del permiso (columna permisos.aclaraciones).
// ═══════════════════════════════════════════════════════════════

const ACL_MAX_MB    = 10;
const ACL_MAX_BYTES = ACL_MAX_MB * 1024 * 1024;
let   ACL_ARCHIVOS  = [];      // archivos elegidos en el modal de respuesta

function aclEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function aclTamano(b) {
  b = Number(b) || 0;
  if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
}
function aclFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' });
}
function aclEmpNombre(p) {
  return SC.empleados.find(e => e.id === p.empId)?.name || 'el colaborador';
}

// ─── Reglas ──────────────────────────────────────────────────
function puedeSolicitarAclaracion(p) {
  return !!p && p.status === 'pendiente'
    && typeof puedeAprobarPermiso === 'function' && puedeAprobarPermiso(p);
}
function puedeResponderAclaracion(p) {
  return !!p && p.status === 'aclaracion' && !!SC.user?.empId && p.empId === SC.user.empId;
}
window.puedeSolicitarAclaracion = puedeSolicitarAclaracion;
window.puedeResponderAclaracion = puedeResponderAclaracion;

// ─── Modal genérico (se crea una sola vez) ───────────────────
function aclModal(titulo, cuerpo) {
  let m = document.getElementById('modal-perm-aclaracion');
  if (!m) {
    m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-perm-aclaracion';
    m.innerHTML = `
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <div class="modal-title" id="acl-modal-titulo"></div>
          <button class="modal-close" onclick="closeModal('modal-perm-aclaracion')">✕</button>
        </div>
        <div class="modal-body" id="acl-modal-body"></div>
      </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('acl-modal-titulo').textContent = titulo;
  document.getElementById('acl-modal-body').innerHTML = cuerpo;
  openModal('modal-perm-aclaracion');
}

// ─── Historial (lo ven RRHH, el líder y el empleado) ─────────
function renderHistorialAclaraciones(p) {
  const lista = Array.isArray(p?.aclaraciones) ? p.aclaraciones : [];
  if (!lista.length) return '';
  const items = lista.map(a => {
    const esSol = a.tipo === 'solicitud';
    const adj = (a.adjuntos || []).map(f => `
      <a href="#" onclick="verAdjuntoAclaracion('${aclEsc(f.ref)}');return false"
         style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;margin:4px 4px 0 0;color:var(--navy);text-decoration:none">
        📄 ${aclEsc(f.nombre)} <span style="color:var(--text-muted)">${f.tamano ? '· ' + aclTamano(f.tamano) : ''}</span></a>`).join('');
    return `
      <div style="padding:8px 10px;border-left:3px solid ${esSol ? 'var(--amber,#d97706)' : 'var(--blue,#3b82f6)'};
                  background:${esSol ? 'rgba(217,119,6,.06)' : 'rgba(59,130,246,.06)'};border-radius:0 8px 8px 0;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;margin-bottom:3px">
          <b style="color:var(--navy)">${esSol ? '💬 Solicitud de aclaración' : '↩️ Respuesta del colaborador'}</b>
          <span style="color:var(--text-muted)">${aclEsc(a.autor || '')} · ${aclFecha(a.fecha)}</span>
        </div>
        ${a.texto ? `<div style="font-size:12px;line-height:1.5;white-space:pre-wrap">${aclEsc(a.texto)}</div>` : ''}
        ${adj ? `<div>${adj}</div>` : ''}
      </div>`;
  }).join('');
  return `
    <div style="margin-top:12px">
      <div style="font-weight:700;font-size:12px;color:var(--navy);margin-bottom:6px">🗂 Historial de aclaraciones</div>
      ${items}
    </div>`;
}
window.renderHistorialAclaraciones = renderHistorialAclaraciones;

function verAdjuntoAclaracion(ref) {
  const url = typeof driveViewUrl === 'function' ? driveViewUrl(ref) : null;
  if (url) window.open(url, '_blank');
  else showNotif('No se encontró el archivo', 'error');
}
window.verAdjuntoAclaracion = verAdjuntoAclaracion;

// ═══════════════════════════════════════════════════════════════
// LADO RRHH / JEFE: SOLICITAR ACLARACIÓN
// ═══════════════════════════════════════════════════════════════
function openSolicitarAclaracion(id) {
  const p = SC.permisos.find(x => x.id === id);
  if (!p) return;
  if (!puedeSolicitarAclaracion(p)) {
    showNotif('Solo se puede pedir aclaración en permisos pendientes que tú puedas decidir', 'error'); return;
  }
  if (typeof closeModal === 'function') closeModal('modal-permiso-detail');
  aclModal('💬 Solicitar aclaración o documentos', `
    <div class="text-sm" style="margin-bottom:10px">
      <b>${aclEsc(aclEmpNombre(p))}</b> · ${aclEsc(tipoPermisoLabel(p.tipo))} ·
      ${aclEsc(p.inicio)}${p.esPorHoras ? ` ${aclEsc(p.horaInicio || '')}–${aclEsc(p.horaFin || '')}` : ` → ${aclEsc(p.fin)}`}
    </div>
    ${renderHistorialAclaraciones(p)}
    <div class="form-group mt-3">
      <label class="form-label">Observaciones para el colaborador *</label>
      <textarea class="form-textarea" id="acl-sol-texto" rows="4"
        placeholder="Ej.: Adjunta el soporte de la cita médica / Aclara a qué hora regresas…"></textarea>
    </div>
    <div class="text-xs text-muted" style="margin-bottom:12px">
      El permiso quedará en <b>Aclaración solicitada</b> y el colaborador recibirá una notificación 🔔.</div>
    <div class="flex gap-3">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-perm-aclaracion')">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" id="acl-sol-btn" onclick="enviarSolicitudAclaracion('${aclEsc(p.id)}')">📨 Enviar solicitud</button>
    </div>`);
  setTimeout(() => document.getElementById('acl-sol-texto')?.focus(), 50);
}
window.openSolicitarAclaracion = openSolicitarAclaracion;

async function enviarSolicitudAclaracion(id) {
  const p = SC.permisos.find(x => x.id === id);
  if (!p || !puedeSolicitarAclaracion(p)) return;
  const texto = (document.getElementById('acl-sol-texto')?.value || '').trim();
  if (texto.length < 5) { showNotif('Escribe las observaciones para el colaborador', 'error'); return; }
  const btn = document.getElementById('acl-sol-btn');
  if (btn) btn.disabled = true;

  p.aclaraciones = Array.isArray(p.aclaraciones) ? p.aclaraciones : [];
  p.aclaraciones.push({
    id: 'ac' + Date.now(), tipo: 'solicitud', texto,
    autor: SC.user?.name || '', rol: SC.user?.role || '', userId: SC.user?.id || null,
    esRRHH: typeof esRRHH === 'function' ? esRRHH() : false,
    fecha: new Date().toISOString(), adjuntos: [],
  });
  p.status = 'aclaracion';
  await sbSavePermiso(p);
  registrarAuditoria('solicitar_aclaracion', 'permiso', id, texto.slice(0, 200));
  if (typeof syncToSheets === 'function') syncToSheets('permisos');

  const ok = typeof crearNotificacion === 'function' && await crearNotificacion({ empId: p.empId }, {
    titulo: '💬 Te pidieron una aclaración sobre tu permiso',
    mensaje: `${tipoPermisoLabel(p.tipo)} del ${p.inicio}: ${texto.slice(0, 140)}${texto.length > 140 ? '…' : ''}`,
    tipo: 'aclaracion', refTabla: 'permisos', refId: p.id, vista: 'portal-permisos',
  });
  closeModal('modal-perm-aclaracion');
  showNotif(ok ? '📨 Solicitud enviada · el colaborador fue notificado'
               : '📨 Solicitud registrada (no se pudo crear la notificación)');
  if (SC.currentView === 'permisos-admin') renderPermisosAdmin();
  else if (typeof renderDashboard === 'function' && SC.currentView === 'dashboard') renderDashboard();
}
window.enviarSolicitudAclaracion = enviarSolicitudAclaracion;

// ═══════════════════════════════════════════════════════════════
// LADO EMPLEADO: RESPONDER CON OBSERVACIONES Y ADJUNTOS
// ═══════════════════════════════════════════════════════════════
function openResponderAclaracion(id) {
  const p = SC.permisos.find(x => x.id === id);
  if (!p) return;
  if (!puedeResponderAclaracion(p)) { showNotif('Este permiso no tiene aclaraciones pendientes', 'error'); return; }
  ACL_ARCHIVOS = [];
  aclModal('↩️ Responder aclaración', `
    <div class="text-sm" style="margin-bottom:6px">
      ${aclEsc(tipoPermisoLabel(p.tipo))} · ${aclEsc(p.inicio)}${p.esPorHoras ? ` ${aclEsc(p.horaInicio || '')}–${aclEsc(p.horaFin || '')}` : ` → ${aclEsc(p.fin)}`}
    </div>
    ${renderHistorialAclaraciones(p)}
    <div class="form-group mt-3">
      <label class="form-label">Tus observaciones</label>
      <textarea class="form-textarea" id="acl-resp-texto" rows="4" placeholder="Escribe tu aclaración…"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Documentos adjuntos <span class="text-muted" style="font-weight:400">(uno o varios · máx. ${ACL_MAX_MB} MB c/u)</span></label>
      <input type="file" multiple id="acl-resp-files" style="display:none"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onchange="aclElegirArchivos(this)">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('acl-resp-files').click()">📎 Agregar archivos</button>
      <div id="acl-resp-lista" style="margin-top:8px"></div>
    </div>
    <div class="flex gap-3 mt-2">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-perm-aclaracion')">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" id="acl-resp-btn" onclick="enviarRespuestaAclaracion('${aclEsc(p.id)}')">📤 Enviar respuesta</button>
    </div>`);
}
window.openResponderAclaracion = openResponderAclaracion;

function aclElegirArchivos(input) {
  const nuevos = Array.from(input?.files || []);
  if (input) input.value = '';
  const grandes = nuevos.filter(f => f.size > ACL_MAX_BYTES);
  if (grandes.length) showNotif(`⛔ Superan ${ACL_MAX_MB} MB: ${grandes.map(f => f.name).join(', ')}`, 'error');
  nuevos.filter(f => f.size > 0 && f.size <= ACL_MAX_BYTES).forEach(f => {
    if (!ACL_ARCHIVOS.some(x => x.name === f.name && x.size === f.size)) ACL_ARCHIVOS.push(f);
  });
  aclPintarArchivos();
}
window.aclElegirArchivos = aclElegirArchivos;

function aclQuitarArchivo(i) { ACL_ARCHIVOS.splice(i, 1); aclPintarArchivos(); }
window.aclQuitarArchivo = aclQuitarArchivo;

function aclPintarArchivos() {
  const el = document.getElementById('acl-resp-lista');
  if (!el) return;
  el.innerHTML = ACL_ARCHIVOS.map((f, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface);border-radius:6px;margin-bottom:4px;font-size:12px">
      <span>📄</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${aclEsc(f.name)}</span>
      <span class="text-muted" style="font-size:11px">${aclTamano(f.size)}</span>
      <button class="btn btn-ghost btn-sm" onclick="aclQuitarArchivo(${i})" title="Quitar">✕</button>
    </div>`).join('');
}

function aclLeerDataURL(f) {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => mal(r.error);
    r.readAsDataURL(f);
  });
}

async function enviarRespuestaAclaracion(id) {
  const p = SC.permisos.find(x => x.id === id);
  if (!p || !puedeResponderAclaracion(p)) return;
  const texto = (document.getElementById('acl-resp-texto')?.value || '').trim();
  if (!texto && !ACL_ARCHIVOS.length) {
    showNotif('Escribe una aclaración o adjunta al menos un documento', 'error'); return;
  }
  const btn = document.getElementById('acl-resp-btn');
  const nombreEmp = aclEmpNombre(p);
  const adjuntos = [];
  for (let i = 0; i < ACL_ARCHIVOS.length; i++) {
    const f = ACL_ARCHIVOS[i];
    if (btn) { btn.disabled = true; btn.textContent = `⏳ Subiendo ${i + 1}/${ACL_ARCHIVOS.length}…`; }
    try {
      const data = await aclLeerDataURL(f);
      const ref  = await uploadToDrive(data, f.name, 'permisos', nombreEmp);
      if (!ref) throw new Error('no se subió');
      adjuntos.push({ nombre: f.name, ref, tamano: f.size });
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = '📤 Enviar respuesta'; }
      showNotif(`⚠️ No se pudo subir "${f.name}". Intenta de nuevo.`, 'error');
      return;   // no enviar una respuesta incompleta
    }
  }

  p.aclaraciones = Array.isArray(p.aclaraciones) ? p.aclaraciones : [];
  const solicitud = [...p.aclaraciones].reverse().find(a => a.tipo === 'solicitud');
  p.aclaraciones.push({
    id: 'ac' + Date.now(), tipo: 'respuesta', texto,
    autor: SC.user?.name || nombreEmp, rol: SC.user?.role || 'empleado', userId: SC.user?.id || null,
    fecha: new Date().toISOString(), adjuntos,
  });
  p.status = 'pendiente';
  await sbSavePermiso(p);
  registrarAuditoria('responder_aclaracion', 'permiso', id,
    `${adjuntos.length} adjunto(s)${texto ? ' · ' + texto.slice(0, 150) : ''}`);
  if (typeof syncToSheets === 'function') syncToSheets('permisos');

  // Avisar a quien pidió la aclaración: RRHH como grupo, o el jefe directo
  const destino = (!solicitud || solicitud.esRRHH || !solicitud.userId) ? { rol: 'rrhh' } : { userId: solicitud.userId };
  const ok = typeof crearNotificacion === 'function' && await crearNotificacion(destino, {
    titulo: `↩️ ${nombreEmp} respondió la aclaración`,
    mensaje: `${tipoPermisoLabel(p.tipo)} del ${p.inicio}${adjuntos.length ? ` · ${adjuntos.length} adjunto(s)` : ''}${texto ? ': ' + texto.slice(0, 120) : ''}`,
    tipo: 'respuesta_aclaracion', refTabla: 'permisos', refId: p.id, vista: 'permisos-admin',
  });
  ACL_ARCHIVOS = [];
  closeModal('modal-perm-aclaracion');
  showNotif(ok ? '✅ Respuesta enviada · Recursos Humanos fue notificado' : '✅ Respuesta enviada');
  if (typeof renderPortal === 'function' && SC.currentView === 'portal') renderPortal('permisos');
}
window.enviarRespuestaAclaracion = enviarRespuestaAclaracion;
